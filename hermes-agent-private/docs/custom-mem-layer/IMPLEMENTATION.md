# Persistent User Modeling Layer — Implementation Reference

**Status:** MVP Complete  
**Completed:** 2026-04-19  
**Spec:** `.omc/specs/deep-interview-hermes-selflearn.md`  
**Plan:** `.omc/plans/user-model-provider.md`

---

## What Was Built

A plugin that makes Hermes progressively learn each user's professional background, habits, and communication preferences across sessions — reducing repeated background questions and token consumption.

Two-track learning:
- **Track A (Registration):** Product app seeds role/domain/experience at session start
- **Track B (Inference):** After each session, LLM extracts new traits from the conversation and updates the user model

---

## Files Changed

### `hermes_state.py`

**What changed:** `SCHEMA_VERSION` bumped from 6 → 7. Added `user_models` table to `SCHEMA_SQL` and a `if current_version < 7:` migration block in `_init_schema()`.

**Why:** The user model is stored in the same `~/.hermes/state.db` SQLite database that Hermes already uses for sessions and messages. Adding a new table to the existing DB avoids a separate database file and shares WAL mode, connection pooling, and backup behavior.

**New table:**
```sql
CREATE TABLE IF NOT EXISTS user_models (
    user_id       TEXT PRIMARY KEY,
    profile_json  TEXT NOT NULL DEFAULT '{}',   -- registration data (authoritative)
    inferred_json TEXT NOT NULL DEFAULT '[]',   -- list of TraitDimension objects
    signal_vocab  TEXT NOT NULL DEFAULT '[]',   -- dynamic signal vocabulary
    created_at    REAL NOT NULL,
    updated_at    REAL NOT NULL
);
```

---

### `plugins/memory/user_model/__init__.py`

**What changed:** Created new file. Exports `UserModelProvider`.

**Why:** Required by Hermes plugin loader (`plugins/memory/__init__.py` imports `__init__.py` from plugin directories).

---

### `plugins/memory/user_model/plugin.json`

**What changed:** Created new file. Registers the plugin with Hermes.

**Why:** Hermes discovers plugins by scanning `plugins/memory/*/plugin.json`. The `provider_class` field tells the loader which class to instantiate.

```json
{
  "name": "user_model",
  "provider_class": "plugins.memory.user_model.provider.UserModelProvider",
  "description": "Persistent per-user profile. MUTUALLY EXCLUSIVE with Honcho/Mem0.",
  "config_keys": []
}
```

---

### `plugins/memory/user_model/store.py`

**What changed:** Created new file. All SQLite read/write for user profiles.

**Why:** Separates data persistence from business logic. All other plugin files go through this class — none touch SQLite directly.

**Key classes:**

```
TraitKeyword    value, confidence, updated_at
TraitDimension  field, keywords[], summary, summary_updated_at
UserModel       user_id, profile, inferred[], signal_vocab, updated_at
UserModelStore  seed_from_registration()
                get_model()
                update_inferred()        ← decay + reinforce + prune + cap
                update_signal_vocab()    ← decay + reinforce + prune + cap
                remove_inferred_dimension()
                get_compressed_context() ← formats system prompt block
```

**Decay/reinforce rules (applied in `update_inferred`):**
- Every existing keyword: `confidence × 0.95` per session (decay)
- Reinforced keyword: `min(1.0, decayed + evidence_strength × 0.5)`
- Prune: keywords below `0.3` are removed
- Cap: max 5 keywords per dimension, max 10 dimensions total (evict lowest confidence)
- Summary: only updated when Task A provides one (keyword delta detected)

---

### `plugins/memory/user_model/gate.py`

**What changed:** Created new file. Three-gate filter for `sync_turn`.

**Why:** Most user messages don't reveal professional traits. Running the LLM inferrer on every turn is expensive. The gate filters 90%+ of turns cheaply before any LLM is called.

**Gate logic:**
```
Gate 1 — len(message) > 30 chars?          FREE  ~0ms
          NO → skip (trivial ACK)

Gate 2 — any signal_vocab term substring?  FREE  ~0ms
          NO → skip (no trigger words)
          vocab stored in user's original language (no translation needed)

Gate 3 — LLM Haiku binary YES/NO           ~$0.001/call
          "Does this reveal professional background/preferences?"
          YES → queue for session-end inference
          Defaults to True on LLM failure (don't lose signals)
```

---

### `plugins/memory/user_model/inferrer.py`

**What changed:** Created new file. Session-end LLM inference engine.

**Why:** Trait extraction needs the full conversation transcript for accurate context. Running at session end (not per-turn) amortizes the LLM cost and avoids mid-conversation latency.

