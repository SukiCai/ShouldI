# ShouldI UI Style Guardrails

This guardrail document operationalizes the design constitution for implementation and code review.

## Scope

Applies to all core PMF flows in `@shouldi/mobile`:

- Explore
- Decide
- Replay
- You
- Auth entry

Auth entry uses the **OLED billboard** chrome (`GenZAuthChrome` `appearance="oled"`) as an intentional brand-entry exception — black hero band + half-screen white notch sheet. Core tabs remain mist / Quiet Intelligence.

Auth sheet hierarchy (aligned with progressive disclosure + mobile signup research):

1. Link toggle (Sign In ↔ Sign Up) — not a segment control
2. Social continue (Apple / Google) — fastest path, above phone
3. Quiet `or use phone` divider
4. Phone + password (Sign Up: phone step → password step)
5. Forgot password on Sign In only
6. **Docked** primary CTA in the bottom scoop (`ctaPlacement="docked"`) — one button, never duplicated in-sheet

Defer account creation until after first meaningful decision when product allows (PMF Principle #5). Explore triggers `SaveProgressSheet` after the guest's first vote (`lib/guestSignupPrompt.ts`).

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
