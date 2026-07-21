# ShouldI UI PR Checklist

Use this checklist in every UI pull request touching product surfaces.

## Design Consistency

- [ ] Uses `themeSurface()` and semantic tokens for colors.
- [ ] Avoids new hardcoded color literals for core UI surfaces.
- [ ] Preserves established spacing/radius/typography tokens.
- [ ] Keeps one primary action visually dominant per screen.

## Decision Clarity

- [ ] A first-time user can identify the next action in under 3 seconds.
- [ ] Recommendation-oriented surfaces expose confidence and uncertainty clearly.
- [ ] Copy remains calm, concise, and decision-oriented.

## Quality Gate

- [ ] Explore / Decide / Replay / You / Auth changes reviewed for style parity.
- [ ] Dark and light mode inspected.
- [ ] No legacy naming regressions in user-visible text.
- [ ] If introducing a new visual semantic, rationale is documented in PR description.
