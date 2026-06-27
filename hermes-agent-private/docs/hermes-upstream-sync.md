# Hermes Upstream Sync Guide

Sync `hermes-agent-private/` with the public `nousresearch/hermes-agent` upstream
using `git subtree`. Each sync is a normal PR — never commit directly to `main`.

---

## One-time setup (already done)

```bash
# Add upstream remote — repo-wide, persists across all branches
git remote add hermes-upstream https://github.com/NousResearch/hermes-agent.git
```

> **Note:** remotes are stored in `.git/config` and are NOT pushed to GitHub.
> Every team member who clones the repo needs to run this once locally.

---

## Sync workflow (each new upstream release)

### Step 1 — Find the new tag

```bash
gh release list --repo NousResearch/hermes-agent --limit 5
```

### Step 2 — Create a PR branch off main

```bash
git checkout main && git pull origin main
git checkout -b sync/hermes-v<X.Y.Z>
```

### Step 3 — Fetch and merge upstream

```bash
HERMES_TAG="v2026.6.19"   # ← update to new tag

git fetch hermes-upstream "$HERMES_TAG"

git subtree merge \
  --prefix=hermes-agent-private \
  hermes-upstream/"$HERMES_TAG" \
  --squash
```

Git will automatically diff every file under `hermes-agent-private/`.
Files that only exist in your private repo (e.g. `plugins/memory/user_model/`)
will have no conflicts. Files modified in both places (e.g. `agent/skill_commands.py`)
will be marked as conflicts — resolve them, then:

```bash
git add .
git commit -m "chore: sync hermes-upstream $HERMES_TAG"
```

### Step 4 — Verify imports still work

```bash
cd hermes-agent-private

python3 -c "
from agent.memory_manager import MemoryManager
from plugins.memory.user_model.provider import UserModelProvider
p = UserModelProvider()
mgr = MemoryManager()
mgr.add_provider(p)
print('OK', len(mgr.providers), 'providers')
"
```

### Step 5 — Fix plugin compat if needed

Check if `sync_turn` or other provider lifecycle hooks gained new kwargs:

```bash
grep -A 6 "def sync_turn" /tmp/hermes-upstream/agent/memory_provider.py
grep -A 4 "def sync_turn" plugins/memory/user_model/provider.py
```

If upstream base class added new kwargs (e.g. `messages=None`), add them to
the plugin too so `MemoryManager.sync_all()` doesn't raise `TypeError`:

```python
# plugins/memory/user_model/provider.py
def sync_turn(
    self, user_content: str, assistant_content: str, *,
    session_id: str = "",
    messages: Optional[List[Dict[str, Any]]] = None,  # ← match upstream
) -> None:
```

### Step 6 — PR and delete branch

Open a PR `sync/hermes-vX.Y.Z → main`, get it reviewed and merged.
Delete the sync branch after merge. Feature branches opened after the merge
automatically inherit the upstream changes.

---

## Common conflicts to expect

| File | Why it conflicts | Resolution |
|---|---|---|
| `agent/skill_commands.py` | We appended extraction helpers that upstream added later | Keep our version if identical; otherwise keep upstream's |
| `agent/memory_manager.py` | Core file, both sides evolve | Take upstream; verify user_model plugin still works |
| `agent/memory_provider.py` | ABC — take upstream wholesale | Safe to replace |

---

## What NOT to sync

| Path | Reason |
|---|---|
| `plugins/memory/user_model/` | 100% custom — not in upstream |
| `mock-app/` | ShouldI-specific backend |

---

## Sync history

| Date | Upstream tag | Method | Files changed |
|---|---|---|---|
| 2026-06-26 | v2026.6.19 (0.17.0) | Manual (pre-subtree setup) | `agent/memory_provider.py`, `agent/memory_manager.py`, `agent/skill_commands.py` (+extract fn), `plugins/memory/user_model/provider.py` (+messages kwarg) |
| _(next)_ | _(new tag)_ | `git subtree merge --squash` | — |
