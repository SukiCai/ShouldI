# ShouldI Decision Framework Library (How)

## Purpose

This library is the reasoning operating system behind ShouldI.

LLMs may change.

Providers may change.

Framework quality should remain stable and improve over time.

---

## 1) Framework Object Spec

Each framework entry should contain:

* domain
* use case
* decision archetype
* key questions
* required inputs
* scoring or comparison method
* failure modes / bias risks
* output template
* confidence caveats

---

## 2) Domain Coverage (initial)

* Career
* Money / Investing
* Entrepreneurship
* Relationships
* Health (non-clinical lifestyle decisions)
* Life planning

---

## 3) Career Frameworks

### 3.1 BATNA Evaluation

Use when user is negotiating offer/role terms.

Core outputs:

* walk-away threshold
* leverage assessment
* negotiation scenario map

### 3.2 Regret Minimization

Use for irreversible or high-identity decisions.

Core outputs:

* short-term regret matrix
* long-term regret matrix
* asymmetry recommendation

### 3.3 Opportunity Cost Mapping

Use when user compares multiple role paths.

Core outputs:

* option A/B/C explicit tradeoff table
* cost of delay
* reversibility score

---

## 4) Money / Investing Frameworks

### 4.1 Expected Value (EV) Framing

Use when outcomes are probabilistic.

Core outputs:

* expected upside / downside
* variance awareness
* EV-adjusted recommendation

### 4.2 Risk Budgeting

Use when user has finite downside tolerance.

Core outputs:

* max acceptable drawdown
* exposure sizing guardrails
* risk concentration alerts

### 4.3 Scenario Stress Test

Use for uncertain macro environments.

Core outputs:

* base / bear / bull case
* breakpoints
* contingency actions

---

## 5) Entrepreneurship Frameworks

### 5.1 Asymmetric Bet Filter

Use for startup/venture choices.

Core outputs:

* upside asymmetry
* downside survivability
* expected learning value

### 5.2 Founder-Role Fit

Use for join vs start decisions.

Core outputs:

* skill-role alignment
* motivation durability
* execution gap map

---

## 6) Relationship Frameworks (non-clinical)

### 6.1 Values and Needs Alignment

Use for partner/team compatibility decisions.

Core outputs:

* aligned values
* conflict vectors
* negotiation requirements

### 6.2 Communication Pattern Audit

Use when conflict recurs.

Core outputs:

* trigger map
* response cycle
* de-escalation options

---

## 7) Universal Meta-Frameworks

### 7.1 Reversibility

Is this decision reversible?

If yes, bias toward action + fast feedback.

If no, bias toward deeper due diligence.

### 7.2 Time Horizon Split

Evaluate effects at:

* 1 month
* 1 year
* 5 years

### 7.3 Confidence Calibration

Ask:

* How sure am I?
* What would falsify this?
* What evidence am I missing?

---

## 8) Behavioral Overlay

For every framework run, check:

* loss aversion
* confirmation bias
* planning fallacy
* overconfidence
* status quo bias
* sunk-cost pull

Goal:

Inject counter-questions before recommendation finalization.

---

## 9) Framework Quality Bar

A framework is valid only if it:

* improves clarity under uncertainty
* produces actionable output
* has explicit assumptions
* exposes tradeoffs
* supports outcome review later

---

## 10) Iteration Process

1. framework deployed
2. decision outcome observed
3. calibration analysis
4. framework update proposal
5. version bump and changelog

This creates a framework compounding loop parallel to model improvement.
