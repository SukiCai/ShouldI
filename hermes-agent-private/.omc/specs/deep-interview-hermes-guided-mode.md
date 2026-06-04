# Deep Interview Spec: Hermes Guided Workflow Mode

## Metadata
- Interview ID: hermes-guided-mode-001
- Rounds: 5
- Final Ambiguity Score: 16%
- Type: brownfield
- Generated: 2026-05-03
- Threshold: 20%
- Status: PASSED

---

## Clarity Breakdown

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.88 | 35% | 0.308 |
| Constraint Clarity | 0.78 | 25% | 0.195 |
| Success Criteria | 0.85 | 25% | 0.213 |
| Context Clarity | 0.82 | 15% | 0.123 |
| **Total Clarity** | | | **0.839** |
| **Ambiguity** | | | **16%** |

---

## Goal

Build a `guided` mode for Hermes Agent that, once activated by a user command, drives the conversation with step-by-step yes/no checkpoints throughout task execution — minimizing the user's typing burden by replacing open-ended replies with tappable Yes/No choices (plus an optional free-text 3rd option when binary isn't sufficient). The mode is prompt-driven: a system prompt block instructs the agent to use `clarify_tool` after each meaningful execution step.

---

## Constraints

- **Activation**: User-triggered only — via a command prefix (e.g., `/guided <intent>` or a mode toggle like `/guided on`). Never activates automatically.
- **Prompt-driven**: Behavior is enforced through a system prompt injection, not a middleware layer or output interceptor. The agent is responsible for calling `clarify_tool` at checkpoints.
- **Minimal questions**: The agent must ask as FEW questions as possible — not just reformat every output as yes/no. Both question frequency AND format are constrained.
- **Three-option clarify**: Every `clarify_tool` call in guided mode must offer exactly 3 options: `["Yes", "No", "Let me explain"]`. The 3rd option triggers a free-form text reply from the user.
- **Platform-agnostic**: Must work across all platforms Hermes supports (Telegram, Discord, CLI, etc.) since `clarify_tool` already delegates to platform callbacks.
- **Builds on existing infrastructure**: Uses `clarify_tool` (tools/clarify_tool.py), `system_prompt_block()` injection pattern (same as memory plugins), and `AIAgent.run_conversation()` without modifying the core conversation loop.

---

## Non-Goals

- Automatic/agent-triggered activation — this version is always user-opt-in.
- Middleware output interception or forced reformatting of agent messages.
- Limiting the initial user intent statement — the first message is always free-form.
- Changing behavior for users who have NOT activated guided mode.
- Voice/TTS compatibility (out of scope for v1).

---

## Acceptance Criteria

- [ ] User can activate guided mode with a command (e.g., `/guided <intent>` or `/guided on` followed by intent)
- [ ] Once activated, the agent calls `clarify_tool` after each meaningful step with choices `["Yes", "No", "Let me explain"]`
- [ ] Agent does NOT ask more than 3 yes/no questions for any single task (enforced via system prompt instruction)
- [ ] Selecting "Let me explain" prompts a free-form text reply from the user; the agent incorporates that answer and continues
- [ ] Selecting "No" causes the agent to pause, explain what it was about to do differently, and offer a revised approach
- [ ] Guided mode state is visible — the agent (or system) confirms "Guided mode active" when activated
- [ ] Mode deactivates at end of task or when user sends `/guided off` (or equivalent)
- [ ] All existing non-guided conversations are completely unaffected
- [ ] Works in CLI (prompt_toolkit choices) and at minimum one gateway platform (Telegram or Discord)

---

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| Reducing reply FORMAT is the core value | What if reducing question FREQUENCY matters more? | **Both** are constraints — agent must ask few AND yes/no |
| Mode should be always-on | Could be config flag or agent auto-detect | User-triggered command — explicit opt-in only |
| System should intercept/reformat output | Prompt-driven is simpler | Prompt-driven confirmed — agent handles formatting |
| Flow is clarify-before-execute | Could be clarify-after-each-step | Step-by-step checkpoints confirmed — execute → checkpoint → execute |

---

## Technical Context

### Existing codebase anchors (brownfield)

