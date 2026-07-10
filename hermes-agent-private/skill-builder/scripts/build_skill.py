#!/usr/bin/env python3
"""Stage 3: Convert merged insights into a SKILL.md file.

Reads processed/merged.json, calls Claude to synthesize the insights into
a structured skill file, and saves it to skill/SKILL.md (plus a timestamped
draft for version history).

Usage:
    python scripts/build_skill.py pm-career
    python scripts/build_skill.py pm-career --model claude-sonnet-4-6
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import LLMClient, get_skill_dir, load_config, load_prompt

DEFAULT_MODEL = "claude-opus-4-7"  # use opus for higher-quality skill synthesis
HERMES_HOME = Path.home() / ".hermes"
REPO_ROOT = Path(__file__).parent.parent.parent  # hermes-base-agent/


def install_skill(slug: str, content: str) -> list[str]:
    """Install SKILL.md to all locations outside skill-builder. Returns written paths."""
    written = []

    # hermes-base-agent/skills/<slug>/SKILL.md
    repo_path = REPO_ROOT / "skills" / slug / "SKILL.md"
    repo_path.parent.mkdir(parents=True, exist_ok=True)
    repo_path.write_text(content, encoding="utf-8")
    written.append(str(repo_path.relative_to(REPO_ROOT)))

    # ~/.hermes/skills/<slug>/SKILL.md  (directory layout required by Hermes index scanner)
    hermes_path = HERMES_HOME / "skills" / slug / "SKILL.md"
    hermes_path.parent.mkdir(parents=True, exist_ok=True)
    hermes_path.write_text(content, encoding="utf-8")
    written.append(str(hermes_path))

    return written


def build_skill(skill_dir: Path, config: dict, model: str) -> str:
    merged_path = skill_dir / "processed" / "merged.json"
    if not merged_path.exists():
        sys.exit("merged.json not found. Run merge.py first.")

    merged = json.loads(merged_path.read_text(encoding="utf-8"))
    meta = merged.get("_meta", {})
    source_count = meta.get("source_count", "?")

    print(f"Building skill from {source_count} source(s)  [model: {model}]")

    countries = config.get("countries", [])
    country_labels = config.get("country_labels", {})
    countries_list = ", ".join(country_labels.get(c, c.upper()) for c in countries) if countries else ""

    prompt_file = "build_skill_multicountry.txt" if countries else "build_skill.txt"

    # For multicountry skills, pass the country-indexed view to give the model structured input
    insights_payload = merged.get("_country_index", merged) if countries else merged

    # Extract community-specific categories separately so they are explicitly visible in the prompt.
    # These are buried in the large insights JSON and models tend to miss them without a dedicated section.
    community_categories = [
        "community_misconceptions", "real_case_outcomes",
        "psychological_barriers", "reframing_moves",
    ]
    community_data = {cat: merged.get(cat, []) for cat in community_categories}
    has_community = any(len(v) > 0 for v in community_data.values())
    community_json = json.dumps(community_data, indent=2, ensure_ascii=False) if has_community else ""

    if has_community:
        counts = {cat: len(v) for cat, v in community_data.items() if v}
        print(f"  Community data: {counts}")

    prompt = (
        load_prompt(prompt_file)
        .replace("{{domain_description}}", config["domain_description"])
        .replace("{{skill_name}}", config["name"])
        .replace("{{skill_slug}}", config["slug"])
        .replace("{{skill_description}}", config["description"])
        .replace("{{tags}}", ", ".join(config.get("tags", [])))
        .replace("{{source_count}}", str(source_count))
        .replace("{{countries_list}}", countries_list)
        .replace("{{merged_insights_json}}", json.dumps(insights_payload, indent=2, ensure_ascii=False))
        .replace("{{community_insights_json}}", community_json)
        .replace("{{has_community}}", "true" if has_community else "false")
    )

    skill_content = LLMClient().chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=16384,
    ).strip()

    # Strip wrapping code fences if model accidentally added them
    if skill_content.startswith("```"):
        lines = skill_content.split("\n")
        skill_content = "\n".join(lines[1:]).strip()
    if skill_content.endswith("```"):
        skill_content = skill_content[:-3].strip()

    # Save versioned draft
    drafts_dir = skill_dir / "skill" / "drafts"
    drafts_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    draft_path = drafts_dir / f"SKILL_{timestamp}.md"
    draft_path.write_text(skill_content, encoding="utf-8")

    # Save as current skill
    skill_path = skill_dir / "skill" / "SKILL.md"
    skill_path.parent.mkdir(parents=True, exist_ok=True)
    skill_path.write_text(skill_content, encoding="utf-8")

    return skill_content


def main() -> None:
    parser = argparse.ArgumentParser(description="Build SKILL.md from merged insights")
    parser.add_argument("skill", help="Skill name")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Claude model to use")
    args = parser.parse_args()

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    config = load_config(skill_dir)
    content = build_skill(skill_dir, config, args.model)

    slug = config["slug"]
    installed = install_skill(slug, content)

    skill_path = skill_dir / "skill" / "SKILL.md"
    lines = content.split("\n")
    print(f"\nSkill written → {skill_path.relative_to(skill_dir.parent.parent)}")
    for path in installed:
        print(f"Installed    → {path}")
    print(f"Lines: {len(lines)}  |  Chars: {len(content):,}")
    print(f"\n--- Preview (first 8 lines) ---")
    print("\n".join(lines[:8]))
    print("---")
    print(f"\nNext step:  python scripts/review.py {args.skill} --summary")


if __name__ == "__main__":
    main()
