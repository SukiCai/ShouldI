# ShouldI Component Constitution

This document defines how component specs are written and reviewed.

For each core component, document only:

- Purpose
- When to use
- When not to use
- Interaction behavior
- Motion behavior
- Accessibility expectations

Do not encode temporary visual style choices as constitutional rules.

## Core Components

- Button
- Card
- Bottom Sheet
- Decision Card
- Recommendation Card
- Confidence Bar
- Tradeoff Chip
- Source Citation
- Outcome Replay Timeline

## Component Rules

1. Every component must reduce uncertainty in its context.
2. Similar intents should use similar components.
3. Components must preserve one primary action at a time.
4. Motion must explain state changes, never distract.
5. Accessibility is required, not optional.

## Rejection Criteria

Reject a component proposal if:

- it exists mainly to showcase AI;
- it duplicates an existing component pattern;
- it adds visual novelty without improving decision quality.
