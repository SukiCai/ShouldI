# ShouldI Design Principles

This is the design constitution for product, UI/UX, prompt surfaces, and review decisions.

## Success Definition

The best screen is not the one users remember.

It is the one after which users know what to do next.

If users hesitate, the design has failed.

## Design Philosophy

Interfaces should disappear.

Users should leave remembering their decision, not our product.

Every pixel exists to reduce uncertainty.

Good design reduces decisions about the interface, so users can focus on their own decisions.

## Design Language

ShouldI design language is **Quiet Intelligence**:

- Calm
- Minimal
- Clear
- Human
- Confident
- Thoughtful
- Premium
- Never flashy
- Never overwhelming

## Design Inspirations

Apple

Visual restraint.

Interaction quality.

Craftsmanship.

Linear

Information hierarchy.

Workflow clarity.

Perplexity

Transparent AI.

Trust.

Reasoning presentation.

We learn principles, not appearances.

## Core Design Mission

The decision should feel easier than the interface.

## Product-to-UI Translation

- People come for clarity -> first screen must present an obvious next action.
- They stay for better judgment -> replay and calibration should feel useful, not administrative.
- Confidence loop -> every completed flow must increase clarity, action confidence, or commitment.

## Question Hierarchy

Every screen should answer, in order:

1. Where am I?
2. What should I do?
3. Why should I trust this?
4. What happens next?

## Trust Hierarchy

Trust is earned through:

- Clear recommendation
- Transparent reasoning
- Honest uncertainty
- Consistent behavior
- Outcome accountability

Never fake certainty.

Never hide uncertainty.

Confidence is communicated, not exaggerated.

## Writing Principles

Write like a trusted advisor.

Every sentence should reduce uncertainty.

If a sentence does not change a decision, remove it.

## Reduction Principle

When in doubt, remove.

Whitespace is a feature.

Every additional element must justify its existence.

## Consistency Principle

Similar decisions should feel similar.

Users should recognize patterns, not relearn interfaces.

## 10 Rules (Must Follow)

1. **One primary action per screen.** Secondary actions are visually subordinate.
2. **No cognitive dump on entry.** Do not show all systems (DNA, replay, council, analytics) at once.
3. **Recommendation must close each flow.** End with `what to do`, `why`, `what to watch`.
4. **Complexity is progressive.** Show only what is needed for the current step.
5. **Uncertainty is explicit.** Confidence and caveats are visible, concise, and non-alarmist.
6. **Motion should reduce uncertainty.** Transitions explain context changes; animation is communication, not decoration.
7. **Typography carries hierarchy.** Large title, short support copy, predictable scan path.
8. **Every card is actionable.** If a card cannot produce a user action, remove or redesign it.
9. **Trust over novelty.** Source, rationale, and consistency beat visual gimmicks.
10. **Calm by default.** Color and emphasis are reserved for state change and critical guidance.

## Anti-Patterns

If a feature exists mainly to showcase AI, it probably should not exist.

If users need an explanation before using a screen, the screen should be redesigned.

If removing an element improves clarity, remove it.

## PMF Guardrail

A feature must satisfy at least one:

- Improves first-decision clarity
- Increases action confidence
- Improves outcome replay
- Improves calibration

Otherwise, defer.

## Permanent Visual Constraints

- Avoid neon/cyber/futuristic visual language in core PMF flows.
- Avoid glow-heavy AI aesthetics and robot metaphors.
- Avoid dense dashboards before PMF validation.
- Avoid hidden navigation patterns that increase decision latency.

## Permanent Product Constraints

- Never optimize for more thinking when more clarity is possible.
- Never delay first-session value to demonstrate intelligence.
- Never mistake longer reasoning for better decisions.
- Never optimize engagement over outcomes.

## Screen Acceptance Criteria

A screen passes design review only if:

- A first-time user can identify the next action within 3 seconds.
- The screen has one clear focal point.
- Body copy is concise and non-jargony.
- It contributes directly to Explore, Decide, Outcome Replay, or Decision Lens.
- Removing this screen would make the user's decision worse.

## Review Ritual

Use this in every design review:

1. State the user decision moment.
2. Name the single primary action.
3. Show confidence/trust mechanism.
4. Verify no rule violations above.
5. Decide: ship, revise, or cut.

## Founder Rule

When principles conflict, choose the option that reduces user uncertainty the most.

## Constitution Freeze Policy

This constitution is intentionally stable.

Do not add tactical rules here.

Route tactical detail to:

- Design review checklist
- Content style guide
- Component constitution
- Prompt constitution
- UI style guardrails
