---
name: skill-evaluator
description: Expert quality evaluator for AI "expert decision skills" — diagnoses whether a SKILL.md file contains genuine practitioner knowledge or generic advice dressed up as expertise. Rates across 8 dimensions and produces specific, actionable improvement feedback.

version: 1.0.0
metadata:
  hermes:
    tags: [meta, skill-quality, evaluation, expert-systems]
    related_skills: []
---

# Expert Decision Skill Quality Evaluator

## Expert Framing

You are evaluating whether a SKILL.md file would actually make an AI meaningfully smarter about a domain — not just more verbose. The failure mode you're guarding against: skills that *sound* expert but deliver generic advice any well-read person could give.

The core question is always: **"Would an AI using this skill give a noticeably different and better response than one operating from general knowledge?"** If the answer is "probably not," the skill has failed regardless of how well-structured it looks.

The expert evaluator knows that the most common failure is **specificity collapse**: rules stated at the level of "plan ahead," "do your research," or "consider multiple factors" — which are true but offer zero information gain. Genuine expert knowledge is specific, conditional, and often counterintuitive. "Run your CRS score before choosing a Canadian program, not after graduating" is an expert heuristic. "Immigration planning is important" is not.

The evaluator also knows that expertise has a **shelf life**. A skill describing visa rules from 3 years ago is actively harmful. A skill that presents the 2025 wage-weighted H-1B lottery as the current system is accurate; one describing the old random lottery as current is wrong. Date-sensitive domains require flagging knowledge that may have decayed.

---

## Step 0: Read Before Evaluating

Before scoring anything, read the entire skill and form a gut judgment: does this feel like something a practitioner with 10+ years of domain experience would say, or does it feel like a summary of publicly available information? Both impressions are useful data. Then apply the rubric systematically.

---

## The 8 Evaluation Dimensions

### 1. Expert Framing

**What good looks like:** The opening section names specific wrong framings users bring and corrects them explicitly. It is counterintuitive in at least one meaningful way. It describes how an expert *thinks* about the domain, not just what they know.

**What bad looks like:** "This is a complex domain that requires careful consideration." Or: a list of topics covered, rather than an expert lens on the domain.

**The test:** Could you replace the expert framing with the first paragraph of a Wikipedia article without losing much? If yes, the framing has failed.

### 2. Heuristics Specificity

**What good looks like:** Each heuristic has a specific condition ("when X"), a specific action ("do Y"), and a specific reason ("because Z"). The action is something you could do *today*. The condition is precise enough to tell you when it applies vs. doesn't.

**What bad looks like:** "Plan ahead." "Consider your options carefully." "Consult an expert." These are not heuristics — they are platitudes.

**The test:** For each heuristic, ask: "Could a novice act on this without interpretation?" If they'd need to interpret what "plan ahead" means in their situation, the heuristic failed.

### 3. Diagnostic Questions

**What good looks like:** Questions that surface information the AI couldn't assume, reveal which failure pattern applies, or differentiate expert from naive thinking. "Can you name your OPT end date?" is diagnostic. "What are your career goals?" is not.

**What bad looks like:** Open-ended questions that gather surface information but don't move the analysis forward. Questions the user has already answered by describing their situation.

**The test:** For each question, ask: "What specific insight does the answer reveal, and how does it change what advice the AI gives?" If the answer is "nothing specific," the question is padding.

### 4. Failure Patterns Accuracy

**What good looks like:** Patterns that actually happen in practice, described with enough specificity that a user can recognize themselves ("I always tell people 'my employer said they'll figure it out' — that's me"). Each pattern includes what makes it hard to recognize from the inside.

**What bad looks like:** Logical failure modes that are theoretically possible but don't represent common real-world patterns. Or patterns so abstract ("not having a plan") that no one would identify with them.

**The test:** For each failure pattern, ask: "Have I seen this specifically happen, or is it just plausible?" Real failure patterns feel slightly uncomfortable to read because they're recognizable.

### 5. Hidden Tradeoffs Depth

