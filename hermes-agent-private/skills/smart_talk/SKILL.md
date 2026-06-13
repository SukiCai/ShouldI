---
name: smart_talk
description: Structured clarifying conversation with semantic ambiguity scoring across four universal dimensions (intent/reality/signal/stakes) — works for tech tasks, decisions, and life questions alike
version: 1.1.0
metadata:
  hermes:
    tags: [interview, planning, clarification, ambiguity, decision, requirements]
    related_skills: [intl-job-search, intl-student-advisor, pm-career-expert, stay-or-return, grad-school-advisor]
---

# Smart Talk: Socratic Clarification

## Overview

Smart Talk reduces ambiguity through a focused conversation before acting. You ask one targeted question per round, semantically score clarity across four dimensions, and maintain a `cumulative_analysis` as your working memory. Stop when ambiguity ≤ 20% or the user says to proceed.

**Required tools:** `smart_talk_state`, `clarify`, `write_file`

**Optional domain skill tool-calls (Step C.5):** `intl-job-search`, `intl-student-advisor`, `pm-career-expert`, `stay-or-return`, `grad-school-advisor` — call these when the targeted dimension requires specialized domain knowledge. Available skills are listed in the session context provided by the caller.

**Dimensions and weights:**
| Dimension | Weight | What it captures |
|-----------|--------|-----------------|
| **Intent** | 35% | What the person truly wants — functional AND emotional outcome |
| **Reality** | 25% | What's already fixed, what's flexible, what context they're in |
| **Signal** | 25% | How they'll recognize success or improvement |
| **Stakes** | 15% | How important/reversible this is, what's at risk |

---

## Phase 1: Initialize

1. Call `smart_talk_state(action="get", session_id=<session_id>)` to load or init state.
   - If no state exists, the tool returns an empty scaffold — treat as round 0.
2. Announce naturally — do NOT reveal the scoring system or that a structured process is running:
   > "Let me make sure I fully understand what you're looking for before diving in."
3. Output initial state JSON — **you MUST output this before asking anything. Do NOT skip to analysis.**
```json
{"round": 0, "ambiguity": 1.0, "pre_scores": {"intent": 0.0, "reality": 0.0, "signal": 0.0, "stakes": 0.0}, "status": "started"}
```

---

## Phase 2: Interview Loop

> **PROCEDURE — follow exactly, one step at a time. Do NOT skip ahead or combine steps.**
> Every round MUST end with a single `clarify()` tool call. No exceptions.
> Never write questions, checkboxes, or option lists as text — the `clarify()` tool is the ONLY valid way to ask anything.

Repeat until `ambiguity_after ≤ 0.20` OR user says proceed/enough/let's go.

### Step A: Score the most recent answer

Evaluate `cumulative_analysis` semantically — you are the scorer, not a keyword matcher.

For each dimension, ask yourself:
- **Intent** (0.35): Do I know what they're truly trying to achieve or feel? Can I state it in one sentence without guessing? (Covers functional goals AND emotional outcomes — "I want to feel less anxious" counts.)
- **Reality** (0.25): Do I understand their current situation? What constraints are fixed vs flexible? What have they already tried? What resources or context are they working with?
- **Signal** (0.25): What would tell them it's working? Is there a concrete observable change — behavioral, emotional, functional — that marks progress or completion?
- **Stakes** (0.15): How much does this matter to them? Is this decision reversible? What's the cost of getting it wrong or doing nothing?

Assign a score 0.0–0.90 per dimension. Update `cumulative_analysis`:

```json
{
  "intent": {
    "score": 0.65,
    "established_facts": ["wants to change jobs", "driven by lack of growth, not money", "targeting product roles"],
    "gaps": ["unclear what 'growth' means to them specifically"]
  },
  "reality": {"score": 0.30, "established_facts": ["3 years at current company", "has 2 offers"], "gaps": ["family/financial constraints unknown"]},
  "signal": {"score": 0.0, "established_facts": [], "gaps": ["no success signal defined"]},
  "stakes": {"score": 0.50, "established_facts": ["decision is time-sensitive", "feels nervous"], "gaps": ["reversibility unclear"]},
  "rounds_completed": 2,
  "challenge_modes_used": [],
  "ontology": ["Career change", "Growth", "Product role"]
}
```

Compute: `ambiguity = 1 - (intent × 0.35 + reality × 0.25 + signal × 0.25 + stakes × 0.15)`

### Step B: Compute pre/post scores

- `pre_scores` = scores from the PREVIOUS round's cumulative_analysis
- `post_scores` = scores just computed in Step A

### Step C: Target the weakest dimension

Select the dimension with the lowest score. Use the question bank below at the appropriate depth (depth = number of times this dimension has been targeted).

**Challenge modes** (apply once each, inject into your question framing):
- Round 4+: **Contrarian** — challenge a core assumption ("What if this constraint isn't as fixed as it seems?")
- Round 6+: **Simplifier** — probe for unnecessary complexity ("What's the minimum version of this that would still matter?")
- Round 8+ (if ambiguity > 0.30): **Reframer** — zoom out on the core concept ("You've mentioned {ontology}. Which one is the real thing you're trying to change?")