| File | Relevance |
|------|-----------|
| `tools/clarify_tool.py:23` | Core interactive tool — already supports `question + choices + callback`. No changes needed to the tool itself. |
| `run_agent.py:8237` (`AIAgent.run_conversation`) | Main agent loop. Guided mode injects into system prompt; no loop changes needed. |
| `gateway/run.py:2732` (`_handle_message`) | Message pipeline — command parsing for `/guided` activation goes here or in a pre-processing step. |
| `gateway/session.py` | Session tracking — guided mode activation state should be stored in session context. |
| `plugins/memory/user_model/provider.py` | Reference pattern for `system_prompt_block()` injection — guided mode follows the same pattern. |
| `agent/memory_manager.py` | Orchestrates system prompt assembly — guided mode block slots in alongside memory context. |

### Implementation approach

1. **Command parsing**: Detect `/guided` prefix in `_handle_message()` (or a pre-processing hook). Extract intent from the remainder of the message. Store `session.guided_mode = True` in session context.

2. **System prompt injection**: When `guided_mode=True`, append a guided mode block to the assembled system prompt:
   ```
   <guided-mode>
   You are in Guided Mode. Rules:
   - After each meaningful action or decision point, call clarify_tool with the question summarizing what you just did and what comes next. Always pass choices=["Yes", "No", "Let me explain"].
   - Ask at most 3 clarifying questions per task. If intent is clear, skip straight to execution with minimal interruption.
   - If the user selects "No", pause, explain the alternative approach in one sentence, and ask again.
   - If the user selects "Let me explain", wait for their free-form input before continuing.
   - Never ask an open-ended question — every question must be answerable with Yes or No.
   </guided-mode>
   ```

3. **Deactivation**: Clear `session.guided_mode` when the task completes (stop_reason reaches end of conversation) or when user sends `/guided off`.

4. **No changes to core loop**: `AIAgent.run_conversation()` is untouched. The agent's behavior changes purely through the system prompt delta.

---

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| User | core domain | user_id, platform, guided_mode_active | activates GuidedMode, provides intent, answers AgentQuestions |
| GuidedMode | core domain | active, activation_command, session_id | injected into SystemPrompt, governs AgentQuestion format |
| AgentQuestion | core domain | question_text, choices=[Yes,No,Explain], step_index | part of Task, sent via clarify_tool |
| SystemPrompt | supporting | base_prompt, memory_block, guided_mode_block | assembled per-turn, includes GuidedMode block when active |
| Task | core domain | intent, steps_completed, current_step | decomposed into AgentQuestions at checkpoints |

---

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 4 | 4 | — | — | N/A |
| 2 | 4 | 0 | 1 (Command→AgentQuestion) | 3 | 75% |
| 3 | 4 | 0 | 1 (Conversation→SystemPrompt) | 3 | 75% |
| 4 | 5 | 1 (Task) | 0 | 4 | 80% |
| 5 | 5 | 0 | 0 | 5 | **100%** |

Ontology converged at Round 5. All 5 entities stable for 2 consecutive rounds.

---

## Interview Transcript

<details>
<summary>Full Q&A (5 rounds)</summary>

### Round 1
**Q:** How should this guided workflow mode activate?
**A:** User-triggered command
**Ambiguity:** 49% (Goal: 0.65, Constraints: 0.40, Criteria: 0.30, Context: 0.72)

### Round 2
**Q:** What's the primary pain point this mode solves — too much typing to respond, or agent executes without confirmation?
**A:** Too much typing to respond
**Ambiguity:** 39% (Goal: 0.72, Constraints: 0.45, Criteria: 0.55, Context: 0.73)

### Round 3
**Q:** When the agent asks a question in guided mode, how should yes/no formatting work?
**A:** Agent decides (prompt-driven)
**Ambiguity:** 30% (Goal: 0.78, Constraints: 0.65, Criteria: 0.60, Context: 0.78)

### Round 4 — [CONTRARIAN MODE]
**Q:** If guided mode still results in 8 yes/no questions per task, is that better than 3 open-ended questions?
**A:** Both matter — few AND yes/no
**Ambiguity:** 22% (Goal: 0.83, Constraints: 0.75, Criteria: 0.72, Context: 0.79)

### Round 5
**Q:** After a user activates guided mode and states their intent, what's the ideal interaction sequence?
**A:** Intent → step-by-step yes/no checkpoints
**Ambiguity:** 16% (Goal: 0.88, Constraints: 0.78, Criteria: 0.85, Context: 0.82)

</details>
