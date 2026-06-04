#!/usr/bin/env python3
"""Quality evaluation for generated SKILL.md files.

Runs a rigorous LLM-based quality assessment against a structured rubric
covering expert framing, heuristic specificity, diagnostic question quality,
failure patterns, hidden tradeoffs, industry realities, and overall actionability.

Usage:
    python scripts/quality_check.py pm-career
    python scripts/quality_check.py immigration-planning --model claude-opus-4-7
    python scripts/quality_check.py --all           # evaluate all skills with SKILL.md
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import LLMClient, get_skill_dir, load_config, load_prompt, strip_json_fences

DEFAULT_MODEL = "claude-opus-4-7"
SCORE_LABELS = {5: "Excellent", 4: "Good", 3: "Adequate", 2: "Weak", 1: "Poor"}
BAR_CHARS = "█▇▆▅▄▃▂▁"


def score_bar(score: int, width: int = 20) -> str:
    filled = round(score / 5 * width)
    return "█" * filled + "░" * (width - filled)


def evaluate_skill(skill_dir: Path, config: dict, model: str) -> dict:
    skill_path = skill_dir / "skill" / "SKILL.md"
    if not skill_path.exists():
        sys.exit(f"SKILL.md not found at {skill_path}. Run build_skill.py first.")

    skill_content = skill_path.read_text(encoding="utf-8")
    print(f"Evaluating: {config['name']}  ({len(skill_content):,} chars)  [model: {model}]")

    prompt = (
        load_prompt("quality_check.txt")
        .replace("{{skill_name}}", config["name"])
        .replace("{{domain_description}}", config["domain_description"])
        .replace("{{skill_content}}", skill_content)
    )

    raw = strip_json_fences(LLMClient().chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4096,
    ))

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[error] JSON parse failed: {e}")
        print(f"Raw output (first 400 chars): {raw[:400]}")
        sys.exit(1)

    return result


def format_report(result: dict) -> str:
    name = result.get("skill_name", "Unknown")
    overall = result.get("overall_score", 0)
    scores = result.get("scores", {})

    lines = []
    lines.append("")
    lines.append("=" * 60)
    lines.append(f"  Quality Report: {name}")
    lines.append(f"  Overall: {overall:.1f}/5.0  {score_bar(round(overall))}")
    lines.append("=" * 60)
    lines.append(f"\n  {result.get('summary', '')}\n")
    lines.append("  Dimension Scores:")
    lines.append(f"  {'─'*50}")
    dim_labels = {
        "expert_framing": "Expert Framing",
        "heuristics_specificity": "Heuristics Specificity",
        "diagnostic_questions": "Diagnostic Questions",
        "failure_patterns": "Failure Patterns",
        "hidden_tradeoffs": "Hidden Tradeoffs",
        "industry_realities": "Industry Realities",
        "junior_vs_senior_table": "Junior vs Senior Table",
        "overall_actionability": "Overall Actionability",
    }
    for key, label in dim_labels.items():
        s = scores.get(key, 0)
        bar = score_bar(s, width=12)
        lines.append(f"  {label:<28} {s}/5  {bar}  {SCORE_LABELS.get(s, '')}")

    if result.get("strengths"):
        lines.append("\n  ✓ Strengths:")
        for item in result["strengths"]:
            lines.append(f"    • {item}")

    if result.get("weaknesses"):
        lines.append("\n  ✗ Weaknesses:")
        for item in result["weaknesses"]:
            lines.append(f"    • {item}")

    if result.get("improvement_suggestions"):
        lines.append("\n  → Improvement Suggestions:")
        for item in result["improvement_suggestions"]:
            lines.append(f"    • {item}")

    if result.get("generic_advice_flags"):
        lines.append("\n  ⚠ Generic Advice Flags:")
        for item in result["generic_advice_flags"]:
            lines.append(f"    • {item}")

    if result.get("missing_coverage"):
        lines.append("\n  ○ Missing Coverage:")
        for item in result["missing_coverage"]:
            lines.append(f"    • {item}")

    lines.append("")
    return "\n".join(lines)


def print_report(result: dict) -> None:
    print(format_report(result))


def save_report(skill_dir: Path, result: dict) -> Path:
    reports_dir = skill_dir / "skill" / "quality_reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    stem = f"quality_{timestamp}"
    json_path = reports_dir / f"{stem}.json"
    txt_path = reports_dir / f"{stem}.txt"
    json_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    txt_path.write_text(format_report(result), encoding="utf-8")
    return json_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate SKILL.md quality")
    parser.add_argument("skill", nargs="?", help="Skill name (folder under skills/)")
    parser.add_argument("--all", action="store_true", help="Evaluate all skills with SKILL.md")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Claude model to use")
    parser.add_argument("--no-save", action="store_true", help="Skip saving report to disk")
    args = parser.parse_args()

    skills_root = Path(__file__).parent.parent / "skills"

    if args.all:
        skill_dirs = [d for d in skills_root.iterdir() if (d / "skill" / "SKILL.md").exists()]
        if not skill_dirs:
            sys.exit("No skills with SKILL.md found.")
        print(f"\nEvaluating {len(skill_dirs)} skill(s)...\n")
        for sd in sorted(skill_dirs):
            try:
                config = load_config(sd)
                result = evaluate_skill(sd, config, args.model)
                print_report(result)
                if not args.no_save:
                    report_path = save_report(sd, result)
                    print(f"  Report saved → {report_path.relative_to(sd.parent.parent)} (+ .txt)\n")
            except SystemExit:
                print(f"  [skip] {sd.name} — evaluation failed\n")
        return

    if not args.skill:
        parser.print_help()
        sys.exit(1)

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    config = load_config(skill_dir)
    result = evaluate_skill(skill_dir, config, args.model)
    print_report(result)

    if not args.no_save:
        report_path = save_report(skill_dir, result)
        print(f"Report saved → {report_path.relative_to(skill_dir.parent.parent)} (+ .txt)")


if __name__ == "__main__":
    main()
