# Expert Decision Skill Builder

A local pipeline that converts raw real-world text into a structured AI skill file.
The skill gives an AI assistant genuine domain expertise — not a persona, but extracted decision logic.

```
Sources  →  extract.py  →  merge.py (RRF)  →  build_skill.py  →  SKILL.md
(typed)     (per-file)     (ranked fusion)     (synthesized)      (ready to use)
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

Sources are typed (official / authoritative / expert / community) so that the pipeline
can select the right extraction prompt, apply source-appropriate weights, and use
Reciprocal Rank Fusion to surface insights validated across multiple independent sources.

---

## Folder structure

```
skill-builder/
├── README.md
├── requirements.txt
├── prompts/
│   ├── extract.txt               # general-purpose extraction prompt
│   ├── extract_multicountry.txt  # variant for multi-country domains
│   ├── extract_official.txt      # (planned) precision-focused for official docs
│   ├── extract_community.txt     # (planned) community-specific: misconceptions + psychology
│   ├── build_skill.txt           # prompt used to synthesize SKILL.md
│   └── quality_check.txt         # prompt used to score skill quality
├── scripts/
│   ├── utils.py             # shared helpers (LLM client, auth)
│   ├── extract.py           # Stage 1: extract per source file
│   ├── merge.py             # Stage 2: aggregate + RRF rerank (planned)
│   ├── build_skill.py       # Stage 3: synthesize SKILL.md
│   ├── improve_skill.py     # iterative skill improvement pass
│   ├── review.py            # inspect any stage of the pipeline
│   ├── quality_check.py     # score skill quality against rubric
│   └── clean_community.py   # (planned) format-clean community scrapes
└── skills/
    └── <domain>/                  # one folder per skill domain
        ├── config.yaml            # skill metadata, domain description, source weights
        ├── raw/                   # source material, organized by type
        │   ├── official/          # USCIS, IRCC, DOL — authoritative rules
        │   │   ├── us/
        │   │   └── canada/
        │   ├── authoritative/     # books, PDFs (via book-to-skill), academic reports
        │   │   ├── books/
        │   │   └── reports/
        │   ├── expert/            # lawyer blogs, practitioner essays, professional guides
        │   │   ├── us/
        │   │   └── canada/
        │   └── community/         # Reddit, 一亩三分地, 知乎 (cleaned scrapes)
        │       ├── reddit/
        │       ├── 1p3a/
        │       └── zhihu/
        ├── processed/             # auto-generated — do not edit by hand
        │   ├── extractions/       # per-file extraction JSONs (tagged with source_type)
        │   └── merged.json        # RRF-ranked insight set with source provenance
        └── skill/
            ├── SKILL.md           # the final skill file (edit freely)
            ├── SKILL_v1_baseline.md   # snapshot before a major rebuild (manual)
            └── drafts/            # timestamped previous versions (auto-saved)
