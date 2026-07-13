# ShouldI Design Review Checklist

Use this checklist for Figma reviews, UI PRs, and release sign-off.

Implementation guardrails:
- `docs/business/ops/shouldi-ui-style-guardrails.md`
- `docs/business/ops/shouldi-ui-pr-checklist.md`

When to use which checklist:
- UI PR implementation quality: `docs/business/ops/shouldi-ui-pr-checklist.md`
- Product release readiness audit: `docs/business/ops/shouldi-product-experience-audit.md`
- Constitutional principles and acceptance: `docs/business/ops/shouldi-design-principles.md`

## Decision Context

- [ ] Is the user's decision moment clearly defined?
- [ ] Is the primary user question obvious?

## Core UX

- [ ] Can a new user understand the next action in 3 seconds?
- [ ] Is there exactly one primary action?
- [ ] Does this reduce uncertainty?
- [ ] Does this reduce cognitive load?
- [ ] Is every visible element necessary?
- [ ] Would removing this screen make the decision worse?
- [ ] Can anything be removed without hurting the decision?
- [ ] Is the interface calmer than before?

## Flow Checks

- [ ] Does this screen naturally lead to the next step?
- [ ] Does the user always know what happens next?

## Writing Checks

- [ ] Every sentence reduces uncertainty.
- [ ] No AI jargon.
- [ ] No unnecessary explanation.

## PMF Checks

- [ ] Clarity
- [ ] Confidence
- [ ] Action
- [ ] Outcome Replay
- [ ] Calibration

If none apply, defer.

## Trust Checks

- [ ] Recommendation is clear.
- [ ] Recommendation feels actionable.
- [ ] Reasoning is transparent.
- [ ] Uncertainty is explicit.
- [ ] Tone is calm and non-hype.

## Complexity Check

- [ ] Could this screen work with one less section?
- [ ] Could this screen work with one less interaction?
- [ ] Could this screen work with fewer words?

## Review Verdict

Mark one:

- Ship
- Prototype
- Revise
- Cut
