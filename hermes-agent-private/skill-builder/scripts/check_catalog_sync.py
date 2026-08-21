#!/usr/bin/env python3
"""Consistency gate: expert-card catalog fields must agree on both sides of the stack.

The mobile app has a "collect experts / perspective lenses" feature. Each expert
carries four catalog fields that drive that UI:

  - framework_id     internal lens key (dedupe/grouping; not user-facing)
  - framework_label  human-readable lens name shown on the card
  - discovery_blurb  one-line pitch shown when the user discovers the expert
  - lens_domain      career | relationship | general (drives collection tabs;
                     'general' experts are NOT counted as collectible)

These live in two places that must not drift:

  1. skill-builder/skills/<dir>/config.yaml
       framework_id / framework_label / discovery_blurb / lens_domain
     (authored alongside the skill; documented in WORKFLOW §7c)

  2. apps/api/src/harmence-experts.ts  →  the matching HarmenceExpert entry
       frameworkId / frameworkLabel / discoveryBlurb / lensDomain
     (hand-written; this is what actually renders in the app)

harmence-experts.ts is NOT generated from config.yaml — like requiresLocationPrecheck,
these fields are kept in sync by convention and caught by this gate, not auto-emitted.
An expert entry that is missing any of the four fields fails TypeScript compilation,
so the common silent failure this catches is: a skill-builder skill whose config.yaml
values drift away from what the TS catalog actually ships to users.

This mirrors check_location_sync.py exactly; run it whenever you add a skill,
remove a skill, or change any of the four fields on either side.

Usage:
    python scripts/check_catalog_sync.py
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import load_config

SKILL_BUILDER_ROOT = Path(__file__).parent.parent  # skill-builder/
REPO_ROOT = SKILL_BUILDER_ROOT.parent.parent  # ShouldI/
HARMENCE_EXPERTS_TS = REPO_ROOT / "apps" / "api" / "src" / "harmence-experts.ts"

# smart_talk backs the generic decision-strategy and relationship experts, which
# are hand-authored in the TS catalog and have no skill-builder config.yaml.
SKIP_SKILL_NAMES = {"smart_talk"}

# config.yaml key  ->  harmence-experts.ts key
FIELD_MAP = {
    "framework_id": "frameworkId",
    "framework_label": "frameworkLabel",
    "discovery_blurb": "discoveryBlurb",
    "lens_domain": "lensDomain",
}

VALID_LENS_DOMAINS = {"career", "relationship", "general"}


def load_config_side() -> dict[str, dict[str, str]]:
    """slug -> {config_key: value} for the four catalog fields, per skill-builder skill."""
    skills_root = SKILL_BUILDER_ROOT / "skills"
    result: dict[str, dict[str, str]] = {}
    for skill_dir in sorted(skills_root.iterdir()):
        if not (skill_dir / "config.yaml").exists():
            continue
        config = load_config(skill_dir)
        slug = config.get("slug")
        if not slug:
            continue
        result[slug] = {
            key: ("" if config.get(key) is None else str(config.get(key)).strip())
            for key in FIELD_MAP
        }
    return result


def _iter_expert_entries(text: str):
    """Yield each top-level object literal in the HARMENCE_EXPERTS array."""
    array_start = text.index("HARMENCE_EXPERTS")
    # Skip past "HarmenceExpert[] = " so we land on the array literal's '[',
    # not the empty [] in the preceding type annotation.
    body_start = text.index("= [", array_start) + 2
    depth = 0
    entry_start = None
    for i in range(body_start, len(text)):
        ch = text[i]
        if ch == "{":
            if depth == 0:
                entry_start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and entry_start is not None:
                yield text[entry_start:i + 1]
                entry_start = None
        elif ch == "]" and depth == 0:
            break


def load_ts_side() -> dict[str, dict[str, str]]:
    """skillName -> {ts_key: value} for the four catalog fields, from the TS catalog."""
    if not HARMENCE_EXPERTS_TS.exists():
        sys.exit(f"Cannot find {HARMENCE_EXPERTS_TS} — is the repo layout as expected?")

    text = HARMENCE_EXPERTS_TS.read_text(encoding="utf-8")

    result: dict[str, dict[str, str]] = {}
    for entry in _iter_expert_entries(text):
        name_match = re.search(r"skillName:\s*'([^']+)'", entry)
        if not name_match:
            continue
        skill_name = name_match.group(1)
        if skill_name in SKIP_SKILL_NAMES:
            continue
        fields: dict[str, str] = {}
        for ts_key in FIELD_MAP.values():
            # Single-quoted TS string literals; none of the catalog values
            # currently contain an escaped single quote.
            m = re.search(rf"{ts_key}:\s*'([^']*)'", entry)
            fields[ts_key] = m.group(1).strip() if m else ""
        # If two expert entries share a skillName, the first non-empty wins.
        if skill_name not in result or not any(result[skill_name].values()):
            result[skill_name] = fields
    return result


def main() -> None:
    config_side = load_config_side()
    ts_side = load_ts_side()

    problems: list[str] = []

    # Every skill-builder skill must have all four fields, a valid lens_domain,
    # a matching TS entry, and identical values on both sides.
    for slug, cfg_fields in config_side.items():
        missing = [k for k, v in cfg_fields.items() if not v]
        if missing:
            problems.append(
                f"'{slug}' config.yaml is missing catalog field(s): {', '.join(missing)}."
            )
            continue

        if cfg_fields["lens_domain"] not in VALID_LENS_DOMAINS:
            problems.append(
                f"'{slug}' config.yaml lens_domain='{cfg_fields['lens_domain']}' is invalid "
                f"(must be one of {sorted(VALID_LENS_DOMAINS)})."
            )

        if slug not in ts_side:
            problems.append(
                f"'{slug}' has catalog fields in config.yaml but is not registered in "
                f"HARMENCE_EXPERTS (harmence-experts.ts) — its expert card can never render."
            )
            continue

        for cfg_key, ts_key in FIELD_MAP.items():
            cfg_val = cfg_fields[cfg_key]
            ts_val = ts_side[slug].get(ts_key, "")
            if cfg_val != ts_val:
                problems.append(
                    f"'{slug}' {cfg_key} mismatch: config.yaml='{cfg_val}' "
                    f"vs harmence-experts.ts {ts_key}='{ts_val}'."
                )

    # A registered expert backed by a skill-builder skill must have config too.
    for skill_name in ts_side:
        if skill_name not in config_side:
            problems.append(
                f"'{skill_name}' is registered in harmence-experts.ts but has no matching "
                f"skill-builder config.yaml (slug not found) — add the catalog fields there "
                f"or add it to SKIP_SKILL_NAMES if it is intentionally hand-authored."
            )

    print(f"config.yaml side:         {config_side}")
    print(f"harmence-experts.ts side: {ts_side}")
    print()

    if problems:
        print(f"[FAIL] {len(problems)} catalog sync issue(s):\n")
        for p in problems:
            print(f"  • {p}")
        sys.exit(1)

    print("[OK] expert-card catalog fields are in sync across config.yaml and harmence-experts.ts")


if __name__ == "__main__":
    main()
