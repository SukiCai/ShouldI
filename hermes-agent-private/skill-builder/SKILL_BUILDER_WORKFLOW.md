# Skill Builder Workflow

Guide for Claude Code (and Hermes agent) to efficiently upgrade expert skills using the skill-builder pipeline. Follow this document whenever you need to improve an existing skill or build a new one.

---

## 0. Two Upgrade Paths — Choose the Right One

Before starting, decide which path applies:

| Situation | Path | What to do |
|-----------|------|------------|
| Skill lacks coverage on a topic or region | **Path A: Add Knowledge** | Collect real sources → write raw files → run full pipeline |
| Skill content is correct but poorly structured or missing nuance in framing | **Path B: Polish Only** | Run `improve_skill.py` (no new raw files needed) |
| Both gaps in coverage AND poor framing | **Path A then B** | Full pipeline first, then `improve_skill.py` |

> **Critical distinction**: `improve_skill.py` rewrites prose within existing knowledge. It cannot add facts it has never seen. If the quality report says "Missing Coverage: X", that requires Path A — adding raw source files.

---

## 1. Trigger Conditions

Start this workflow when any of the following are true:

- `quality_check.py` report shows a `Missing Coverage` section with substantive gaps
- User says the skill "can't answer" a question it should know
- Geographic or demographic coverage is narrow (e.g., skill covers US but not Canada/UK)
- Source file count is low (< 10 raw files) or heavily skewed to one source type
- It has been 3+ months since the last pipeline run and the topic domain is evolving

---

## 2. Gap Analysis (Always Do This First — Do Not Skip)

**Read before acting:**

```bash
# 1. Check most recent quality report
ls skills/<skill-folder>/skill/quality_reports/   # find the latest quality_*.txt
cat skills/<skill-folder>/skill/quality_reports/quality_<latest>.txt

# 2. Survey existing raw files by region
find skills/<skill-folder>/raw -name "*.txt" | sort
```

### 2a. Geographic Coverage Requirement (Mandatory)

These skills serve international students in North America. **Both US and Canada must be explicitly covered for every major topic.** This is not optional — US-only or Canada-only skills give users wrong advice when their situation doesn't match.

**Primary target regions (both required):**
- 🇺🇸 **United States** — H-1B, OPT/STEM OPT, EB green card, US universities, US funding
- 🇨🇦 **Canada** — PGWP, Express Entry/CEC, Tri-Council, PNPs, Canadian universities

**Secondary regions (cover when directly relevant):**
- 🇬🇧 UK — PhD structure, Graduate Route visa, for grad-school-selection
- 🇪🇺 EU — ETH/EPFL/Max Planck, for grad-school-selection
- 🌐 Global — cross-country principles that apply everywhere

**Region coverage check — run this before gap analysis:**

| Region | Topic | US covered? | Canada covered? | Gap? |
|--------|-------|-------------|-----------------|------|
| Job search | H-1B/OPT mechanics | ✅ | ✅ (PGWP/CEC) | — |
| Job search | Sponsorship landscape | ✅ | needs check | → |
| Grad school | Funding | ✅ (NSF GRFP) | ✅ (Tri-Council) | — |
| Grad school | Application process | ✅ | ✅ | — |
| Immigration | Post-graduation PR | ✅ (EB) | ✅ (Express Entry) | — |

**Rule**: If a major topic has US coverage but no Canada equivalent (or vice versa), that is a gap — add it to the gap table.

### 2b. Topic + Source Type Gap Table

**Then produce a gap table before writing any files:**

| Gap identified | File to create | Directory | Source type | Region |
|---------------|----------------|-----------|-------------|--------|
| e.g. "No Canada funding coverage" | `nserc_tri_council_funding.txt` | `raw/official/canada/` | official | Canada |
| e.g. "No real advisor red-flag stories" | `advisor_red_flags_forum_thread.txt` | `raw/community/gradcafe/` | community | Global |

**Rules for the gap table:**
- Be specific: "missing Canada content" → list 2-4 specific files, not just one generic file
- Map each gap to the correct `source_type` (affects RRF weight in merge)
- Tag each file with its target region (US / Canada / Global)
- Show the gap table to the user and get confirmation before proceeding

---

## 3. Real Information Collection Protocol (Path A Only)

### Mandatory: Collect All Four Source Types

**Every data collection cycle must produce at least one file per source type.** Do not skip any tier. Expert-only or official-only collections are incomplete and will produce a skill with known blind spots.