### Step C.5: Domain Check

After selecting the target dimension in Step C, before generating the question:

1. Check the session context for **available domain skills** (provided by the caller in the current message).
2. Ask: "For the dimension I'm targeting AND the specific topic of this decision, does any available domain skill have specialized frameworks that would produce a sharper question?"

**When domain calls are most valuable:**

| Dimension | Domain call likely useful |
|-----------|--------------------------|
| **Reality** | Almost always — domain skills know which constraints are decision-critical in their field |
| **Signal** | Often — domain skills know what "success" looks like in their field |
| **Intent** | Rarely — intent is universal; only call if the domain has specific goal taxonomies |
| **Stakes** | Rarely — stakes are universal; only call if the domain has specific risk classifications |

**Decision matrix:**
- `reality` + career / job / offer / co-op → call `intl-job-search`
- `reality` + visa / immigration / permit / study permit → call `intl-student-advisor`
- `reality` or `signal` + PM / promotion / career path → call `pm-career-expert`
- `reality` or `signal` + stay abroad / return home / relocation / green card backlog → call `stay-or-return`
- `reality` or `intent` + grad school / PhD / Masters / immigration runway via grad school → call `grad-school-advisor`
- `intent` or `stakes` + any topic → proceed without a domain call in most cases

3. If a domain call is warranted: invoke the skill as a tool call to get relevant framework knowledge. Use that knowledge when generating the question in Step D.
4. If no domain call is warranted: proceed directly to Step D.
5. Record which domain skills were called this turn in `domainSkillsCalledThisTurn` in the JSON output (Step E).

### Step D: Ask the question

**STRICT RULES — these are hard constraints, not suggestions:**
1. Call `clarify()` **exactly once** this round. Never more.
2. **Never** write the question or choices as plain text or markdown — they will be rendered as interactive buttons by the UI. No `?` in your response text.
3. **Never** output `[ ]` checkbox lists or bold option lists — use `clarify()` choices instead.
4. **Never** ask about multiple dimensions or topics in a single round.
5. **Never** include "Other" or "Type your answer" in choices — the UI appends an "Other…" button automatically.
6. After calling `clarify()`, **stop**. Output the JSON block (Step E), then wait for the user's response before starting the next round.

Call `clarify(question=<next_question>, choices=<choices>)`.

**Question mode depends on dimension depth and score — choose exactly one:**

**EXPLORATION MODE** — use when targeting a dimension for the first time (depth=0) AND score < 0.30:
- Generate up to 4 concrete, specific options covering the most likely paths for this dimension given context you already have.
- Pass these as `choices`. Do NOT use Yes/No as choices. Do NOT include "Other" — the UI appends it automatically.
- Goal: collapse multiple rounds into one by letting the user self-select their path.
- Example for Intent (user considering two job offers): `choices = ["Career growth & faster progression", "More interesting / technical work", "Better work-life balance", "Higher compensation"]`

**CONFIRMATION MODE** — use when depth > 0 OR score ≥ 0.30:
- Bake BOTH paths into the question text itself so the answer is self-evident without explanation.
- Bad: "Is your main driver career growth?" → user wonders "if yes, then what?"
- Good: "Are you optimizing for faster career growth over staying for stability — even if it means leaving your current company?"
- Choices are always exactly: `["Yes", "No", "Type your answer"]`
- **Never** write "If YES → ..., If NO → ..." anywhere — the question must be fully self-contained.

### Step E: Update state and output structured JSON

Persist via `smart_talk_state(action="set", session_id=..., state=<cumulative_analysis>)`.

**Output this JSON block every round** (apps consume this):
```json
{
  "round": 2,
  "dimension_targeted": "signal",
  "dimension_rationale": "intent and stakes are clear but no success signal has been defined",
  "domainSkillsCalledThisTurn": [],
  "pre_scores": {"intent": 0.65, "reality": 0.30, "signal": 0.0, "stakes": 0.50},
  "post_scores": {"intent": 0.65, "reality": 0.30, "signal": 0.0, "stakes": 0.50},
  "ambiguity_before": 0.64,
  "ambiguity_after": 0.64,
  "ready_to_proceed": false,
  "intent": "<original request>"
}
```

---

## Question Bank

Use these as seed patterns. Generate context-specific variants — never copy-paste verbatim when you have enough context to make them specific.

**Depth 0 → EXPLORATION MODE**: offer concrete choices; tailor them to the topic.
**Depth 1+ → CONFIRMATION MODE**: yes/no question with both paths baked in.

### Intent
| Depth | Mode | Pattern |
|-------|------|---------|
| 0 | Exploration | Offer 3–5 specific outcomes the person might be seeking. E.g. for a job decision: `["Faster career progression", "More meaningful / technical work", "Better work-life balance", "Escape current environment", "Other..."]` |
| 1 | Confirmation | "Are you optimizing for [inferred goal A] over [inferred goal B] — even at the cost of [tradeoff]?" |
| 2 | Confirmation | "If this goes exactly right, would [specific observable change you inferred] happen within a month?" |

