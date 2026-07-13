# ShouldI UI Style Guardrails

This guardrail document operationalizes the design constitution for implementation and code review.

## Scope

Applies to all core PMF flows in `@shouldi/mobile`:

- Explore
- Decide
- Replay
- You
- Auth entry

## Token Mapping (Core)

Use semantic tokens first. Avoid direct color literals in feature screens.

- **Primary action:** `semantic.actionPrimary`
- **Affirmation / positive state:** `semantic.actionAffirm`
- **Warning / caution:** `semantic.actionCaution`
- **Danger / destructive:** `semantic.actionDanger`
- **Surface and text:** `themeSurface(scheme)`
- **Tab/profile chrome:** `resolveAppChromatics(isDark, surface)`

## Allowed vs Disallowed

- **Allowed**
  - `themeSurface()` for canvas/sheet/text/border
  - `semantic.*` for action semantics
  - `typography.*`, `spacing.*`, `radius.*` for layout and hierarchy
- **Disallowed (core PMF flows)**
  - New hardcoded hex colors in screens/components
  - New `rgba(...)` literals for standard surfaces/text/borders
  - Neon/OLED-only tokens for Explore/Decide/Replay/You default states

## Legacy Token Policy

Legacy neon tokens remain in the codebase for brand-entry and backward compatibility. They should not be introduced into new core PMF surfaces.

## PR Checklist (UI)

Every UI PR should confirm:

1. One clear primary action per screen.
2. Core surfaces use `themeSurface()` and semantic tokens, not ad-hoc literals.
3. Copy is calm, specific, and decision-oriented.
4. Confidence/uncertainty cues are visible where recommendations are shown.
5. No new visual language that conflicts with Quiet Intelligence.
