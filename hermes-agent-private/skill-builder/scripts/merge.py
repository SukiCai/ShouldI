#!/usr/bin/env python3
"""Stage 2: Merge per-file extractions into a single deduplicated insight set.

Reads all JSON files from processed/extractions/ and aggregates them by
category. Adds a _source tag to each item so you can trace it back.

Usage:
    python scripts/merge.py pm-career
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import get_skill_dir, load_config, save_json

CATEGORIES = [
    "heuristics",
    "decision_factors",
    "hidden_tradeoffs",
    "failure_patterns",
    "diagnostic_questions",
    "industry_realities",
    "junior_vs_senior_signals",
]


def merge_extractions(skill_dir: Path, config: dict) -> dict:
    extraction_dir = skill_dir / "processed" / "extractions"
    files = sorted(extraction_dir.glob("*.json"))

    if not files:
        sys.exit("No extraction files found. Run extract.py first.")

    print(f"Merging {len(files)} extraction(s)...\n")

    merged: dict = {cat: [] for cat in CATEGORIES}
    merged["_meta"] = {
        "skill": config["name"],
        "source_count": len(files),
        "sources": [f.stem for f in files],
    }

    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        source_name = data.get("source_file", f.stem)

        for cat in CATEGORIES:
            items = data.get(cat, [])
            for item in items:
                if isinstance(item, dict):
                    item["_source"] = source_name
            merged[cat].extend(items)

    # Build country index for multicountry skills
    countries = config.get("countries", [])
    if countries:
        merged["_meta"]["countries"] = countries
        scopes = countries + ["universal"]
        country_index: dict = {s: {cat: [] for cat in CATEGORIES} for s in scopes}
        for cat in CATEGORIES:
            for item in merged[cat]:
                scope = item.get("country_scope", "universal") if isinstance(item, dict) else "universal"
                if scope not in country_index:
                    country_index[scope] = {cat2: [] for cat2 in CATEGORIES}
                country_index[scope][cat].append(item)
        merged["_country_index"] = country_index

    # Print summary table
    total = 0
    col = 30
    print(f"  {'Category':<{col}} Items")
    print(f"  {'-'*col} -----")
    for cat in CATEGORIES:
        n = len(merged[cat])
        total += n
        bar = "▪" * min(n, 20)
        print(f"  {cat:<{col}} {n:>3}  {bar}")
    print(f"\n  Total: {total} insights across {len(CATEGORIES)} categories")

    if countries:
        print(f"\n  Country index:")
        for scope, cats in merged["_country_index"].items():
            n = sum(len(v) for v in cats.values())
            print(f"    {scope:<12} {n} insights")

    return merged


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge extractions into unified insight set")
    parser.add_argument("skill", help="Skill name")
    args = parser.parse_args()

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    config = load_config(skill_dir)
    merged = merge_extractions(skill_dir, config)

    output_path = skill_dir / "processed" / "merged.json"
    save_json(output_path, merged)

    print(f"\nSaved → {output_path.relative_to(skill_dir.parent.parent)}")
    print(f"Next step:  python scripts/build_skill.py {args.skill}")


if __name__ == "__main__":
    main()
