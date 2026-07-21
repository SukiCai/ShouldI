# ShouldI Content Style Guide

This is the writing and AI-response execution spec.

## Voice

- Calm, direct, and respectful
- Confident but never absolute
- Practical and specific
- Human and non-judgmental

## Tone (What to Avoid)

- Hypey AI language ("super intelligence", "revolutionary", "magic")
- Technical overload ("Bayesian posterior interval" in user-facing copy)
- Pressure tactics or fear-based urgency
- Overlong explanatory paragraphs

## Core Message Pattern

All decision outputs should follow:

1. **Recommendation** (what to do)
2. **Rationale** (why this path)
3. **Tradeoffs** (what you give up)
4. **Confidence** (how sure and why)
5. **Next action** (what to do now)

## Microcopy Principles

- Prefer verbs over nouns (`Compare offers` vs `Offer comparison`)
- Prefer short UI strings (2-6 words for labels/buttons)
- Prefer concrete nouns (`Outcome Replay`) over abstract names (`Learning Module`)
- Use sentence case for most UI labels

## Button and CTA Language

Good:

- `Get recommendation`
- `Save outcome`
- `Open Outcome Replay`
- `Commit next step`

Bad:

- `Run analysis`
- `Generate intelligence`
- `Optimize decision matrix`

## Confidence Language

Use:

- `Confidence: 74/100`
- `Why confidence is moderate: ...`
- `What could change this recommendation: ...`

Do not use:

- `Guaranteed`
- `Best possible`
- `Certain outcome`

## Outcome Replay Language

Preferred pattern:

- `You predicted...`
- `What happened...`
- `What will you adjust next time...`

Avoid:

- `Reminder: update status`
- `Please complete this form`

## AI Transparency Language

When showing model output:

- Explain recommendation scope and limits.
- Distinguish facts, assumptions, and judgments.
- Keep the user as final decision-maker.

Required footer for high-stakes flows:

- `ShouldI helps structure the decision. Final judgment stays with you.`

## Naming Standards

Use these product terms consistently:

- Explore
- Decide
- Outcome Replay
- Decision Lens
- Decision DNA

Do not reintroduce legacy labels:

- Plot Deck
- Decision Snapshot
- Decision Profile
- Learn loop (in user-facing UI)

## Copy QA Checklist

Before shipping any screen or response template:

1. Can a stressed user parse this in under 10 seconds?
2. Is there one clear next action?
3. Is confidence framed honestly?
4. Is jargon removed?
5. Are product terms aligned with the naming standards above?
