# ShouldI Product Bible (What) — PRD Master

## 1) Product Scope

ShouldI product system is organized around three compounding loops:

* Explore (perspective + signal)
* Decide (structured judgment)
* Outcome Replay (prediction vs reality + calibration)

Primary objective:

Increase user judgment quality over time, not just session-level satisfaction.

---

## 2) Product Surface Map

### Explore

Purpose:

Expose users to diverse real-world dilemmas and decision patterns.

Core actions:

* browse cards
* vote
* predict outcomes
* compare with AI/community
* discuss reasoning

Success output:

Users build better intuition and question framing.

### Decide

Purpose:

Guide users through a structured, high-signal decision process.

Core actions:

* define question and constraints
* choose mode (single expert / council)
* answer adaptive prompts
* review recommendation + confidence + tradeoffs
* commit next action

Success output:

User can act with clarity and calibrated confidence.

### Learn

Purpose:

Turn outcomes into long-term judgment compounding.

Core actions:

* revisit past decision
* compare prediction vs outcome
* reflect
* update Decision DNA

Success output:

Future decisions improve measurably.

---

## 3) User States and Journey

1. **Unclear**: user has anxiety/ambiguity and no structure
2. **Structured**: user sees constraints, options, and uncertainty
3. **Committed**: user chooses and executes
4. **Validated**: user returns with outcome data
5. **Compounded**: user profile (Decision DNA) improves

Design rule:

Every feature should move users forward in this state machine.

---

## 4) Core Product Requirements

### 4.1 Explore Requirements

* decision cards with clear question/options
* social signal (distribution + participation)
* AI perspective surfaced after interaction (avoid anchoring before vote)
* discussion previews with quality controls

### 4.2 Decide Requirements

* adaptive interview flow, not static questionnaire
* explicit tradeoffs and uncertainty representation
* confidence calibration and rationale transparency
* council mode with multi-expert synthesis

### 4.3 Learn Requirements

* outcome logging and revisit triggers
* prediction vs reality comparison
* concise reflection prompts
* Decision DNA update events

---

## 5) Decision DNA Product Spec

Decision DNA should include:

* values and priorities
* risk preference and risk calibration
* recurring blind spots
* planning/forecasting patterns
* confidence behavior
* learning trajectory markers

User-facing expectations:

* transparent, editable where appropriate
* never presented as clinical diagnosis
* used to personalize questioning and recommendations

---

## 6) Behavioral Intelligence Layer

Behavioral modeling scope:

* loss aversion
* confirmation bias
* planning fallacy
* overconfidence
* status quo bias
* sunk cost patterning

Operational requirement:

Behavioral outputs should be used to:

* ask better follow-ups
* reveal hidden assumptions
* improve recommendation calibration

not to label or pathologize users.

---

## 7) Trust & UX Requirements

* uncertainty must be explicit
* confidence must be calibrated (not overconfident)
* user autonomy must be preserved (AI assists, user decides)
* language should be calm, non-judgmental, and transparent
* avoid manipulative urgency or dark patterns

---

## 8) Instrumentation Requirements

Track at minimum:

* session completion
* action taken intent
* outcome revisit rate
* confidence deltas
* prediction accuracy deltas
* blind-spot recurrence reduction

North-star linkage:

Weekly Meaningful Decisions Resolved.

---

## 9) MVP vs Post-MVP

### MVP (must ship)

* Explore + vote + baseline social signal
* Decide structured flow (single + council)
* basic Learn revisit with reflection
* Initial Decision DNA (core attributes only)

### Post-MVP (phase expansion)

* Decision Score
* Judgment Timeline
* Decision Gym
* Digital Judgment Twin

---

## 10) Product Governance

Feature admission criteria:

1. improves judgment quality
2. strengthens Decision DNA signal
3. supports long-term retention compounding
4. increases trust and user autonomy
5. creates durable advantage vs generic AI

If feature fails most criteria, do not ship.