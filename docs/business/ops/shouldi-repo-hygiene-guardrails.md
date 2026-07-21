# ShouldI Repo Hygiene Guardrails

This document defines lightweight repository hygiene rules to prevent drift and review noise.

## Scope

Applies to `@shouldi/mobile`, `@shouldi/api`, shared contracts, and all docs under `docs/`.

## Naming Rules

- Use **Outcome Replay** for user-facing language.
- Keep legacy aliases (for example `plot-deck`) only as compatibility shims during migration windows.
- Avoid introducing new user-visible legacy terms in copy, labels, or routes.

## Docs Rules

- Every new active doc must be indexed in `docs/README.md`.
- If a doc references another doc, that target must exist at merge time.
- Update `README.md` / `CONTRIBUTING.md` when contributor-critical docs are added.

## UI Style Rules

- Core PMF surfaces must use theme semantics (`themeSurface`, `semantic`) rather than ad-hoc color literals.
- New UI components should import from `@/components/ui` canonical entry points.
- Compatibility aliases are allowed temporarily but should be marked deprecated.

## PR Hygiene Rules

- Resolve mixed git states for touched files before review (avoid staged/unstaged split in one file).
- Keep changes clustered by concern (contracts, API, mobile, docs) to simplify review.
- Call out compatibility shims and planned removal windows in PR description.