| Source type | Weight | Why it matters | Cannot be skipped because |
|-------------|--------|----------------|--------------------------|
| **Official** | 1.5 | Policy facts, deadlines, dollar amounts | Without it, the skill cites unverifiable numbers |
| **Authoritative** | 1.2 | Research-backed statistics, named expert quotes | Without it, claims lack credibility anchors |
| **Expert** | 1.0 | Practitioner judgment, how-to frameworks | Without it, the skill lacks actionable heuristics |
| **Community** | 0.8 | Real stories, actual experiences, hidden failure modes | Without it, the skill misses what people actually face vs. what institutions say |

> **Community data is the most commonly skipped and the hardest to fake well.** Real forum threads reveal what official sources never say: advisors who underpay, programs with hidden attrition, visa situations that didn't go as planned. Always collect at least one community source per topic area — it dramatically improves the realism of failure patterns and diagnostic questions.

### Source descriptions and examples

1. **Official** — government agencies, university official pages, regulatory bodies
   - Examples: `ircc.gc.ca`, `nserc.ca`, `nsf.gov`, `university.edu/grad`
   - Weight in pipeline: 1.5

2. **Authoritative** — peer-reviewed publications (PMC open access), official research reports, named expert interviews in credible outlets
   - Examples: PMC articles, Chemistry World/Nature News with named sources, Statistics Canada reports
   - Weight: 1.2

3. **Expert** — detailed practitioner guides with verifiable author credentials, official program advisors, immigration lawyers, career coaches
   - Examples: Admit Lab guides, named immigration firm blogs, named academic advisors
   - Weight: 1.0

4. **Community** — real forum threads with verifiable URLs, named personal accounts from identified individuals
   - Examples: GradCafe thread #87693, PhysicsForums user Jarfi's checklist, named blog post
   - Weight: 0.8

   **Scraper scripts (preferred for Reddit / 知乎 / 一亩三分地):**

   Run from the `skill-builder/` directory. Each script auto-selects subreddits/boards/questions for the given skill.

   | Script | Platform | How it works | Prerequisite |
   |--------|----------|--------------|--------------|
   | `python scripts/scrape_reddit.py --skill <slug>` | Reddit | httpx → old.reddit.com; no API credentials needed (PRAW used if set) | `pip install httpx` |
   | `python scripts/scrape_zhihu.py --skill <slug>` | 知乎 | Scrapling `StealthyFetcher.fetch()` stealth Playwright | `pip install 'scrapling[all]' && patchright install chromium` |
   | `python scripts/scrape_1p3a.py --skill <slug>` | 一亩三分地 | Scrapling `StealthyFetcher.fetch()` stealth Playwright | same as above |

   **Scrapling API note (v0.4.9+):** Use the class-method `StealthyFetcher.fetch(url, headless=True)` — the old instance pattern `StealthyFetcher(auto_match=True).get(url)` was removed.

   **Caveats:**
   - 知乎: **works** — answers are accessible without login. Critical fix: use `ans_el.get_all_text(separator=' ')` not `ans_el.text` (`.text` only returns direct text nodes and returns empty string for richtext elements). Vote counts return 0 without login but full answer text is available. **Real question IDs required** — invented/guessed IDs silently return empty results. Find real IDs via `WebSearch site:zhihu.com/question <topic>` and update `SKILL_QUESTIONS[<slug>]` in `scrape_zhihu.py`.
   - 一亩三分地: thread IDs are extractable from `_raw_body` via regex (GBK pages; Playwright converts to UTF-8 internally so decode with `utf-8` not `gbk`). However, all post content is behind a login paywall (`您需要 登录` in every `class="t_f"` block). **Use `--demo` flag** — the script contains high-quality synthetic posts covering US/Canada topics: `python scripts/scrape_1p3a.py --skill <slug> --demo`

   **Accessible community platforms** (via WebFetch):
   - GradCafe forums: `forum.thegradcafe.com` — PhD admission, advisor experiences, funding realities
   - PhysicsForums: `physicsforums.com` — STEM grad school, research career, funding stories
   - PhysicsWorld / Chemistry World news: real interviews with named researchers
   - PMC open access: `ncbi.nlm.nih.gov/pmc` — peer-reviewed studies on PhD mental health, outcomes
   - Named academic blogs: search "[topic] personal experience blog site:blogspot.com OR site:wordpress.com"

   **Not accessible via WebFetch — use scraper scripts instead:**
   - Reddit → `scrape_reddit.py` (httpx, no credentials needed) ✅
   - 知乎 → `scrape_zhihu.py` (Scrapling StealthyFetcher) ✅
   - 一亩三分地 → `scrape_1p3a.py` (Scrapling StealthyFetcher) ✅
   - Quora: frequently 403, no scraper available — skip

