#!/usr/bin/env python3
"""Stage 1: Extract structured insights from raw source files.

For each .txt / .md file in skills/<name>/raw/, calls Claude to extract
structured insights and saves the result to processed/extractions/.

Usage:
    python scripts/extract.py pm-career
    python scripts/extract.py pm-career --force          # re-extract all
    python scripts/extract.py pm-career --model claude-opus-4-7
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import LLMClient, get_skill_dir, load_config, load_prompt, save_json, strip_json_fences

SUPPORTED_EXTENSIONS = {".txt", ".md"}
MIN_SOURCE_LENGTH = 100  # chars — skip trivially short files


def extraction_key(source_path: Path) -> str:
    """Stable filename key for a source: <subfolder>_<stem>."""
    return f"{source_path.parent.name}_{source_path.stem}"


def extract_file(
    source_path: Path,
    skill_dir: Path,
    config: dict,
    model: str,
    force: bool,
) -> dict | None:
    key = extraction_key(source_path)
    output_path = skill_dir / "processed" / "extractions" / f"{key}.json"

    if output_path.exists() and not force:
        print(f"  [skip]    {source_path.name}  (already extracted — use --force to redo)")
        return json.loads(output_path.read_text())

    source_text = source_path.read_text(encoding="utf-8")
    if len(source_text.strip()) < MIN_SOURCE_LENGTH:
        print(f"  [skip]    {source_path.name}  (too short, < {MIN_SOURCE_LENGTH} chars)")
        return None

    print(f"  [extract] {source_path.name}  ({len(source_text):,} chars) ...")

    countries = config.get("countries", [])
    prompt_file = "extract_multicountry.txt" if countries else "extract.txt"
    countries_list = ", ".join(
        config.get("country_labels", {}).get(c, c.upper()) for c in countries
    ) if countries else ""

    prompt = (
        load_prompt(prompt_file)
        .replace("{{domain_description}}", config["domain_description"])
        .replace("{{source_file}}", source_path.name)
        .replace("{{source_text}}", source_text)
        .replace("{{countries_list}}", countries_list)
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

    save_json(output_path, data)
    categories = [
        "heuristics", "decision_factors", "hidden_tradeoffs",
        "failure_patterns", "diagnostic_questions", "industry_realities",
        "junior_vs_senior_signals",
    ]
    counts = {c: len(data.get(c, [])) for c in categories}
    summary = "  ".join(f"{c[:4]}={n}" for c, n in counts.items() if n > 0)
    print(f"  [done]    {output_path.name}  [{summary}]")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract insights from raw source files")
    parser.add_argument("skill", help="Skill name (folder under skills/)")
    parser.add_argument("--force", action="store_true", help="Re-extract even if output exists")
    parser.add_argument("--model", default="claude-sonnet-4-6", help="Claude model to use")
    args = parser.parse_args()

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    config = load_config(skill_dir)
    raw_dir = skill_dir / "raw"

    source_files = sorted(
        p for ext in SUPPORTED_EXTENSIONS for p in raw_dir.rglob(f"*{ext}")
    )

    if not source_files:
        print(f"No source files found in {raw_dir}")
        print(f"Add .txt or .md files to skills/{args.skill}/raw/manual/ (or raw/web/)")
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
