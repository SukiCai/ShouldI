# Expert Decision Skill Builder

A local pipeline that converts raw real-world text into a structured AI skill file.
The skill gives an AI assistant genuine domain expertise — not a persona, but extracted decision logic.

```
Raw text  →  extract.py  →  merge.py  →  build_skill.py  →  SKILL.md
(sources)    (per-file)     (combined)   (synthesized)      (ready to use)
```

---

## What this is NOT

- Not a RAG system — no vector store, no retrieval at inference time
- Not a persona prompt — the AI doesn't "pretend" to be an expert
- Not a chatbot — the output is a skill file that gets loaded once

## What this IS

A pipeline that distills expert decision logic from real text into a compact,
structured skill. The skill teaches the AI *how experts think* — their heuristics,
their diagnostic questions, their knowledge of hidden tradeoffs — so it can apply
that logic to a user's specific situation.

---

## Folder structure

```
skill-builder/
├── README.md
├── requirements.txt
├── prompts/
│   ├── extract.txt          # prompt used to extract insights per source file
│   └── build_skill.txt      # prompt used to synthesize SKILL.md
├── scripts/
│   ├── utils.py             # shared helpers
│   ├── extract.py           # Stage 1: extract per source file
│   ├── merge.py             # Stage 2: aggregate all extractions
│   ├── build_skill.py       # Stage 3: synthesize SKILL.md
│   └── review.py            # inspect any stage of the pipeline
└── skills/
    └── pm-career/           # one folder per skill domain
        ├── config.yaml      # skill metadata and domain description
        ├── raw/             # your source material goes here
        │   ├── manual/      # text you wrote or copy-pasted
        │   └── web/         # content saved from web pages
        ├── processed/       # auto-generated — do not edit by hand
        │   ├── extractions/ # per-file extraction JSONs
        │   └── merged.json  # combined insight set
        └── skill/           # final output
            ├── SKILL.md     # the skill file (edit this freely)
            └── drafts/      # timestamped previous versions
```

---

## Setup

If you're in the `hermes-base-agent` repo, `anthropic` is already in the project venv:

```bash
source ../.venv/bin/activate        # from skill-builder/
export ANTHROPIC_API_KEY=sk-ant-...
```

Otherwise install from scratch:

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Complete workflow at a glance

### Files you prepare (once per domain)

| File | What it is | Required? |
|------|-----------|-----------|
| `skills/<name>/config.yaml` | Skill metadata — name, slug, description, `domain_description` (injected into extraction prompt), tags | Yes |
| `skills/<name>/raw/**/*.txt` | Raw source material — blog posts, essays, Reddit threads, transcripts, your own writing. One file per source. | Yes (at least 1) |

### Commands to run (in order, every time you add sources or want to rebuild)

| # | Command | What it does | Input | Output | Cost |
|---|---------|-------------|-------|--------|------|
| 1 | `python scripts/extract.py <name>` | Calls Claude once per `.txt`/`.md` file in `raw/`. Extracts 7 structured insight categories per file. Skips files already extracted (use `--force` to redo). | `raw/**/*.txt` | `processed/extractions/<file>.json` | ~$0.01–0.05 per file |
| 2 | `python scripts/merge.py <name>` | Reads all extraction JSONs, aggregates by category, tags each insight with its source file. Pure local operation. | `processed/extractions/*.json` | `processed/merged.json` | Free |
| 3 | `python scripts/build_skill.py <name>` | Calls Claude (Opus by default) with the full merged insight set. Synthesizes into a structured `SKILL.md`. Saves a timestamped draft for version history. | `processed/merged.json` + `config.yaml` | `skill/SKILL.md` + `skill/drafts/SKILL_<ts>.md` | ~$0.10–0.30 |
| 4 | `python scripts/review.py <name>` | Inspect any stage. No API calls — reads local files only. | Any stage | Terminal output | Free |

### Review sub-commands

```bash
python scripts/review.py <name>                     # pipeline status overview
python scripts/review.py <name> --category heuristics   # inspect one category
python scripts/review.py <name> --all               # all 7 categories
python scripts/review.py <name> --show-skill        # print the generated SKILL.md
python scripts/review.py <name> --drafts            # list saved draft versions
```

### The 7 insight categories extracted from each source

| Category | What it captures |
|----------|-----------------|
| `heuristics` | Specific rules of thumb with a condition ("when X") and a reason ("because Y") |
| `decision_factors` | Variables that actually matter, with weight and how to assess them |
| `hidden_tradeoffs` | Unstated consequences of choices — what silently comes with the option |
| `failure_patterns` | Recurring mistakes with root cause and warning signs |
| `diagnostic_questions` | Questions that distinguish cases that look identical on the surface |
| `industry_realities` | Common belief vs. actual reality vs. implication |
| `junior_vs_senior_signals` | Behavioral/cognitive differences between novice and expert thinking |

---

## Step-by-step workflow

### Step 1 — Collect source material

Put raw text files into `skills/<domain>/raw/`. Subdirectory names don't matter
for processing, but use them to track provenance:

```
raw/
  manual/       ← text you wrote, paraphrased, or compiled yourself
  web/          ← articles, essays, blog posts (save as .txt)
  reddit/       ← copied discussion threads
  transcripts/  ← podcast or video transcripts
```