```

---

## Source Type System

Every source file lives under one of four typed subdirectories. The type determines
which extraction prompt is used, what weight the source carries in the merge step,
and how its insights are treated during RRF reranking.

| Type | Directory | Extraction Focus | Weight |
|------|-----------|-----------------|--------|
| `official` | `raw/official/` | Precise rules, regulatory citations, specific thresholds and dates | 1.5 |
| `authoritative` | `raw/authoritative/` | Frameworks, systematic knowledge, structured expert output (books, PDFs via book-to-skill) | 1.2 |
| `expert` | `raw/expert/` | Practitioner heuristics, case analysis, operational advice | 1.0 |
| `community` | `raw/community/` | Real-case outcomes, misconceptions found in the wild, psychological barriers | 0.8 |

**Book-to-skill integration**: Use [book-to-skill](https://github.com/virgiliojr94/book-to-skill)
to convert PDFs/EPUBs into chapter files, then place those chapter files under
`raw/authoritative/books/`. The chapter files are clean structured text that
extract.py can process directly.

```bash
# Example: process a PDF book, then feed chapters to skill-builder
book-to-skill ~/books/immigration_law.pdf immigration-chapters
cp ~/.claude/skills/immigration-chapters/chapters/*.md \
   skills/immigration-planning/raw/authoritative/books/
python scripts/extract.py immigration-planning
```

---

## Complete workflow at a glance

### Files you prepare (once per domain)

| File | What it is | Required? |
|------|-----------|-----------|
| `skills/<name>/config.yaml` | Skill metadata — name, slug, description, `domain_description` (injected into extraction prompt), tags, and source weights | Yes |
| `skills/<name>/raw/**/*.txt` | Raw source material organized by type. One file per source. | Yes (at least 1) |

### Commands to run (in order)

| # | Command | What it does | Cost |
|---|---------|-------------|------|
| 1 | `python scripts/extract.py <name>` | Extracts 7+ insight categories per source file. Skips already-extracted files. | ~$0.01–0.05/file |
| 2 | `python scripts/merge.py <name>` | Aggregates all extractions, applies RRF reranking, tags insights with source provenance. | Free |
| 3 | `python scripts/build_skill.py <name>` | Synthesizes merged insights into `SKILL.md`. Saves timestamped draft. | ~$0.10–0.30 |
| 4 | `python scripts/review.py <name>` | Inspect any stage. No API calls. | Free |
| 5 | `python scripts/quality_check.py <name>` | Score the skill against a quality rubric. | ~$0.02 |

---

## Step-by-step workflow

### Step 1 — Collect and organize source material

Place files under `raw/<source_type>/`. Subdirectory within each type is for your own
organization; the extraction key uses the immediate parent folder name as a prefix.

#### Official sources (`raw/official/`)

Government and regulatory bodies. These are the highest-authority source type.

- USCIS policy pages, IRCC instructions, Department of Labor guidance
- Save as `.txt` — copy the substantive text, not the full HTML page
- Include section headers and specific rule text; preserve regulatory citations (8 CFR 214.2...)
- **Do not paraphrase** — precision matters; the exact rule wording is the content

```
raw/official/us/uscis_h1b_specialty_occupation.txt
raw/official/us/uscis_opt_stem_extension.txt
raw/official/canada/ircc_express_entry_instructions.txt
raw/official/canada/ircc_pgwp_eligible_programs_june2025.txt
```

#### Authoritative sources (`raw/authoritative/`)

Books, PDFs, academic reports, and formal institutional guides. Higher-quality and more
systematic than practitioner blogs.

**For PDFs and EPUBs**, use book-to-skill to extract chapter files first (see above).
**For shorter reports** (under ~5,000 words), copy the text directly.

```
raw/authoritative/books/cuny_ch01-f1-status-maintenance.md     ← from book-to-skill
raw/authoritative/books/cuny_ch02-work-authorization-cpt-opt.md
raw/authoritative/reports/ace_opt_issue_brief_2025.txt
```

#### Expert sources (`raw/expert/`)

Practitioner writing: immigration law firm blogs, professional guides, high-quality
practitioner essays. The current primary source type before the official and community
layers were added.

```
raw/expert/us/boundless_h1b_lottery_cap.txt
raw/expert/us/h1b_wage_based_lottery_fy2027.txt
raw/expert/canada/canadavisa_express_entry_crs.txt
raw/expert/canada/pnp_tech_workers.txt
```

**What makes a good expert source:**
- Written by someone who has lived or advised on the decisions
- Specific enough to extract a heuristic ("if X, then Y because Z")
- At least a few hundred words
- Multiple sources beat one long source — more perspective diversity

**What to avoid:**
- Generic advice listicles ("10 tips for immigration")
- Purely motivational content with no decision logic
- Single-source files under ~100 words

#### Community sources (`raw/community/`)

Real-user posts and comments from forums. Lower signal density than expert sources,
but uniquely valuable for: real failure stories, widespread misconceptions, and the
psychological barriers that drive bad decisions.

**See the Community Data Pipeline section below** for collection and cleaning procedures
before placing files here. Do not drop raw scraped HTML here directly.

```
raw/community/reddit/f1visa_cpt_12month_mistake.txt
raw/community/reddit/h1b_wage_lottery_strategies.txt
raw/community/1p3a/pgwp_field_study_change_nov2024.txt
raw/community/zhihu/canada_vs_us_longterm_analysis.txt
```

---

### Step 2 — Run extraction (per file)

```bash
cd skill-builder
python scripts/extract.py immigration-planning
```

Extract.py processes every `.txt` / `.md` file under `raw/` and saves a JSON extraction
to `processed/extractions/`. Each file is only processed once — use `--force` to redo.

```bash
python scripts/extract.py immigration-planning --force         # re-extract all
python scripts/extract.py immigration-planning --model claude-opus-4-7  # higher quality
```

**Extraction key naming**: The extraction key (and output filename) is
`<immediate_parent_folder>_<stem>`. Example:
`raw/official/us/uscis_h1b.txt` → `us_uscis_h1b.json`
`raw/community/reddit/f1visa_mistakes.txt` → `reddit_f1visa_mistakes.json`

**Prompt selection by source type** (planned — currently uses `extract_multicountry.txt`
for all files in multi-country domains):

| Source type | Prompt | Extra categories extracted |
|-------------|--------|---------------------------|
| `official` | `extract_official.txt` | Precise rules, regulatory citations |
| `authoritative` | `extract.txt` or `extract_multicountry.txt` | Standard 7 categories |
| `expert` | `extract.txt` or `extract_multicountry.txt` | Standard 7 categories |
| `community` | `extract_community.txt` | + `community_misconceptions`, `real_case_outcomes`, `psychological_barriers`, `reframing_moves` |

**The 7 standard insight categories extracted per file:**

| Category | What it captures |
|----------|-----------------|
| `heuristics` | Specific rules of thumb: condition ("when X") + action + reason ("because Y") |
| `decision_factors` | Variables that actually matter, with weight and how to assess them |
| `hidden_tradeoffs` | Unstated consequences of choices — what silently comes with the option |
| `failure_patterns` | Recurring mistakes with root cause and warning signs |
| `diagnostic_questions` | Questions that distinguish cases that look identical on the surface |
| `industry_realities` | Common belief vs. actual reality vs. implication |
| `junior_vs_senior_signals` | Cognitive/behavioral differences between novice and expert thinking |

**Community-only extra categories** (planned):

| Category | What it captures |
|----------|-----------------|
| `community_misconceptions` | Widely-held wrong beliefs, sourced from being corrected in comments |
| `real_case_outcomes` | Anonymized: situation → decision → outcome → lesson |
| `psychological_barriers` | Fears and cognitive biases driving bad decisions, inferred from user framing |
| `reframing_moves` | How high-voted comments reframe a question to break a psychological trap |

---

### Step 3 — Merge with RRF reranking

```bash
python scripts/merge.py immigration-planning
```

Aggregates all per-file extraction JSONs into `processed/merged.json`.

**Current behavior**: concatenates all insights by category, tagging each with its source.

**Planned RRF enhancement**: Insights that appear across multiple independent sources
are ranked higher than single-source insights. This surfaces the most cross-validated
knowledge to the top of each category.

#### How RRF works in this pipeline

1. **Semantic grouping**: Within each category, near-duplicate insights across different
   source files are grouped using LLM-based deduplication. An insight about "12-month
   CPT limit" in the CUNY PDF and a Reddit post about the same rule are the same insight
   from two independent sources.

2. **RRF scoring**: Each insight group receives a score based on how many sources
   mentioned it and at what rank within each source:

   ```
   RRF(insight) = Σ  source_weight / (60 + rank_in_source)
                  each source
                  that mentions it
   ```

   Where `source_weight` is the type weight (official=1.5, authoritative=1.2,
   expert=1.0, community=0.8) and `rank_in_source` is the position in the LLM's
   extraction output (earlier = higher rank = lower number).

3. **Consensus flagging**: Insights mentioned by 3+ independent sources receive
   `"consensus": true`. These get prominent placement in the final SKILL.md.

4. **Conflict routing**: Community insights that contradict official or expert sources
   are **not discarded**. They are reclassified into `community_misconceptions` — which
   is exactly where wrong-but-widely-believed content is most useful.

**Example RRF outcome**:

| Insight | Sources | RRF Score | Outcome |
|---------|---------|-----------|---------|
| "CPT 12-month limit permanently eliminates OPT" | USCIS official (rank 1, w=1.5) + CUNY book (rank 2, w=1.2) + Reddit (rank 1, w=0.8) | 0.057 | Top heuristic, `consensus: true` |
| "Employer saying they sponsor is enough" | Single blog (rank 5, w=1.0) | 0.015 | Lower-ranked; not consensus |

The merged.json output includes `rrf_score`, `source_count`, `sources[]`, and `consensus`
fields on each insight, so build_skill.py can use them for placement decisions.

---

### Step 4 — Build the skill

```bash
python scripts/build_skill.py immigration-planning
```

Calls Claude (Opus by default) to synthesize `merged.json` into `skill/SKILL.md`.

A timestamped draft is saved to `skill/drafts/` on every run for version comparison.
Use `--model claude-sonnet-4-6` to reduce cost during iteration.

**Current SKILL.md sections:**
- Expert Framing
- Step 0: Diagnosis (always runs first)
- Universal Decision Framework (heuristics, failure patterns, hidden tradeoffs)
- Country-Specific Frameworks (US / Canada)
- Industry Realities

**Planned additions** (when community pipeline and psychology layer are implemented):
- `## Common Misconceptions` — populated from `community_misconceptions`
- `## Real Case Outcomes` — anonymized cases from `real_case_outcomes`
- `## User Psychology` — emotional states → expert responses

