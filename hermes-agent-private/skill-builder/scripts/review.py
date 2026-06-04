#!/usr/bin/env python3
"""Inspect extracted insights and the generated skill file.

Usage:
    python scripts/review.py pm-career                   # pipeline status
    python scripts/review.py pm-career --summary         # same
    python scripts/review.py pm-career --category heuristics
    python scripts/review.py pm-career --all             # all categories
    python scripts/review.py pm-career --skill           # print SKILL.md
    python scripts/review.py pm-career --drafts          # list draft versions
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import get_skill_dir

CATEGORIES = [
    "heuristics",
    "decision_factors",
    "hidden_tradeoffs",
    "failure_patterns",
    "diagnostic_questions",
    "industry_realities",
    "junior_vs_senior_signals",
]


def hr(char: str = "─", width: int = 64) -> str:
    return char * width


def print_section(title: str) -> None:
    print(f"\n{hr()}")
    print(f"  {title}")
    print(hr())


def show_summary(skill_dir: Path) -> None:
    print_section("Pipeline Status")

    raw_files = list((skill_dir / "raw").rglob("*.txt")) + list((skill_dir / "raw").rglob("*.md"))
    print(f"  Raw source files:    {len(raw_files)}")
    for f in raw_files:
        rel = f.relative_to(skill_dir / "raw")
        size = f.stat().st_size
        print(f"    {rel}  ({size:,} bytes)")

    extraction_dir = skill_dir / "processed" / "extractions"
    extractions = sorted(extraction_dir.glob("*.json")) if extraction_dir.exists() else []
    print(f"\n  Extractions:         {len(extractions)}")
    for f in extractions:
        print(f"    {f.name}")

    merged_path = skill_dir / "processed" / "merged.json"
    if merged_path.exists():
        merged = json.loads(merged_path.read_text())
        total = sum(len(merged.get(c, [])) for c in CATEGORIES)
        print(f"\n  Merged insights:     {total} total")
        col = 30
        for cat in CATEGORIES:
            n = len(merged.get(cat, []))
            bar = "▪" * min(n, 20)
            print(f"    {cat:<{col}} {n:>3}  {bar}")
    else:
        print("\n  Merged insights:     (not created yet — run merge.py)")

    skill_path = skill_dir / "skill" / "SKILL.md"
    drafts_dir = skill_dir / "skill" / "drafts"
    drafts = sorted(drafts_dir.glob("*.md")) if drafts_dir.exists() else []
    status = f"✓  ({len(drafts)} draft(s))" if skill_path.exists() else "(not created yet — run build_skill.py)"
    print(f"\n  SKILL.md:            {status}")


def show_category(skill_dir: Path, category: str) -> None:
    merged_path = skill_dir / "processed" / "merged.json"
    if not merged_path.exists():
        print("No merged.json found. Run merge.py first.")
        return

    merged = json.loads(merged_path.read_text())
    items = merged.get(category, [])

    print_section(f"{category.upper()}  ({len(items)} items)")
    if not items:
        print("  (empty)")
        return

    for i, item in enumerate(items, 1):
        src = item.pop("_source", None) if isinstance(item, dict) else None
        tag = f"  [source: {src}]" if src else ""
        print(f"\n  [{i}]{tag}")
        if isinstance(item, dict):
            for k, v in item.items():
                if isinstance(v, list):
                    print(f"    {k}:")
                    for entry in v:
                        print(f"      • {entry}")
                else:
                    print(f"    {k}: {v}")
            if src:
                item["_source"] = src  # restore
        else:
            print(f"    {item}")


def show_skill(skill_dir: Path) -> None:
    skill_path = skill_dir / "skill" / "SKILL.md"
    if not skill_path.exists():
        print("No SKILL.md found. Run build_skill.py first.")
        return
    print_section("Generated SKILL.md")
    print(skill_path.read_text(encoding="utf-8"))


def show_drafts(skill_dir: Path) -> None:
    drafts_dir = skill_dir / "skill" / "drafts"
    if not drafts_dir.exists() or not list(drafts_dir.glob("*.md")):
        print("No drafts found.")
        return
    print_section("Draft Versions")
    for f in sorted(drafts_dir.glob("*.md")):
        size = f.stat().st_size
        print(f"  {f.name}  ({size:,} bytes)")
    print(f"\nTo view a draft:  cat skill-builder/skills/<name>/skill/drafts/<filename>")


def main() -> None:
    parser = argparse.ArgumentParser(description="Review extracted insights and generated skill")
    parser.add_argument("skill", help="Skill name")
    parser.add_argument("--summary", action="store_true", help="Show pipeline status (default)")
    parser.add_argument(
        "--category", "-c",
        choices=CATEGORIES,
        metavar="CATEGORY",
        help=f"Show one category. Choices: {', '.join(CATEGORIES)}",
    )
    parser.add_argument("--all", "-a", action="store_true", help="Show all categories")
    parser.add_argument("--show-skill", "-s", action="store_true", dest="show_skill", help="Print SKILL.md")
    parser.add_argument("--drafts", "-d", action="store_true", help="List draft versions")
    args = parser.parse_args()

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    showed_something = False

    if args.show_skill:
        show_skill(skill_dir)
        showed_something = True

    if args.drafts:
        show_drafts(skill_dir)
        showed_something = True

    if args.category:
        show_category(skill_dir, args.category)
        showed_something = True

    if getattr(args, "all"):
        for cat in CATEGORIES:
            show_category(skill_dir, cat)
        showed_something = True

    if not showed_something or args.summary:
        show_summary(skill_dir)


if __name__ == "__main__":
    main()
