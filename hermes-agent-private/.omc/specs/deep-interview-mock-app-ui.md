# Deep Interview Spec: Mock App UI — smart_talk toggle, one-question enforcement, markdown rendering

## Metadata
- Interview ID: mock-app-3tasks
- Rounds: 2
- Final Ambiguity Score: 17.5%
- Type: brownfield
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.85 | 35% | 0.298 |
| Constraint Clarity | 0.80 | 25% | 0.200 |
| Success Criteria | 0.80 | 25% | 0.200 |
| Context Clarity | 0.85 | 15% | 0.128 |
| **Total Clarity** | | | **0.826** |
| **Ambiguity** | | | **17.5%** |

---

## Task 1: Smart Talk Toggle Button

### Goal
Add a toggle button in the ChatPanel input area. When ON, every user message forces the full smart_talk skill flow (skill_view → multi-round clarify → crystallize spec). When OFF, the current ephemeral prompt behavior applies (agent uses smart_talk only when it detects ambiguity).

### Constraints
- Toggle is session-scoped (resets on page reload — acceptable for mock app)
- Toggle position: left side of the input row, before the textarea
- Visual: pill toggle, dark style matching existing UI

### Implementation Plan
1. `models.py` — add `smart_talk_mode: bool = False` to `SendMessageRequest`
2. `agent_bridge.py` — `send_message(content, smart_talk_mode=False)` + `_make_agent(token_queue, smart_talk_mode=False)` use a STRONGER ephemeral prompt when ON
3. `main.py` — pass `req.smart_talk_mode` to `session.send_message`
4. `api.ts` — `streamMessage` accepts `smartTalkMode: boolean`, sends in request body
5. `page.tsx` — `smartTalkMode` state, pass to `handleSend` → `streamMessage`
6. `ChatPanel.tsx` — render toggle pill left of textarea, emit `onToggle` callback

### Ephemeral prompt when toggle is ON
```
You MUST invoke the smart_talk skill on EVERY message. Do this by calling
skill_view("smart_talk") immediately before any other action. Never skip this
even if the request seems clear. Do not answer directly — always go through
smart_talk first.
```

### Acceptance Criteria
- [ ] Toggle button visible in input row when session is active
- [ ] Toggle ON → agent calls skill_view("smart_talk") on every turn
- [ ] Toggle OFF → current behavior (ambiguity-triggered only)
- [ ] Toggle state does not persist across page reloads

---

## Task 2: One Question Per Round Enforcement

### Goal
The agent currently ignores the "one question per round" instruction and outputs markdown checkbox lists with multiple questions. Fix this so smart_talk always calls `clarify()` exactly ONCE per round, never batching questions in text output.

### Root Cause
SKILL.md says "one targeted question per round" in the overview, but does not explicitly FORBID writing questions as markdown text or batching multiple topics. The LLM interprets the instruction loosely.

### Fix: SKILL.md hardening (Phase 2 Step D)

Add explicit prohibitions:
```
STRICT RULES — violation breaks the skill:
1. Call clarify() EXACTLY ONCE per round. Never more.
2. NEVER write questions as plain text or markdown (no "?" in response text).
3. NEVER output [ ] checkbox lists — always use clarify() choices instead.
4. NEVER ask about multiple dimensions in one question.
5. After calling clarify(), STOP. Wait for the user's response before proceeding.
```

### Acceptance Criteria
- [ ] Each smart_talk round produces exactly one `clarify()` tool call
- [ ] Agent response text before `clarify()` contains no question marks
- [ ] No `[ ]` checkbox patterns in agent response text
- [ ] After clarify() call, agent waits for user input before next round

---

## Task 3: Markdown Rendering + Choices Consistency

### Goal
1. Agent markdown output should render properly (tables, bold, code, etc.)
2. `[ ]` checkboxes should NEVER appear — clarify() tool handles all choices
3. When agent uses clarify() correctly, choices appear as buttons (already implemented)

### Root Cause Analysis
- `remark-gfm` is not installed → GFM tables don't render (show as `| col | col |` text)
- Agent outputs `[ ] 选项` because it ignores the one-question rule (fixed by Task 2)
- Once Task 2 is fixed, `[ ]` will be replaced by proper clarify() button UI

### Fix
1. Install `remark-gfm` in mock-app/frontend
2. Add `remarkPlugins={[remarkGfm]}` to MessageBubble's ReactMarkdown
3. Task 2 fix eliminates `[ ]` from agent output — no separate parsing needed

### Acceptance Criteria
- [ ] GFM tables render as visual tables in MessageBubble
- [ ] Bold, italic, code blocks render correctly  
- [ ] No `[ ]` checkbox text visible after Task 2 is applied
- [ ] clarify() choices render as blue pill buttons (already working)

---

## Technical Context (Brownfield)

| File | Current State | Change Needed |
|------|--------------|---------------|
| `mock-app/frontend/src/components/MessageBubble.tsx` | ReactMarkdown, no remark-gfm | Add remarkGfm plugin |
| `mock-app/frontend/package.json` | react-markdown ^9.0.1 only | Add remark-gfm |
| `mock-app/frontend/src/components/ChatPanel.tsx` | No toggle | Add toggle pill, onToggle prop |
| `mock-app/frontend/src/app/page.tsx` | No smart_talk_mode state | Add state + pass to streamMessage |
| `mock-app/frontend/src/lib/api.ts` | streamMessage no mode param | Add smartTalkMode param |
| `mock-app/backend/models.py` | SendMessageRequest no mode | Add smart_talk_mode field |
| `mock-app/backend/main.py` | Hardcoded send_message call | Pass smart_talk_mode |
| `mock-app/backend/agent_bridge.py` | Fixed ephemeral prompt | Conditional strong prompt |
| `skills/smart_talk/SKILL.md` | Weak one-question wording | Strict rules block in Step D |

## Interview Transcript
<details>
<summary>Full Q&A (2 rounds)</summary>

### Round 1
**Q:** 截图里 agent 输出的 checkbox 列表（[ ] 薪资最大化）和 table，你希望哪些变成可以点击的 button？
**A:** agent response应该就是选项 也就是说markdown的那些跟clarify工具的问题应该是一致的 不应该不一样才对
**Ambiguity:** 34% → 23%

### Round 2
**Q:** Toggle 打开后，agent 应该怎么工作？
**A:** 每次都强制进 smart_talk 流程
**Ambiguity:** 23% → 17.5% ✓

</details>