Example of the User Psychology section:

```markdown
## User Psychology

### Emotional States and What They Signal

| When user says... | Underlying state | Expert move |
|---|---|---|
| "Should I just go back?" | Fear framed as analysis; return = perceived failure | Reframe to 10-year compounding before giving a view |
| "My company said they'll sponsor me" | Relief — stopped investigating | Probe execution capacity, not stated intention |
| "Everyone in my circle got H-1B" | Survivorship bias exposure | Name the lottery odds before any advice |
| "I'll figure it out later" | Deadline blindness | Surface the irreversible decision that's approaching |
```

---

### Step 5 — Review and inspect

```bash
python scripts/review.py immigration-planning              # pipeline status overview
python scripts/review.py immigration-planning --category heuristics   # one category
python scripts/review.py immigration-planning --all        # all 7 categories
python scripts/review.py immigration-planning --show-skill # print SKILL.md
python scripts/review.py immigration-planning --drafts     # list draft versions
```

---

### Step 6 — Quality check

```bash
python scripts/quality_check.py immigration-planning
```

Scores the skill against a rubric and saves a JSON report to `quality_reports/`.
Use this after every major rebuild to track whether adding sources improved the skill.

---

### Step 7 — Edit manually

`skill/SKILL.md` is the final output. Edit it freely:

