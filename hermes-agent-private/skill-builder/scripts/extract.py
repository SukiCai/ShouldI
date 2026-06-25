#!/usr/bin/env python3
"""Stage 1: Extract structured insights from raw source files.

For each .txt / .md file in skills/<name>/raw/, calls Claude to extract
structured insights and saves the result to processed/extractions/.

Source type is detected from the directory path:
  raw/official/   → extract_official.txt  (weight 1.5)
  raw/authoritative/ → extract_multicountry.txt (weight 1.2)
  raw/expert/     → extract_multicountry.txt  (weight 1.0, default)
  raw/community/  → extract_community.txt  (weight 0.8)

Older skills with raw/books/, raw/web/, raw/manual/, etc. are treated as
"expert" (weight 1.0) for full backward compatibility.

Usage:
    python scripts/extract.py pm-career
    python scripts/extract.py pm-career --force          # re-extract all
    python scripts/extract.py pm-career --model claude-opus-4-7
    python scripts/extract.py pm-career --file raw/official/us/uscis_h1b.txt
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import LLMClient, get_skill_dir, load_config, load_prompt, save_json, strip_json_fences

SUPPORTED_EXTENSIONS = {".txt", ".md"}
MIN_SOURCE_LENGTH = 100  # chars — skip trivially short files

# Typed source directories and their extract prompts
SOURCE_TYPE_DIRS = {"official", "authoritative", "expert", "community"}

# Maps source type → extract prompt filename
# authoritative and expert both use the multicountry prompt (or plain extract.txt
# for single-country skills); only official and community have their own prompts.
PROMPT_BY_SOURCE_TYPE = {
    "official": "extract_official.txt",
    "community": "extract_community.txt",
}

SOURCE_WEIGHTS = {
    "official": 1.5,
    "authoritative": 1.2,
    "expert": 1.0,
    "community": 0.8,
}


def detect_source_type(source_path: Path, config: dict) -> str:
    """Detect source type from directory path.

    Walks up the path looking for a known type directory name.
    Falls back to per-skill config overrides, then "expert" as default.
    """
    # Walk path parts from deepest toward root
    for part in reversed(source_path.parts):
        if part in SOURCE_TYPE_DIRS:
            return part

    # Allow per-skill directory → type mapping in config.yaml
    # e.g. source_type_map: {books: authoritative, web: expert, manual: expert}
    type_map = config.get("source_type_map", {})
    for part in reversed(source_path.parts):
        if part in type_map:
            return type_map[part]

    return "expert"


def _parse_header_regions(source_path: Path) -> list[str] | None:
    """Read the first 20 lines of a community file looking for 'regions: [...]'."""
    try:
        import json as _json
        with open(source_path, encoding="utf-8") as fh:
            for i, line in enumerate(fh):
                if i >= 20:
                    break
                line = line.strip()
                if line.startswith("regions:"):
                    raw = line[len("regions:"):].strip()
                    return _json.loads(raw)
    except Exception:
        pass
    return None


def detect_source_regions(source_path: Path, config: dict) -> list[str]:
    """Return the list of regions this source applies to.

    Priority order:
    1. community file header  (regions: [...] written by scrapers)
    2. path part matching     (raw/us/ → ["us"], raw/canada/ → ["canada"])
    3. config source_regions_map (keyword → regions)
    4. default_regions from config (default: ["us", "canada"])
    """
    # 1. Community file header
    if "community" in source_path.parts:
        header_regions = _parse_header_regions(source_path)
        if header_regions is not None:
            return header_regions

    # 2. Path parts: look for known country directory names
    path_str = str(source_path)
    for part in reversed(source_path.parts):
        if part == "us":
            return ["us"]
        if part == "canada":
            return ["canada"]

    # 3. config.yaml source_regions_map (keyword in file path)
    regions_map = config.get("source_regions_map", {})
    for keyword, regions in regions_map.items():
        if keyword in path_str:
            return regions

    # 4. Default
    return config.get("default_regions", ["us", "canada"])


def extraction_key(source_path: Path) -> str:
    """Stable filename key for a source: <subfolder>_<stem>."""
    return f"{source_path.parent.name}_{source_path.stem}"


def select_prompt(source_type: str, config: dict) -> str:
    """Choose the extraction prompt file for a given source type."""
    # Community and official have dedicated prompts
    if source_type in PROMPT_BY_SOURCE_TYPE:
        return PROMPT_BY_SOURCE_TYPE[source_type]
    # For authoritative and expert: use multicountry variant if skill covers multiple countries
    countries = config.get("countries", [])
    return "extract_multicountry.txt" if countries else "extract.txt"


def extract_file(
    source_path: Path,
    skill_dir: Path,
    config: dict,
    model: str,
    force: bool,
) -> dict | None:
    source_type = detect_source_type(source_path, config)
    key = extraction_key(source_path)
    output_path = skill_dir / "processed" / "extractions" / f"{key}.json"

    if output_path.exists() and not force:
        print(f"  [skip]    {source_path.name}  (already extracted — use --force to redo)")
        return json.loads(output_path.read_text())

    source_text = source_path.read_text(encoding="utf-8")
    if len(source_text.strip()) < MIN_SOURCE_LENGTH:
        print(f"  [skip]    {source_path.name}  (too short, < {MIN_SOURCE_LENGTH} chars)")
        return None

    type_label = f"{source_type} w={SOURCE_WEIGHTS[source_type]}"
    print(f"  [extract] {source_path.name}  ({len(source_text):,} chars, {type_label}) ...")

    countries = config.get("countries", [])
    countries_list = ", ".join(
        config.get("country_labels", {}).get(c, c.upper()) for c in countries
    ) if countries else ""

    source_regions = detect_source_regions(source_path, config)
    region_labels = {
        "us": "United States (OPT, H-1B, F-1, USCIS)",
        "canada": "Canada (PGWP, Express Entry, IRCC, PNP)",
    }
    if not source_regions:
        source_regions_str = "universal / unspecified"
    elif len(source_regions) == 1:
        source_regions_str = region_labels.get(source_regions[0], source_regions[0])
    else:
        source_regions_str = " and ".join(
            region_labels.get(r, r) for r in source_regions
        )

    prompt_file = select_prompt(source_type, config)
    prompt = (
        load_prompt(prompt_file)
        .replace("{{domain_description}}", config["domain_description"])
        .replace("{{source_file}}", source_path.name)
        .replace("{{source_text}}", source_text)
        .replace("{{countries_list}}", countries_list)
        .replace("{{source_regions}}", source_regions_str)
    )

    raw = strip_json_fences(LLMClient().chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=16384,
    ))

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  [error]   JSON parse failed for {source_path.name}: {e}")
        print(f"            Raw output (first 400 chars): {raw[:400]}")
        return None

    # Inject source metadata so merge.py can apply correct RRF weight and routing
    data["_source_type"] = source_type
    data["_source_weight"] = SOURCE_WEIGHTS[source_type]
    data["_extraction_key"] = key
    data["_source_regions"] = source_regions

    save_json(output_path, data)

    standard_categories = [
        "heuristics", "decision_factors", "hidden_tradeoffs",
        "failure_patterns", "diagnostic_questions", "industry_realities",
        "junior_vs_senior_signals",
    ]
    community_categories = [
        "community_misconceptions", "real_case_outcomes",
        "psychological_barriers", "reframing_moves",
    ]
    all_cats = standard_categories + (community_categories if source_type == "community" else [])
    counts = {c: len(data.get(c, [])) for c in all_cats}
    summary = "  ".join(f"{c[:4]}={n}" for c, n in counts.items() if n > 0)
    print(f"  [done]    {output_path.name}  [{summary}]")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract insights from raw source files")
    parser.add_argument("skill", help="Skill name (folder under skills/)")
    parser.add_argument("--force", action="store_true", help="Re-extract even if output exists")
    parser.add_argument("--model", default="claude-sonnet-4-6", help="Claude model to use")
    parser.add_argument(
        "--file", metavar="PATH",
        help="Extract a single file only (path relative to skill dir or absolute)",
    )
    args = parser.parse_args()

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    config = load_config(skill_dir)
    raw_dir = skill_dir / "raw"

    if args.file:
        p = Path(args.file)
        if not p.is_absolute():
            p = skill_dir / p
        source_files = [p] if p.exists() else []
        if not source_files:
            sys.exit(f"Error: file not found: {p}")
    else:
        source_files = sorted(
            p for ext in SUPPORTED_EXTENSIONS for p in raw_dir.rglob(f"*{ext}")
        )

    if not source_files:
        print(f"No source files found in {raw_dir}")
        print(f"Add .txt or .md files to skills/{args.skill}/raw/<type>/")
        sys.exit(0)

    print(f"\nExtracting insights from {len(source_files)} file(s)  [skill: {args.skill}]")
    print(f"Model: {args.model}\n")

    results = [
        r for f in source_files
        if (r := extract_file(f, skill_dir, config, args.model, args.force)) is not None
    ]

    print(f"\nExtracted {len(results)}/{len(source_files)} file(s).")
    print(f"Next step:  python scripts/merge.py {args.skill}")


if __name__ == "__main__":
    main()
