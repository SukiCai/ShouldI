#!/usr/bin/env python3
"""Improve a SKILL.md based on its latest quality evaluation report.

Reads the most recent quality_<ts>.json for the skill, generates targeted
improvements using an LLM, and writes the improved SKILL.md back to all
install locations:
  - skill-builder/skills/<folder>/skill/SKILL.md  (source of truth)
  - hermes-base-agent/skills/<slug>/SKILL.md
  - ~/.hermes/skills/<slug>.md

Usage:
    python scripts/improve_skill.py immigration-planning
    python scripts/improve_skill.py --all
    python scripts/improve_skill.py immigration-planning --model claude-opus-4-7
    python scripts/improve_skill.py immigration-planning --check-first
"""

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import LLMClient, get_skill_dir, load_config, load_prompt

DEFAULT_MODEL = "claude-opus-4-7"
HERMES_HOME = Path.home() / ".hermes"
REPO_ROOT = Path(__file__).parent.parent.parent  # hermes-base-agent/


def find_latest_report(skill_dir: Path) -> Path | None:
    reports_dir = skill_dir / "skill" / "quality_reports"
    if not reports_dir.exists():
        return None
    reports = sorted(reports_dir.glob("quality_*.json"), reverse=True)
    return reports[0] if reports else None


def run_quality_check(skill_dir: Path, model: str) -> Path | None:
    """Run quality_check.py for this skill and return the new report path."""
    import subprocess
    script = Path(__file__).parent / "quality_check.py"
    result = subprocess.run(
        [sys.executable, str(script), skill_dir.name, "--model", model],
        cwd=skill_dir.parent.parent,
        capture_output=False,
    )
    if result.returncode != 0:
        return None
    return find_latest_report(skill_dir)


def install_skill(skill_dir: Path, slug: str, content: str) -> list[str]:
    """Write improved SKILL.md to all install locations. Returns list of written paths."""
    written = []

    # 1. skill-builder source
    source_path = skill_dir / "skill" / "SKILL.md"
    source_path.write_text(content, encoding="utf-8")
    written.append(str(source_path.relative_to(REPO_ROOT)))

    # 2. hermes-base-agent/skills/<slug>/SKILL.md
    repo_skill_path = REPO_ROOT / "skills" / slug / "SKILL.md"
    if repo_skill_path.parent.exists():
        repo_skill_path.write_text(content, encoding="utf-8")
        written.append(str(repo_skill_path.relative_to(REPO_ROOT)))

    # 3. ~/.hermes/skills/<slug>/SKILL.md (directory layout required by Hermes index scanner)
    hermes_skill_dir = HERMES_HOME / "skills" / slug
    hermes_skill_dir.mkdir(parents=True, exist_ok=True)
    hermes_path = hermes_skill_dir / "SKILL.md"
    hermes_path.write_text(content, encoding="utf-8")
    written.append(str(hermes_path))

    return written


def backup_skill(skill_dir: Path) -> Path:
    """Save a timestamped backup of the current SKILL.md."""
    source = skill_dir / "skill" / "SKILL.md"
    backup_dir = skill_dir / "skill" / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"SKILL_{timestamp}.md"
    shutil.copy2(source, backup_path)
    return backup_path


def improve_skill(skill_dir: Path, config: dict, model: str, check_first: bool) -> bool:
    name = config["name"]
    slug = config["slug"]
    skill_path = skill_dir / "skill" / "SKILL.md"

    if not skill_path.exists():
        print(f"[skip] {name}: SKILL.md not found — run build_skill.py first")
        return False

    # Find or generate quality report
    report_path = find_latest_report(skill_dir)
    if report_path is None or check_first:
        if check_first or report_path is None:
            action = "Generating" if report_path is None else "Refreshing"
            print(f"  {action} quality report for {name}...")
            report_path = run_quality_check(skill_dir, model)
            if report_path is None:
                print(f"[skip] {name}: quality check failed")
                return False

    print(f"Improving: {name}")
    print(f"  Report: {report_path.name}")

    skill_content = skill_path.read_text(encoding="utf-8")
    quality_report = json.loads(report_path.read_text(encoding="utf-8"))

    # Show current score
    overall = quality_report.get("overall_score", 0)
    print(f"  Current score: {overall:.1f}/5.0")

    prompt = (
        load_prompt("improve_skill.txt")
        .replace("{{skill_name}}", name)
        .replace("{{domain_description}}", config.get("domain_description", ""))
        .replace("{{skill_content}}", skill_content)
        .replace("{{quality_report}}", json.dumps(quality_report, indent=2, ensure_ascii=False))
    )

    print(f"  Calling {model}...")
    improved = LLMClient().chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=16384,
    ).strip()

    # Strip accidental code fences
    if improved.startswith("```"):
        lines = improved.split("\n")
        improved = "\n".join(lines[1:]).strip()
    if improved.endswith("```"):
        improved = improved[:-3].strip()

    if not improved.startswith("---"):
        print(f"[error] {name}: LLM output doesn't start with YAML frontmatter, skipping write")
        print(f"  Output preview: {improved[:200]}")
        return False

    # Backup, then install
    backup_path = backup_skill(skill_dir)
    print(f"  Backup → {backup_path.relative_to(skill_dir / 'skill')}")

    written = install_skill(skill_dir, slug, improved)
    for path in written:
        print(f"  Written → {path}")

    delta = len(improved) - len(skill_content)
    sign = "+" if delta >= 0 else ""
    print(f"  Size delta: {sign}{delta:,} chars ({len(skill_content):,} → {len(improved):,})")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Improve SKILL.md based on quality report")
    parser.add_argument("skill", nargs="?", help="Skill folder name (under skill-builder/skills/)")
    parser.add_argument("--all", action="store_true", help="Improve all skills with a quality report")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Claude model to use")
    parser.add_argument("--check-first", action="store_true", help="Run quality_check before improving")
    args = parser.parse_args()

    skills_root = Path(__file__).parent.parent / "skills"

    if args.all:
        skill_dirs = [
            d for d in sorted(skills_root.iterdir())
            if (d / "skill" / "SKILL.md").exists()
        ]
        if not skill_dirs:
            sys.exit("No skills found.")
        success = 0
        for sd in skill_dirs:
            try:
                config = load_config(sd)
                print()
                ok = improve_skill(sd, config, args.model, args.check_first)
                if ok:
                    success += 1
            except Exception as e:
                print(f"[error] {sd.name}: {e}")
        print(f"\nDone: {success}/{len(skill_dirs)} skills improved.")
        return

    if not args.skill:
        parser.print_help()
        sys.exit(1)

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    config = load_config(skill_dir)
    ok = improve_skill(skill_dir, config, args.model, args.check_first)
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
