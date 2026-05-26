## `apps/`

Deployable or long-running applications in this monorepo.

| Workspace | Purpose |
|-----------|---------|
| **`mobile`** | **`@shouldi/mobile`** — Expo Router client (`npm run mobile`). **Decide step 1** talks to **`/v1/harmence/interview/*`** on the gateway (“Harmence” intake wired to Hermes repo detection — see `@shouldi/api`). |
| **`api`** | **`@shouldi/api`** — Node + Hono HTTP service (`npm run api` from repo root). |

Do not nest shared libraries inside `apps/`; place reusable code under **`packages/`** and consume it via workspace dependencies.

### Mobile UI palette

Light-mode copy and hairlines match **Profile (You)** — warm neutrals live in **`apps/mobile/constants/theme.ts`** (`profileLight`, `profileTypography`, `profileNeutralStroke`) and **`themeSurface()`** (`textDisplay`, `textPrimary`, `textMuted`). Prefer those over cool slate literals on pastel chrome. In **dark** mode, **`themeSurface().groupedSurface` / `groupedBorder`** drive **`GlassCard`** and similar panels — do not use **`palette.sheet` (white)** as a card fill when copy uses **`textPrimary` (white)**.

---

## Product trajectory (confidence, not generic intelligence)

**Moat hypothesis:** Depth of *understood context* beats thin chat wrappers. Users pay for confidence (“Did I decide right?”), not generic answers. **Compounding moat:** the system **learns from real community validation** (agreement, pushback, outcomes, regrets)—not from synthetic self-chat—so the agent and skills **keep improving** and become harder to replicate over time.

**Target flow:**

1. **AI interview (intake)** — Agent keeps probing until the model *genuinely* holds the decision frame: background, risk appetite, horizon, emotional state, finances, constraints, hidden factors → **Structured context**.
2. **AI preliminary verdict** — Discrete stance (Yes / No / Lean yes / Lean no / Insufficient information) plus reasoning, tradeoffs, risks, confidence.
3. **Human-in-the-loop** — Send structured context, anonymized profile, and AI summary to people with **lived relevance** (e.g. relocated founders, divorced couples, ex–BigTech ICs)—not random crowd.
4. **Community judgment** — Humans challenge the AI, agree/disagree, share regrets and outcomes.
5. **Final synthesis** — AI summarizes consensus, disagreement, plausible outcomes, latent risks → **Final recommendation.**
6. **Community-grounded learning** — Capture **validated signals** from that loop (who disagreed with what and why, which warnings mattered, what happened later). Feed them responsibly into **models, prompts, skills, routing, or evals** so the agent **continuously self-improves** on evidence from real judges—not generic web text. That flywheel becomes the **long-term**.

**Implementation note (today):** Mobile **Harmence** + gateway **`/v1/harmence/interview/*`** implement the scaffold for **Step 1**. Steps 2–6 are product/API/community + **governance** layers to build on the same structured draft + briefing pipeline (learning must stay **privacy-safe**, **consent-aligned**, aggregative where possible, and **auditable**).