### Collection steps

```
For EACH source type, do the following:

1. WebSearch for 3-5 candidate URLs
   Official:      "NSERC CGRS-D 2024 eligibility site:nserc-crsng.ca"
   Authoritative: "PhD stipend financial stress study PMC 2023"
   Expert:        "Canadian PhD application guide advisor contact 2024"
   Community:     "grad school advisor red flags forum gradcafe OR physicsforums"

2. WebFetch each URL — extract:
   - Exact dollar amounts / statistics (with year)
   - Official program names and deadlines
   - Named quotes with speaker's name and institution
   - Verifiable policy dates
   - For community: specific experiences, named individuals, real thread IDs

3. Note what you found vs. what you couldn't access
   - Reddit: run `python scripts/scrape_reddit.py --skill <slug>` (httpx, no credentials needed)
   - 知乎: run `python scripts/scrape_zhihu.py --skill <slug>` (Scrapling StealthyFetcher required)
   - 一亩三分地: run `python scripts/scrape_1p3a.py --skill <slug>` (Scrapling StealthyFetcher required)
   - Government pages (USCIS, IRCC, canada.ca): WebFetch returns 403 — use httpx directly in Bash

4. Write the raw file immediately after collecting — don't batch
```

### Pre-pipeline checklist — do not run pipeline until all boxes are checked

Before running `extract.py`, verify:

- [ ] At least 1 file in `raw/official/` covering the new topic
- [ ] At least 1 file in `raw/authoritative/` covering the new topic
- [ ] At least 1 file in `raw/expert/` covering the new topic
- [ ] At least 1 file in `raw/community/` covering the new topic (real URL, not DEMO_POSTS)

If any box is unchecked: go back and collect that source type before proceeding.

### Hard rules — never violate these

- **No synthetic data**: Never write statistics, quotes, or experiences you invented. Every fact needs a source URL or named citation.
- **No vague numbers**: "About 40% of students..." with no source → do not write it. Either find the actual study or omit.
- **No demo posts**: The scrapers (`scrape_reddit.py`, `scrape_zhihu.py`, `scrape_1p3a.py`) contain `DEMO_POSTS` with fake URLs like `comments/demo_ca2`. These are placeholders only — never count them as real community data.
- **Real = verifiable**: A "real" source means someone else could open the URL and read the same content.
- **Expert-only is incomplete**: A collection with only expert files will produce a skill that scores lower on community_misconceptions, real_case_outcomes, and psychological_barriers — categories that require real human experiences, not practitioner summaries.

---

## 4. Raw File Writing Format

Every raw file must start with this header (all fields required):

```
Source: [Full institution/publication name]
URL: [Direct URL to the source page]
Topic: [One sentence: what this file covers]
Country scope: [US / Canada / UK / EU / Global / specific country]
Source type: official / authoritative / expert / community

---

[Content starts here]
```

### Directory placement rules

```
raw/
├── official/
│   ├── canada/          ← Canadian government/university official pages
│   ├── us/              ← US government/university official pages
│   └── [region]/
├── authoritative/
│   └── reports/         ← Research papers, journalistic reports with named experts
├── expert/
│   ├── canada/          ← Expert analysis specific to Canada
│   ├── general/         ← Cross-country expert analysis
│   └── industry/        ← Industry-specific expert analysis
└── community/
    ├── gradcafe/        ← GradCafe forum threads
    ├── forums/          ← PhysicsForums, Stack Exchange, other forums
    └── blogs/           ← Named personal blogs with verifiable author
```

### File naming convention

```
[topic]_[qualifier].txt              ← for general files
[topic]_[region].txt                 ← for region-specific files
[topic]_real_[type].txt              ← for community files (signals it's real data)

Examples:
  nserc_sshrc_cihr_tri_council_funding.txt
  canadian_phd_application_mechanics.txt
  advisor_red_flags_real_forum_thread.txt
  phd_funding_ran_out_real_stories.txt
```

### Content quality bar

A good raw file:
- Contains 3-8 distinct, specific, actionable facts (not one vague paragraph)
- Has at least one concrete number, date, or named statistic
- For community files: has at least one named individual or verifiable thread
- For official files: quotes or paraphrases actual policy language

---

## 5. Pipeline Execution

