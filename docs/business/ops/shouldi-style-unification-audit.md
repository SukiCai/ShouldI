# ShouldI Style Unification Audit

Date: 2026-07-12

## Surfaces audited

- Explore
- Decide
- Replay
- You
- Auth entry

## Passes

- Core tabs now rely on `themeSurface()` tokens for canvas/text/border semantics.
- Dark-mode app chromatics were de-neonized for core PMF flows.
- Shared UI primitives now expose clearer semantic usage (`Button` intent, `Card` subtle variant, `AppText` hero export).
- Auth entry switched from OLED-heavy variant to mist variant to reduce style discontinuity with core tabs.

## Revise next

- Decide council visuals still intentionally expressive; keep monitoring to ensure they remain subordinate to recommendation clarity.
- Legacy neon token usage still exists in non-core and legacy components; do not spread into new PMF work.

## Guardrails added

- `docs/business/ops/shouldi-ui-style-guardrails.md`
- `docs/business/ops/shouldi-ui-pr-checklist.md`

## Decision

- Release with fixes
