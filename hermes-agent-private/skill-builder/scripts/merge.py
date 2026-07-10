#!/usr/bin/env python3
"""Stage 2: Merge per-file extractions into a ranked insight set.

Reads all JSON files from processed/extractions/ and aggregates them by
category. Applies Reciprocal Rank Fusion (RRF) to rank insights: sources
with higher type weights (official > authoritative > expert > community)
and earlier position within an extraction rank higher.

RRF formula per insight:
    score = source_weight / (RRF_K + rank_in_source)

where rank_in_source is 1-based position in the extraction output.

Each insight is tagged with _source, _source_type, _source_weight, _rrf_score.
Insights are sorted by descending _rrf_score within each category.

Older extractions without _source_type metadata are treated as "expert" (weight 1.0).

Usage:
    python scripts/merge.py pm-career
    python scripts/merge.py pm-career --no-rrf   # disable sorting, keep original order
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

COMMUNITY_CATEGORIES = [
    "community_misconceptions",
    "real_case_outcomes",
    "psychological_barriers",
    "reframing_moves",
]

ALL_CATEGORIES = CATEGORIES + COMMUNITY_CATEGORIES

DEFAULT_SOURCE_WEIGHTS = {
    "official": 1.5,
    "authoritative": 1.2,
    "expert": 1.0,
    "community": 0.8,
}

RRF_K = 60  # standard RRF constant; higher = flatter ranking


def rrf_score(weight: float, rank: int) -> float:
    """Reciprocal Rank Fusion score for a single source contribution."""
    return weight / (RRF_K + rank)


def merge_extractions(skill_dir: Path, config: dict, apply_rrf: bool = True) -> dict:
    extraction_dir = skill_dir / "processed" / "extractions"
    files = sorted(extraction_dir.glob("*.json"))

    if not files:
        sys.exit("No extraction files found. Run extract.py first.")

    print(f"Merging {len(files)} extraction(s)...\n")

    # Per-skill weight overrides (optional in config.yaml)
    weight_overrides = config.get("source_weights", {})
    weights = {**DEFAULT_SOURCE_WEIGHTS, **weight_overrides}

    merged: dict = {cat: [] for cat in ALL_CATEGORIES}
    merged["_meta"] = {
        "skill": config["name"],
        "source_count": len(files),
        "sources": [f.stem for f in files],
        "rrf_applied": apply_rrf,
        "rrf_k": RRF_K,
    }

    source_type_counts: dict[str, int] = {}

    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        source_name = data.get("source_file", f.stem)
        source_type = data.get("_source_type", "expert")
        source_weight = weights.get(source_type, weights["expert"])

        source_type_counts[source_type] = source_type_counts.get(source_type, 0) + 1

        for cat in ALL_CATEGORIES:
            items = data.get(cat, [])
            for rank, item in enumerate(items, start=1):
                if isinstance(item, dict):
                    item["_source"] = source_name
                    item["_source_type"] = source_type
                    item["_source_weight"] = source_weight
                    if apply_rrf:
                        item["_rrf_score"] = rrf_score(source_weight, rank)
            merged[cat].extend(items)

    # Sort each category by descending RRF score
    if apply_rrf:
        for cat in ALL_CATEGORIES:
            merged[cat].sort(key=lambda x: x.get("_rrf_score", 0.0) if isinstance(x, dict) else 0.0, reverse=True)

    merged["_meta"]["source_type_breakdown"] = source_type_counts

    # Build country index for multicountry skills
    countries = config.get("countries", [])
    if countries:
        merged["_meta"]["countries"] = countries
        scopes = countries + ["universal"]
        country_index: dict = {s: {cat: [] for cat in ALL_CATEGORIES} for s in scopes}
        for cat in ALL_CATEGORIES:
            for item in merged[cat]:
                if not isinstance(item, dict):
                    continue
                # New format: regions = ["us"] | ["canada"] | ["us","canada"] | []
                # Old format (backward compat): country_scope = "us" | "canada" | "universal"
                item_regions = item.get("regions")
                if item_regions is None:
                    # backward compat: convert country_scope string → regions array
                    scope = item.get("country_scope", "universal")
                    item_regions = [] if scope == "universal" else [scope]

                if not item_regions:
                    # universal: appears in every country bucket AND "universal" bucket
                    country_index["universal"][cat].append(item)
                    for country in countries:
                        if country in country_index:
                            country_index[country][cat].append(item)
                else:
                    # region-specific: appears in each named bucket only
                    matched = False
                    for region in item_regions:
                        if region in country_index:
                            country_index[region][cat].append(item)
                            matched = True
                    if not matched:
                        # unknown region → universal fallback
                        country_index["universal"][cat].append(item)
        merged["_country_index"] = country_index

    # Print summary table
    total = 0
    col = 30
    print(f"  {'Category':<{col}} Items")
    print(f"  {'-'*col} -----")
    for cat in ALL_CATEGORIES:
        n = len(merged[cat])
        if n == 0 and cat in COMMUNITY_CATEGORIES:
            continue  # hide empty community categories (not all skills have them)
        total += n
        bar = "▪" * min(n, 20)
        print(f"  {cat:<{col}} {n:>3}  {bar}")
    print(f"\n  Total: {total} insights across {len([c for c in ALL_CATEGORIES if merged[c]])} categories")

    if source_type_counts:
        print(f"\n  Source type breakdown:")
        for stype, count in sorted(source_type_counts.items(), key=lambda x: -weights.get(x[0], 1.0)):
            w = weights.get(stype, 1.0)
            print(f"    {stype:<15} {count} file(s)  weight={w}")

    if countries:
        print(f"\n  Country index:")
        for scope in scopes:
            cats_data = country_index.get(scope, {})
            n = sum(len(v) for v in cats_data.values())
            if n > 0:
                print(f"    {scope:<12} {n} insights")

    if apply_rrf:
        print(f"\n  RRF applied (k={RRF_K}) — insights sorted by source weight × position")

    return merged


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge extractions into unified RRF-ranked insight set")
    parser.add_argument("skill", help="Skill name")
    parser.add_argument("--no-rrf", action="store_true", help="Disable RRF sorting (keep original order)")
    args = parser.parse_args()

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    config = load_config(skill_dir)
    merged = merge_extractions(skill_dir, config, apply_rrf=not args.no_rrf)

    output_path = skill_dir / "processed" / "merged.json"
    save_json(output_path, merged)

    print(f"\nSaved → {output_path.relative_to(skill_dir.parent.parent)}")
    print(f"Next step:  python scripts/build_skill.py {args.skill}")
    print(f"=== MERGE DONE ===")


if __name__ == "__main__":
    main()