Run in this order, always. Do not skip steps.

```bash
# Step 1: Extract insights from raw files
python scripts/extract.py <skill-folder>
# → Only processes NEW files (skips already-extracted ones)
# → To re-process a file: delete its JSON from processed/extractions/

# Step 2: Merge and rank all extractions
python scripts/merge.py <skill-folder>
# → Applies RRF ranking with source weights
# → Check output: total insights count and source type breakdown

# Step 3: Build the skill
python scripts/build_skill.py <skill-folder>
# → Writes to skill/SKILL.md
# → Auto-installs to ~/.hermes/skills/<slug>/SKILL.md

# Step 4: Quality check
python scripts/quality_check.py <skill-folder>
# → Saves report to skill/quality_reports/quality_<timestamp>.json + .txt
# → Read the report before deciding whether to iterate
```

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| New file not appearing in extract output | Already extracted (cached) | Delete `processed/extractions/<name>.json` |
| extract.py skips all files | All already cached | Use `--force` flag to re-process everything |
| merge shows 0 community insights | Community files missing `source type: community` header | Fix header in raw file, re-extract |
| quality_check score went down | New content revealed gaps the model now notices | Not a failure — read the report, address new gaps |

---

## 6. Optional: improve_skill.py (Path B / after Path A)

After running the full pipeline, you may run `improve_skill.py` to have an LLM rewrite the SKILL.md for better framing, structure, and heuristic sharpness — **without adding new raw sources**.

```bash
python scripts/improve_skill.py <skill-folder>
# Uses most recent quality_report automatically

python scripts/improve_skill.py <skill-folder> --check-first
# Runs a fresh quality_check before improving (recommended if report is old)
```

**When to use**: After Path A when the quality report says scores are good but framing is weak (e.g., "Diagnostic Questions 3/5" with feedback about structure, not missing facts).

**When NOT to use as a shortcut**: If the report says "Missing Coverage: X", `improve_skill.py` cannot invent that coverage. It will write around the gap, not fill it.

---

## 7. Completion Criteria

A skill upgrade is complete when:

- [ ] `quality_check.py` overall score ≥ 4.5 / 5.0
- [ ] No items in the `Missing Coverage` section that the user considers critical
- [ ] Skill installed at `~/.hermes/skills/<slug>/SKILL.md` (confirmed in build output)
- [ ] User confirms the skill can answer the question that triggered the upgrade

If score is 4.3-4.5 with minor missing coverage: acceptable; document remaining gaps for next iteration.

If score is below 4.3: add more raw files (target source types with lowest representation in merge output) and re-run.

---

## 8. Skills Reference

Current skills in this skill-builder instance:

| Skill folder | Slug | Last pipeline run | Score | Files |
|-------------|------|------------------|-------|-------|
| `immigration-planning` | `intl-student-advisor` | 2026-06-29 | 4.5 ✅ | 38 (2 official, 16 expert, 20 community) |
| `grad-school-selection` | `grad-school-advisor` | 2026-06-28 | 4.5 ✅ | 30 (3 official, 3 authoritative, 18 expert, 6 community) |
| `job-search-strategy` | `intl-job-search` | 2026-06-28 | 4.4 ✅ | 19 (2 official, 2 authoritative, 13 expert, 2 community) |
| `pm-career` | `pm-career-expert` | 2026-07-05 | 4.3 ✅ | 29 (1 official, 3 authoritative, 12 expert, 13 community) |
| `salary-negotiation` | `salary-negotiation` | 2026-07-05 | 4.4 ✅ | 28 (2 official, 3 authoritative, 10 expert, 13 community) |
| `stay-or-return` | `stay-or-return` | 2026-07-05 | 4.4 ✅ | 40 (2 official, 3 authoritative, 12 expert, 23 community) |

Update this table after each pipeline run.

---

## 9. Quick Reference: Common Commands

```bash
# Full upgrade pipeline for one skill
python scripts/extract.py <skill>
python scripts/merge.py <skill>
python scripts/build_skill.py <skill>
python scripts/quality_check.py <skill>

# Polish only (no new raw files)
python scripts/improve_skill.py <skill> --check-first

# Improve all skills at once
python scripts/improve_skill.py --all --check-first

# Force re-extract everything (e.g., after fixing file headers)
python scripts/extract.py <skill> --force

# Check what's been extracted already
ls skills/<skill>/processed/extractions/

# Check installed skill
cat ~/.hermes/skills/<slug>/SKILL.md | head -20
```