**Two parallel tasks (ThreadPoolExecutor, max_workers=2):**

| Task | Model | Input | Output |
|------|-------|-------|--------|
| Task A | Haiku | Full transcript + existing inferred dims | Updated TraitDimensions with summary |
| Task B | Haiku | Full transcript | Signal vocabulary terms (original language) |

**Guards:**
- `MIN_TURNS = 3` — skip if fewer than 3 user turns (not enough signal)
- `COOLDOWN_HOURS = 1` — skip if last inference was within 1 hour

**Critical design:** Task A generates `summary` **with access to the full transcript**, not from keywords alone. This prevents misinterpretation (e.g., keyword "direct" from "I'm direct" vs "please be more direct with me" have opposite meanings).

---

### `plugins/memory/user_model/bridge.py`

**What changed:** Created new file. Single function for product app integration.

**Why:** Provides a clean, documented API surface for the product app to seed registration data. The product app should call this on every session start (it is idempotent).

```python
from plugins.memory.user_model.bridge import seed_user_from_registration

seed_user_from_registration(
    user_id="user_123",
    registration_data={"role": "Product Manager", "domain": "B2B SaaS", "years_experience": 5},
    hermes_home=str(get_hermes_home()),
)
```

---

### `plugins/memory/user_model/provider.py`

**What changed:** Created new file. Implements `MemoryProvider` ABC — the main entrypoint.

**Why:** This is the class Hermes calls. It wires all other modules together and implements the lifecycle that `MemoryManager` expects.

**Lifecycle:**

```
initialize()          Load model from store. Build TurnGate + aux client.
system_prompt_block() Registration profile + all inferred summaries (position 7/9).
prefetch()            No-op. Profile fully covered by system_prompt_block().
sync_turn()           Run three-gate filter. Log signal if passes.
on_session_end()      Clear threading.Event. Start background thread → inferrer.run().
shutdown()            inference_event.wait(timeout=10.0)  ← mirrors Honcho pattern
get_tool_schemas()    Return []  ← pure context provider, no tools
```

**Shutdown race prevention:** `on_session_end()` is immediately followed by `shutdown_all()` in `run_agent.py`. A `threading.Event` (initially set = "done") is cleared before the inference thread starts and set again in the `finally` block. `shutdown()` waits up to 10 seconds on the event — same pattern as the Honcho plugin.

---

### `cli.py`

**What changed:** Extended `_handle_profile_command()` to display user model when `user_model` provider is active. Wired `args` through from the dispatch site.

**Why:** Users need visibility into what the agent has learned about them, and a way to correct wrong inferences.

**New behavior:**
```
/profile              Show Hermes profile + user model (registration + inferred traits)
/profile clear <field>  Remove a specific inferred dimension
```

**Example output:**
```
  Profile: default
  Home:    ~/.hermes

  -- User Model (user_id: user_123) --

  Registration:
    role: Product Manager
    domain: B2B SaaS
    years_experience: 5

  Inferred Traits:
    [communication_style]  avg confidence: 0.82
      Prefers direct, concise responses without lengthy preambles.
      · direct   (0.85)
      · concise  (0.79)

  Tip: /profile clear <field>  — remove a specific inferred dimension
```

---

### `~/.hermes/config.yaml`

**What changed:** `memory.provider` set from `''` to `'user_model'`.

**Why:** This activates the plugin. Hermes reads this field at startup and calls `load_memory_provider("user_model")`.

**Note:** This disables any previously configured Honcho or Mem0 provider. `MemoryManager` enforces one external provider at a time. To switch back:
```yaml
memory:
  provider: ''        # disable
  # provider: honcho  # or switch to another
```

---

## Data Model Summary

```
UserModel
├── profile (authoritative, never decays)
│     role, domain, years_experience, industry
│
├── inferred: list[TraitDimension]
│     TraitDimension
│     ├── field: "communication_style"
│     ├── keywords: [{value, confidence, updated_at}]  ← decay × 0.95/session
│     └── summary: "LLM-generated with transcript context"  ← no decay
│
└── signal_vocab: list[{term, trigger_for, confidence}]
      stored in user's original language
      decay × 0.95, cap 20 terms
```

---

## How to Run Tests

```bash
# Run all unit tests
uv run --extra dev pytest plugins/memory/user_model/tests/ -v --override-ini="addopts="

# Run a specific test file
uv run --extra dev pytest plugins/memory/user_model/tests/test_store.py -v --override-ini="addopts="
uv run --extra dev pytest plugins/memory/user_model/tests/test_gate.py -v --override-ini="addopts="
uv run --extra dev pytest plugins/memory/user_model/tests/test_provider.py -v --override-ini="addopts="
```