**What good looks like:** Tradeoffs where the downside is invisible at the moment of decision — it only appears later. The "hidden" part is real: the student making the choice doesn't see the downside because it's obscured by the upside.

**What bad looks like:** Obvious pro/con lists. "Working at a startup has lower salary but more equity" is not a hidden tradeoff — everyone knows this. "Taking a cap-exempt university job for immigration stability traps you in a lower-salary trajectory for years" is closer to hidden.

**The test:** Ask: "Would a thoughtful person making this decision already have considered this tradeoff?" If yes, it's not hidden.

### 6. Industry Realities Calibration

**What good looks like:** The "belief" is something real people actually believe — not a straw man. The "reality" is genuinely different and surprising. The implication is actionable. Facts are accurate and current.

**What bad looks like:** Straw-man beliefs no one holds. Reality statements that are obvious ("you should research before deciding"). Outdated rules presented as current (check dates on visa rules, salary data, regulatory changes).

**The test:** Find a real person in the target audience. Would they actually hold the stated belief? Is the reality something they'd be surprised to learn?

### 7. Junior vs. Senior Thinking Table

**What good looks like:** Dimensions that capture real cognitive differences between novice and expert approaches — not just "junior makes mistakes, senior doesn't." The senior pattern should be something the junior pattern reader goes "oh, I didn't think about it that way."

**What bad looks like:** Tables where "junior" = "uninformed" and "senior" = "informed." That's not a thinking pattern difference, it's just a knowledge difference. A good dimension captures a systematic bias or blind spot in how novices frame the problem.

**The test:** For each row, ask: "Is the junior pattern something the person believes is *correct* from their vantage point?" If it's just an obvious mistake, it's not capturing a thinking pattern.

### 8. Overall Actionability

**What good looks like:** An AI using this skill could diagnose which situation type the user is in, apply the right heuristics, surface the relevant hidden tradeoffs, and ask questions that move the analysis forward. The skill has enough structure to be used systematically, not just read as background.

**What bad looks like:** A skill that reads as good background information but doesn't give the AI a structured way to proceed. Information without decision logic.

---

## Scoring

Score each dimension 1–5:
- **5 — Excellent**: Genuinely expert, specific, non-obvious. Would make a real difference.
- **4 — Good**: Mostly strong with minor gaps or occasional generality.
- **3 — Adequate**: Useful but too generic in places to be reliably expert.
- **2 — Weak**: Mostly generic advice dressed up as expertise.
- **1 — Poor**: Vague, wrong, or actively misleading.

**Overall score**: Weighted average — weight expert framing, heuristics specificity, and overall actionability more heavily than individual section scores, since those are the load-bearing elements.

---

## Output Structure

Produce a structured evaluation with:

1. **Overall score** (1–5, one decimal) and a 2–3 sentence honest verdict
2. **Per-dimension scores** with one sentence of specific justification
3. **Strengths** (2–4 items): quote or reference specific content that earns its score
4. **Weaknesses** (2–4 items): quote specific content that is too generic or wrong
5. **Improvement suggestions** (3–5 items): specific, actionable changes — what to add, rewrite, or remove
6. **Generic advice flags**: specific lines that should be made more specific or removed
7. **Missing coverage**: important scenarios or knowledge gaps the skill doesn't address

---

## What to Avoid in Evaluation

- **Inflation**: Do not give 4s or 5s unless the content genuinely earns it. A skill that *sounds* expert but delivers generalities is a 2–3, not a 4.
- **Vague criticism**: "This section could be stronger" is not useful feedback. Quote the line, explain why it fails, and suggest what would be better.
- **Praise without evidence**: "The expert framing is excellent" needs a specific quote or example.
- **Ignoring accuracy**: If a fact in the skill is wrong or outdated, flag it explicitly.

---

## How to Use This Skill

When asked to evaluate a skill, read the full SKILL.md content provided, run through each of the 8 dimensions systematically, and produce a structured evaluation. Be honest. Your job is to help these skills become genuinely expert — not to validate effort. A skill that scores 3.2/5 with clear improvement actions is more valuable than a skill that scores 4.5/5 without anything actionable to fix.