### Reality
| Depth | Mode | Pattern |
|-------|------|---------|
| 0 | Exploration | Offer 3–5 likely constraints. E.g.: `["Location is fixed", "Salary floor I can't go below", "Timeline / deadline pressure", "Family or personal obligations", "Other..."]` |
| 1 | Confirmation | "Have you already tried [most likely prior attempt based on context] and it didn't work?" |
| 2 | Confirmation | "Is [specific constraint you inferred] something you could change if the right option appeared, or is it truly fixed?" |

### Signal
| Depth | Mode | Pattern |
|-------|------|---------|
| 0 | Exploration | Offer 3–5 concrete success signals. E.g.: `["I'd feel less stressed day-to-day", "A specific metric improves", "I stop second-guessing the decision", "Someone external validates it", "Other..."]` |
| 1 | Confirmation | "Would [specific moment you inferred] be the clearest sign this worked — or is the bar higher than that?" |
| 2 | Confirmation | "Would you notice a first small sign of progress (like [concrete example]) before reaching the full goal?" |

### Stakes
| Depth | Mode | Pattern |
|-------|------|---------|
| 0 | Exploration | Offer 3–5 stakes framings. E.g.: `["High — hard to reverse if wrong", "Medium — recoverable but costly", "Low — easy to course-correct", "Time-sensitive / deadline", "Other..."]` |
| 1 | Confirmation | "Is the cost of doing nothing here — [inferred cost] — larger than the risk of deciding wrong?" |
| 2 | Confirmation | "Is there a deadline making this urgent, or could you take more time if needed?" |

---

## Phase 3: Crystallize

When `ambiguity_after ≤ 0.20` (or user chooses to proceed):

1. Generate a summary using `write_file`:
   - Path: `.hermes/specs/smart_talk-<slug>.md`
   - Contents: intent statement, reality/context, success signal, stakes, full Q&A transcript

2. Output final JSON:
```json
{"status": "complete", "ambiguity": 0.18, "spec_path": ".hermes/specs/smart_talk-<slug>.md", "ready_to_proceed": true}
```

3. Ask the user how to proceed.

4. Call `smart_talk_state(action="clear", session_id=<session_id>)` to clean up.

---

## Early Exit

If user says proceed / enough / let's go at any point after round 2:
- Warn if ambiguity > 0.20: "I still have a few open questions — there's a chance I'll need to check back with you mid-way. Proceed anyway?"
- If confirmed, jump directly to Phase 3.

## Force Prompt: 6-Step Inline Sequence

When the user explicitly asks for the "6 步程序" or wants to see the forced tool call sequence demonstrated, use this exact pattern:

### The 6 Steps

| Step | Action | Tool | Output |
|:--:|--------|------|--------|
| 1 | Initialize/Get state | `smart_talk_state(action="get")` | Returns scaffold or existing state |
| 2 | Find weakest dimension | Logic (min score) | Target dimension for this round |
| 3 | Construct question | Question Bank lookup | Question + choices for target dimension/depth |
| 4 | **Ask via tool call** | `clarify(question, choices)` | **Must be tool call, not text** |
| 5 | Update + persist | Score semantically → `smart_talk_state(action="set")` | Output JSON block with pre/post scores |
| 6 | Check threshold | If ambiguity > 20%: goto Step 2; else: Phase 3 | Final decision on continuation |

### Round-by-Round JSON Output Template

Every round must output this structured JSON (apps consume this):

```json
{
  "round": 3,
  "dimension_targeted": "signal",
  "dimension_rationale": "signal is lowest at 0.30; need success criteria",
  "domainSkillsCalledThisTurn": [],
  "pre_scores": {"intent": 0.65, "reality": 0.50, "signal": 0.30, "stakes": 0.40},
  "post_scores": {"intent": 0.65, "reality": 0.50, "signal": 0.55, "stakes": 0.40},
  "ambiguity_before": 0.53,
  "ambiguity_after": 0.47,
  "ready_to_proceed": false,
  "intent": "original user request summary"
}
```

### Sample Execution Log

```
=== Round 0 ===
Step 1-3: Init, weakest=intent(0.0), Q="理想结果?"
Step 4: clarify([...choices...]) → "工作内容变化"
Step 5-6: intent=0.35, ambiguity=0.88, continue

=== Round 1 ===
Step 2-3: weakest=reality(0.0), Q="有什么固定?"
Step 4: clarify([...]) → "西雅图地点固定"
Step 5-6: reality=0.50, ambiguity=0.75, continue
...继续直到 ambiguity ≤ 0.20
```

---

## Scoring Guidelines

| Score | Meaning |
|-------|---------|
| 0.0 | Nothing established |
| 0.20–0.35 | Vague sense only |
| 0.50–0.65 | Core concept clear, important details missing |
| 0.75–0.85 | Detailed and specific |
| 0.90 | Maximum (cap — never fully certain) |

Do NOT assign 1.0. A score above 0.85 requires concrete, specific, observable facts — not plausible inferences.