Expected: **38 passed**

---

## How to Validate

### 1. Schema migration
```bash
python -c "
from hermes_constants import get_hermes_home
import hermes_state
db = hermes_state.SessionDB(db_path=get_hermes_home() / 'state.db')
print('SCHEMA_VERSION:', hermes_state.SCHEMA_VERSION)
tables = [r[0] for r in db._conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()]
print('user_models in tables:', 'user_models' in tables)
"
```

### 2. Plugin loads correctly
```bash
python -c "
from plugins.memory import load_memory_provider
p = load_memory_provider('user_model')
print('name:', p.name)
print('is_available:', p.is_available())
"
```

### 3. AC1 — Registration data seeds model
```bash
python -c "
import tempfile
from pathlib import Path
import hermes_state
from plugins.memory.user_model.bridge import seed_user_from_registration
from plugins.memory.user_model.store import UserModelStore

with tempfile.TemporaryDirectory() as tmp:
    hermes_state.SessionDB(db_path=Path(tmp) / 'state.db')
    seed_user_from_registration('u1', {'role': 'PM', 'domain': 'SaaS'}, tmp)
    m = UserModelStore(hermes_home=tmp).get_model('u1')
    print('AC1 PASS:', m.profile)
"
```

### 4. AC6 — Multi-user isolation
```bash
python -c "
import tempfile
from pathlib import Path
import hermes_state
from plugins.memory.user_model.bridge import seed_user_from_registration
from plugins.memory.user_model.store import UserModelStore

with tempfile.TemporaryDirectory() as tmp:
    hermes_state.SessionDB(db_path=Path(tmp) / 'state.db')
    seed_user_from_registration('userA', {'role': 'PM'}, tmp)
    seed_user_from_registration('userB', {'role': 'Engineer'}, tmp)
    store = UserModelStore(hermes_home=tmp)
    store.update_inferred('userA', [{'field': 'style', 'keywords': [{'value': 'direct', 'evidence_strength': 0.9}], 'summary': 'Direct'}])
    mb = store.get_model('userB')
    assert not any(d.field == 'style' for d in mb.inferred)
    print('AC6 PASS: UserB unaffected by UserA update')
"
```

### 5. AC7 — Graceful degradation
```bash
python -c "
import tempfile
from pathlib import Path
import hermes_state
from unittest.mock import patch
from plugins.memory.user_model.provider import UserModelProvider
from plugins.memory.user_model.store import UserModelStore

with tempfile.TemporaryDirectory() as tmp:
    hermes_state.SessionDB(db_path=Path(tmp) / 'state.db')
    p = UserModelProvider()
    with patch('agent.auxiliary_client.get_text_auxiliary_client', return_value=(None, None)):
        p.initialize('s', user_id='ghost', hermes_home=tmp)
    assert p.system_prompt_block() == ''
    assert p.prefetch('hello') == ''
    p.sync_turn('hello', 'world')
    p.on_session_end([])
    p.shutdown()
    print('AC7 PASS: no exception, empty prompt for unknown user')
"
```

### 6. AC5 — Token reduction (requires real usage data)
```bash
# Run after accumulating sessions with the plugin active
python plugins/memory/user_model/verify_ac5.py

# With options
python plugins/memory/user_model/verify_ac5.py --days 60
python plugins/memory/user_model/verify_ac5.py --source telegram
```

Target: profiled users (session 3+) show ≥30% fewer avg input tokens/turn vs new users.

The script reads directly from `~/.hermes/state.db` and joins `sessions` with `user_models` to compute the comparison.

---

## Activate / Deactivate

**Activate:**
```yaml
# ~/.hermes/config.yaml
memory:
  provider: 'user_model'
```

**Deactivate (back to no external provider):**
```yaml
memory:
  provider: ''
```

**Switch to Honcho:**
```yaml
memory:
  provider: 'honcho'
```

Note: Only one external provider can be active at a time. `MemoryManager` will log a warning and reject a second registration.

---

## Product App Integration

In the product app, call `seed_user_from_registration` when a user starts a session:

```python
from plugins.memory.user_model.bridge import seed_user_from_registration
from hermes_constants import get_hermes_home

# On session start (idempotent — safe to call every time)
seed_user_from_registration(
    user_id=user.id,                    # your platform's user identifier
    registration_data={
        "role": user.job_title,
        "domain": user.product_domain,
        "years_experience": user.years_exp,
        "industry": user.industry,
    },
    hermes_home=str(get_hermes_home()),
)
```

Then start the Hermes session with `user_id` in kwargs — `run_agent.py` already passes it through to `initialize()` via `_init_kwargs` (lines 1286-1287).
