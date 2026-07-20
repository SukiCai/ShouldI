#!/usr/bin/env python3
"""Consistency gate: location-precheck flags must agree on both sides of the stack.

Two independent systems each decide "does this skill need to establish the
user's country before giving advice":

  1. skill-builder/skills/<dir>/config.yaml  →  requires_location_precheck: true
     (drives SKILL.md content generation — Step 0 section + frontmatter flag)

  2. apps/api/src/harmence-experts.ts  →  requiresLocationPrecheck: true
     (drives the runtime interview loop — forces the location question before
     any other choicePrompt when an active expert needs it)

These used to be kept in sync by hand (a slug had to be manually added to a
hardcoded list in hermes-prompts.ts). This script catches drift automatically:
run it after adding/removing a skill or flipping either flag.

Usage:
    python scripts/check_location_sync.py
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import load_config

SKILL_BUILDER_ROOT = Path(__file__).parent.parent  # skill-builder/
REPO_ROOT = SKILL_BUILDER_ROOT.parent.parent  # ShouldI/
HARMENCE_EXPERTS_TS = REPO_ROOT / "apps" / "api" / "src" / "harmence-experts.ts"

# smart_talk is the generic decision-strategy / relationship skill, not one of
# the skill-builder pipeline skills — it never carries country-specific content.
SKIP_SKILL_NAMES = {"smart_talk"}


def load_config_side() -> dict[str, bool]:
    """slug -> requires_location_precheck, for every skill-builder skill."""
    skills_root = SKILL_BUILDER_ROOT / "skills"
    result: dict[str, bool] = {}
    for skill_dir in sorted(skills_root.iterdir()):
        if not (skill_dir / "config.yaml").exists():
            continue
        config = load_config(skill_dir)
        slug = config.get("slug")
        if not slug:
            continue
        result[slug] = bool(config.get("requires_location_precheck", False))
    return result


def load_ts_side() -> dict[str, bool]:
    """skillName -> requiresLocationPrecheck, parsed from HARMENCE_EXPERTS in the TS catalog."""
    if not HARMENCE_EXPERTS_TS.exists():
        sys.exit(f"Cannot find {HARMENCE_EXPERTS_TS} — is the repo layout as expected?")

    text = HARMENCE_EXPERTS_TS.read_text(encoding="utf-8")

    # Slice out each top-level object literal in the HARMENCE_EXPERTS array by
    # tracking brace depth from the array's opening bracket.
    array_start = text.index("HARMENCE_EXPERTS")
    # Skip past "HarmenceExpert[] = " so we land on the array literal's '[',
    # not the empty [] in the preceding type annotation.
    body_start = text.index("= [", array_start) + 2
    depth = 0
    entries: list[str] = []
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
                entries.append(text[entry_start:i + 1])
                entry_start = None
        elif ch == "]" and depth == 0:
            break

    result: dict[str, bool] = {}
    for entry in entries:
        name_match = re.search(r"skillName:\s*'([^']+)'", entry)
        if not name_match:
            continue
        skill_name = name_match.group(1)
        if skill_name in SKIP_SKILL_NAMES:
            continue
        requires = bool(re.search(r"requiresLocationPrecheck:\s*true", entry))
        # If the same skillName appears on multiple expert entries, true wins.
        result[skill_name] = result.get(skill_name, False) or requires
    return result


def main() -> None:
    config_side = load_config_side()
    ts_side = load_ts_side()

    problems: list[str] = []

    for slug, required in config_side.items():
        if not required:
            continue
        if slug not in ts_side:
            problems.append(
                f"'{slug}' has requires_location_precheck: true in config.yaml "
                f"but is not registered in HARMENCE_EXPERTS (harmence-experts.ts) at all — "
                f"the runtime location-precheck can never fire for it."
            )
        elif not ts_side[slug]:
            problems.append(
                f"'{slug}' has requires_location_precheck: true in config.yaml "
                f"but its HARMENCE_EXPERTS entry does not set requiresLocationPrecheck: true."
            )

    for skill_name, required in ts_side.items():
        if not required:
            continue
        if skill_name not in config_side:
            problems.append(
                f"'{skill_name}' has requiresLocationPrecheck: true in harmence-experts.ts "
                f"but has no matching skill-builder config.yaml (slug not found) — "
                f"verify this skill's SKILL.md actually has a Step 0 section."
            )
        elif not config_side[skill_name]:
            problems.append(
                f"'{skill_name}' has requiresLocationPrecheck: true in harmence-experts.ts "
                f"but its skill-builder config.yaml does not set requires_location_precheck: true."
            )

    print(f"config.yaml side:        {config_side}")
    print(f"harmence-experts.ts side: {ts_side}")
    print()

    if problems:
        print(f"[FAIL] {len(problems)} location-precheck sync issue(s):\n")
        for p in problems:
            print(f"  • {p}")
        sys.exit(1)

    print("[OK] location-precheck flags are in sync across config.yaml and harmence-experts.ts")


if __name__ == "__main__":
    main()