- Remove insights that don't ring true
- Add examples or context you know from experience
- Adjust language for your target audience
- Restructure sections

The file is plain Markdown with no format constraints. The pipeline produces a starting
draft; human judgment improves it.

---

### Step 8 — Install the skill

`build_skill.py` installs automatically to `~/.hermes/skills/<slug>/SKILL.md`.
To install manually or to a different location:

```bash
cp skills/immigration-planning/skill/SKILL.md ~/.hermes/skills/intl-student-advisor/SKILL.md
```

---

## Community Data Pipeline

Community forum data (Reddit, 一亩三分地, 知乎) is uniquely valuable for capturing
real failure stories, widespread misconceptions, and the psychological barriers that
drive bad decisions. It requires more preparation than other source types.

### Noise taxonomy

Understanding the noise types helps choose the right layer to handle each:

| Noise type | Examples | Risk | Handling layer |
|-----------|---------|------|----------------|
| Format noise | HTML tags, broken encoding, quoted reply blocks | Low | Layer 2: Format cleaner |
| Content noise | "Same problem!", "mark", pure venting | Low | Layer 1 + Layer 3 |
| Outdated rules | Rules described as current that changed in 2024 | **High** | Layer 1 (date filter) + Layer 3 (flag) |
| Confidently wrong | High-upvote but factually incorrect content | **Very high** | Layer 4 + reclassify to misconceptions |
| Survivorship bias | "I got H-1B first try!" without base rate | Medium | Layer 5 (extract prompt instruction) |
| Hearsay chains | "My friend's lawyer said..." | Medium | Layer 3 (low quality score → drop) |
| Emotional signal | Pure fear/anxiety with no actionable content | — | Retain → `psychological_barriers` |

