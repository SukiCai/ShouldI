# Repo Change Clusters Baseline

This file is the non-destructive cleanup baseline for the current working tree.

## Cluster Summary

- **contracts**
  - `packages/contracts/src/index.ts`
- **api-lifecycle-and-routing**
  - `apps/api/src/decision-lifecycle.ts`
  - `apps/api/src/index.ts`
  - `apps/api/src/harmence-interview.ts`
  - `apps/api/src/hermes-prompts.ts`
  - `apps/api/src/explore-seed.ts`
- **mobile-core-flows**
  - `apps/mobile/app/(tabs)/explore.tsx`
  - `apps/mobile/app/(tabs)/decide/*`
  - `apps/mobile/app/plot-deck.tsx`
  - `apps/mobile/app/(tabs)/replay.tsx`
  - `apps/mobile/app/outcome-replay/[id].tsx`
  - `apps/mobile/app/(tabs)/you.tsx`
- **mobile-ui-system**
  - `apps/mobile/constants/theme.ts`
  - `apps/mobile/constants/appChromatics.ts`
  - `apps/mobile/components/ui/*`
  - `apps/mobile/components/auth/GenZAuthChrome.tsx`
- **docs-foundation**
  - `docs/README.md`
  - `docs/engineering/*`
  - `docs/business/**/*`
  - `README.md`
  - `CONTRIBUTING.md`

## Cleanup Order

1. Stabilize mixed-status files and normalize review surface.
2. Complete docs indexing and invalid reference fixes.
3. Align naming with Outcome Replay alias-first strategy.
4. Consolidate component entry points and import paths.
5. Add governance guardrails for anti-regression.

## Notes

- This baseline is intentionally additive and non-destructive.
- Route aliases should remain during migration to avoid deep-link breakage.