**What makes a good source:**
- Practitioner writing — people who have lived the decisions, not advice columnists
- Specific enough to extract a heuristic from ("If X, then Y because Z")
- At least a few hundred words per file
- Multiple sources are better than one long source — more diversity of perspective

**What to avoid:**
- Generic advice listicles ("10 tips for PM success")
- Content that's purely motivational with no decision logic
- Single-source files under ~100 words

The sample file at `skills/pm-career/raw/manual/sample_pm_career.txt` shows
what good source material looks like.

### Step 2 — Run extraction (per file)

```bash
cd skill-builder
python scripts/extract.py pm-career
```

This calls Claude once per source file and saves a JSON extraction to
`processed/extractions/`. Each file is only processed once — re-run with
`--force` to redo everything.

```bash
python scripts/extract.py pm-career --force
python scripts/extract.py pm-career --model claude-opus-4-7   # higher quality
```

**What gets extracted per file:**
- `heuristics` — specific rules of thumb with conditions and reasons
- `decision_factors` — variables that actually matter, with weight
- `hidden_tradeoffs` — unstated consequences of choices
- `failure_patterns` — recurring mistakes with root causes and warning signs
- `diagnostic_questions` — questions that distinguish similar-looking cases
- `industry_realities` — myth vs. reality pairs
- `junior_vs_senior_signals` — cognitive/behavioral differences

### Step 3 — Merge extractions

```bash
python scripts/merge.py pm-career
```

Aggregates all per-file extractions into `processed/merged.json`. Each insight
keeps a `_source` tag so you can trace it back. Run this after every new
extraction.

### Step 4 — Build the skill

```bash
python scripts/build_skill.py pm-career
```

Calls Claude (Opus by default — use Sonnet with `--model` to save cost) to
synthesize `merged.json` into a structured `skill/SKILL.md`.

A timestamped draft is saved to `skill/drafts/` every time you run this, so
you can compare versions after adding more sources.

### Step 5 — Review and inspect

```bash
# Pipeline status overview
python scripts/review.py pm-career

# See all extracted heuristics
python scripts/review.py pm-career --category heuristics

# See all categories
python scripts/review.py pm-career --all

# Print the generated skill
python scripts/review.py pm-career --skill

# List draft versions
python scripts/review.py pm-career --drafts
```

### Step 6 — Edit manually

`skill/SKILL.md` is the final output. Edit it freely:
- Remove insights that don't ring true
- Add examples or context you know from experience
- Adjust the language for your target audience
- Restructure sections if needed

The file is plain Markdown — no special format constraints. The pipeline
produces a starting draft; your judgment improves it.

### Step 7 — Install the skill (optional)

To make the skill available in Hermes:

```bash
# Copy to your local skills directory
cp skills/pm-career/skill/SKILL.md ~/.hermes/skills/pm-career-expert/SKILL.md

# Or install from the optional-skills directory after moving it there
```

---

## Iterative improvement

The pipeline is designed to get better as you add sources:

1. Add more source files to `raw/`
2. Run `extract.py` (new files only, old ones cached)
3. Run `merge.py` (re-aggregates everything)
4. Run `build_skill.py` (builds a new draft, old draft saved)
5. Compare the new `SKILL.md` with the previous draft in `skill/drafts/`

After 5–10 high-quality sources, the skill typically stabilizes — adding more
sources starts yielding diminishing returns.

---

## Adding a new skill domain

```bash
mkdir -p skills/my-domain/raw/manual
```

Create `skills/my-domain/config.yaml`:

```yaml
name: My Domain Expert
slug: my-domain-expert
description: One sentence describing what decisions this skill helps with.
domain_description: >
  Detailed description of the decision domain — what kinds of decisions,
  what kinds of users, what kinds of tradeoffs. This is injected directly
  into the extraction prompt, so be specific.
tags:
  - relevant
  - tags
  - here
```

Then follow the same workflow from Step 1.

---

## Cost estimates (rough)

| Script | Model | Cost per run |
|--------|-------|-------------|
| `extract.py` (1 source, ~3k chars) | Sonnet | ~$0.01 |
| `extract.py` (1 source, ~3k chars) | Opus | ~$0.05 |
| `build_skill.py` | Opus | ~$0.10–0.30 |

For 10 sources + one skill build: ~$1–2 total using Opus throughout.
Use Sonnet for extraction drafts, Opus for the final build.

---

## Troubleshooting

**`json.JSONDecodeError` during extraction**
The model returned malformed JSON. Try `--model claude-opus-4-7` for more
reliable structured output on complex sources.

**Extraction output is too generic**
Your source material is too generic. Practitioner writing > advice articles.
Look for forum posts where someone is defending a specific decision with reasons.

**SKILL.md sections are thin**
Not enough source diversity. Add sources that cover different angles
(e.g., the company-switching perspective, the large-company perspective,
the early-career vs. late-career perspective).

**Want to remove bad insights from merged.json**
Edit `processed/merged.json` directly — it's plain JSON. Remove any item from
any array. Then re-run `build_skill.py` to get a new draft from the cleaned set.