**Key principle**: Wrong information is not discarded — it is reclassified into
`community_misconceptions`, which is exactly where the skill needs it.

### Five cleaning layers

#### Layer 1 — Collection-time hard filters

Do not scrape content that fails these thresholds. No amount of downstream cleaning
fixes fundamentally low-quality source material.

| Platform | Post criteria | Comment criteria |
|----------|--------------|-----------------|
| Reddit (r/f1visa, r/immigration, r/cscareerquestions) | 50+ upvotes, immigration-relevant flair | 20+ upvotes, 150+ characters |
| 一亩三分地 | 精华 tag or 50+ replies, posted within 24 months | Top 20% by upvotes within thread, 100+ characters |
| 知乎 | 500+ question followers, top answer 100+ upvotes | Top 5 answers only |

**Time window**: immigration rules change frequently. Only collect posts from the
**past 24 months**. Attach `source_date` to every file header.

#### Layer 2 — Format preprocessing (`scripts/clean_community.py`)

Run before writing to `raw/community/`. Produces clean `.txt` with structured headers.

```
Strip HTML tags and CSS artifacts
Remove quoted reply blocks (lines starting with ">")
Remove duplicate paragraphs (paragraph-level hash dedup)
Remove comments where non-text content > 70% (emoji-dominant)
Normalize encoding to UTF-8
Keep only top-level comments (nested replies have lower signal density)
```

**Output format** — every cleaned community file follows this structure:

```
---
platform: reddit
subreddit: f1visa
post_date: 2025-03-15
post_upvotes: 234
post_title: "Used 11 months of full-time CPT — safe for OPT?"
post_text: |
  [cleaned post text]

COMMENT [upvotes=189, length=412]:
[cleaned comment text]

COMMENT [upvotes=145, length=287]:
[cleaned comment text]
---
```

#### Layer 3 — LLM quality pre-scoring

A lightweight Haiku call scores each post before it enters `raw/community/`.

```
Score each post on four dimensions (0–5):
  specificity:    Are there concrete details (rules, timelines, dollar amounts, consequences)?
  actionability:  Does it give something a reader could do?
  credibility:    Are there credibility signals (personal experience, cited sources, professional identity)?
  recency_risk:   Does it describe a rule that may have changed? (higher = subtract from score)

Composite score < 2.0  → discard
Composite score 2.0–3.5 → retain with weight penalty (× 0.5 in merge)
Composite score > 3.5  → retain at full weight
```

Layer 3 also attaches two flags to the file header:
- `potentially_outdated: true/false` — describes rules that may no longer apply
- `contradicts_official: true/false` — content that contradicts known official rules

