# ShouldI Product Experience Audit

Use this checklist for weekly product QA and pre-release sign-off.

## How to Use

- Audit each core surface: Explore, Decide, Outcome Replay, Profile.
- Mark each item: `pass`, `revise`, or `cut`.
- A release candidate must pass all P0 items.

## Decision Context

- [ ] Is the user's decision moment clearly defined?
- [ ] Is the primary user question obvious?

## Global P0 Checks

- [ ] Primary action is obvious in under 3 seconds.
- [ ] Screen has one dominant visual focus.
- [ ] Copy is aligned to Quiet Intelligence tone.
- [ ] Confidence and uncertainty are visible where recommendations are shown.
- [ ] No legacy naming (`Plot Deck`, `Decision Snapshot`, `Decision Profile`).
- [ ] User knows what to do next before leaving the screen.

## Explore Checklist

- [ ] Feed entries present a clear decision question.
- [ ] Vote action is easy, direct, and low-friction.
- [ ] AI perspective appears at the right moment (not anchoring before interaction).
- [ ] Path to Outcome Replay is visible from Explore.
- [ ] Card density remains scannable on first glance.
- [ ] Explore encourages participation before consumption.

## Decide Checklist

- [ ] Intake flow asks only necessary follow-ups.
- [ ] Final state includes recommendation + why + next action.
- [ ] Recommendation appears before extended reasoning.
- [ ] Tradeoffs are explicit and concise.
- [ ] Confidence is shown with explanation (not raw score only).
- [ ] User autonomy language is present and clear.

## Outcome Replay Checklist

- [ ] User can log prediction, outcome, and reflection quickly.
- [ ] Prediction vs reality comparison is clear at a glance.
- [ ] Calibration guidance is concrete, not abstract.
- [ ] Replay feels valuable, not administrative.
- [ ] Replay teaches something the user can apply next time.
- [ ] Return path to next decision is obvious.

## Decision Lens / DNA Checklist

- [ ] Decision Lens appears after meaningful completion.
- [ ] Lens language is actionable and non-diagnostic.
- [ ] Blind spots are framed as improvable patterns.
- [ ] DNA explains patterns, not personality.
- [ ] DNA is presented as user-owned and editable where appropriate.
- [ ] DNA does not block first-session value.

## Motion and Interaction Quality

- [ ] Motion is smooth and supports comprehension.
- [ ] Haptics are meaningful and sparse.
- [ ] Reduced motion behavior is safe and usable.
- [ ] No distracting animation loops in high-focus moments.
- [ ] Motion never delays task completion.
- [ ] Loading and error states keep user orientation.

## Trust and Safety

- [ ] Uncertainty is disclosed in high-stakes recommendations.
- [ ] No manipulative urgency patterns.
- [ ] No overconfident deterministic claims.
- [ ] Source/rationale is available when needed.
- [ ] Recommendation ownership remains with the user.
- [ ] User can recover from mistakes without dead ends.

## PMF Instrumentation QA

- [ ] `decision_completed` fires on meaningful completion.
- [ ] `action_committed` fires when user commits next step.
- [ ] `outcome_replayed` fires when replay data is saved.
- [ ] First meaningful decision time is measurable.
- [ ] Confidence and replay signals are measurable.
- [ ] PMF dashboard can compute DRR from current events.

## Audit Summary Template

Use this at the end of each audit:

- Surfaces audited:
- P0 pass rate:
- Top 3 revise items:
- Top 3 cut candidates:
- PMF risk notes:
- Owner + deadline for fixes:
- Decision:
  - Release
  - Release with fixes
  - Block release

## v1.0 Freeze Policy

This audit is the release standard baseline.

Do not expand it with tactical one-off checks unless they generalize to recurring release quality.