#### Layer 4 — Conflict routing

Files flagged `contradicts_official: true` are not discarded. They are processed with
`extract_community.txt` but their insights are routed exclusively into
`community_misconceptions` — they never enter `heuristics` or `decision_factors`.

This is intentional: a Reddit post confidently stating "the H-1B lottery is still random"
is useful evidence of a widespread misconception, even though the underlying claim is wrong.

#### Layer 5 — Community-specific extract prompt (`extract_community.txt`)

The `extract_community.txt` prompt differs from the general prompt in these ways:

- **Ignores**: pure venting, generic encouragement, "same problem!" comments
- **Downweights**: single-person stories with no corroboration (survivorship bias signal)
- **Explicitly extracts**:
  - `failure_stories`: specific situation → decision → outcome → lesson chain
  - `community_misconceptions`: beliefs that are corrected in the comments
  - `psychological_barriers`: fears and cognitive biases inferred from user framing
  - `reframing_moves`: how high-voted responses reframe a question to break a trap
- **Requires date tagging**: any rule-description must note whether it describes
  current rules or rules from a specific past period

### Collection checklist (before running extract.py)

```
[ ] Post is within 24-month time window
[ ] Meets upvote/reply threshold for platform
[ ] clean_community.py has been run (structured header present)
[ ] Layer 3 quality score recorded in header
[ ] contradicts_official flag set if applicable
[ ] File placed under raw/community/<platform>/
```

---

## Iterative improvement

The pipeline gets better as you add sources:

1. Add files to the appropriate `raw/<type>/` directory
2. Run `extract.py` (new files only; old ones cached)
3. Run `merge.py` (re-aggregates and reranks everything)
4. Run `build_skill.py` (new draft auto-saved to `skill/drafts/`)
5. Compare with the previous version in `skill/drafts/`
6. Run `quality_check.py` to track quality delta numerically

**Rough convergence**: after 8–12 high-quality sources across at least 3 source types,
the skill typically stabilizes. Adding more official sources extends knowledge; adding
community sources adds psychology depth.

**Comparing across rebuilds**:

```bash
# Manual baseline snapshot before a major rebuild
cp skills/immigration-planning/skill/SKILL.md \
   skills/immigration-planning/skill/SKILL_v1_baseline.md

# After rebuild, diff
diff skills/immigration-planning/skill/SKILL_v1_baseline.md \
     skills/immigration-planning/skill/SKILL.md
```

---

## Adding a new skill domain

```bash
mkdir -p skills/my-domain/raw/{official,authoritative,expert,community}
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
countries:          # optional — omit if not a multi-country domain
  - us
  - canada
country_labels:
  us: "United States"
  canada: "Canada"
tags:
  - relevant
  - tags
  - here
```

Then follow the workflow from Step 1.

---

## Cost estimates

| Script | Model | Cost per run |
|--------|-------|-------------|
| `extract.py` (1 source, ~3k chars) | Sonnet | ~$0.01 |
| `extract.py` (1 source, ~3k chars) | Opus | ~$0.05 |
| `build_skill.py` | Opus | ~$0.10–0.30 |
| `quality_check.py` | Haiku | ~$0.01 |
| Layer 3 community pre-scoring (per post) | Haiku | ~$0.002 |

For 16 sources + one skill build (current immigration-planning scale):
~$1.50–2.50 total using Sonnet for extraction and Opus for the final build.

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

**Community source quality feels low**
Check that Layer 3 pre-scoring ran — look for `quality_score` in the file header.
Score < 2.0 files should not be in `raw/community/`. If they are, remove them and
re-run from `extract.py --force` on the affected files.

**Community insight contradicts official source**
This is expected and correct. Check that the insight is in `community_misconceptions`
in `merged.json`, not in `heuristics`. If it ended up in heuristics, set
`contradicts_official: true` in the source file header and re-extract with `--force`.
