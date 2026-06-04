# smart_talk clarify 双队列时序流程

## 架构概览

```
Agent 线程 (ThreadPoolExecutor)
    ↕ token_queue (thread-safe Queue)
SSE 协程 (asyncio event loop)
    ↕ HTTP SSE 长连接
前端 ReadableStream
    ↕ fetch POST /clarify-reply
FastAPI 端点
    ↕ _clarify_queue (thread-safe Queue)
Agent 线程 ← 解锁
```

两个 Queue 是整个系统的核心：
- `token_queue`：**单向数据管道**（agent → 前端）
- `_clarify_queue`：**反向控制信号**（前端 → agent）

---

## 时序图

```
前端              FastAPI/asyncio        Agent 线程
 │                      │                    │
 │─── POST /messages ──>│                    │
 │                      │── run_in_executor ─>│
 │<══ SSE 连接建立 ═════│                    │
 │<── delta ────────────│<── token_queue ────│
 │<── delta ────────────│<── token_queue ────│
 │<── clarify ──────────│<── token_queue ────│ clarify_cb: queue.get() ⏸
 │ 渲染按钮             │   asyncio 继续等    │ 线程阻塞
 │                      │                    │
 │─── POST /clarify-reply ─────────────────>│
 │                      │── _clarify_queue.put("Yes") ──>│ ▶ 解锁
 │<── {"ok":true} ──────│                    │
 │                      │<── token_queue ────│ clarify_cb 返回
 │<── delta ────────────│<── token_queue ────│ 继续生成
 │<── done ─────────────│<── __done__ ───────│
```

---

## 各阶段技术细节

### Phase 1：建立 SSE 连接 + 启动 agent 线程

`POST /messages` → `send_message` async generator 初始化两个 Queue：

```python
token_queue = queue.Queue()       # agent → 前端
self._clarify_queue = queue.Queue()  # 前端 → agent（本轮专属）
```

`run_in_executor` 把 agent 丢进线程池（非阻塞），asyncio event loop 通过
`asyncio.to_thread(token_queue.get, True, 360)` 异步等待新消息。

FastAPI 把 async generator 包成 `StreamingResponse`，HTTP 连接保持开着。

### Phase 2：正常 delta 流

Agent 线程每生成一个 token → `token_queue.put(("delta", text))`

asyncio while loop 读到 → `yield SSE delta` → 前端 `ReadableStream` 实时更新。

### Phase 3：agent 调用 clarify → 线程阻塞

`run_agent.py` 分发 clarify tool call → `clarify_cb(question, choices)`：

```python
def clarify_cb(question, choices):
    token_queue.put(("clarify", {...}))   # 非阻塞，立即写入
    return self._clarify_queue.get(timeout=300)  # ← 线程在此阻塞
```

asyncio 读到 `"clarify"` → `yield SSE clarify event` → 前端 `setClarifyPrompt`
→ 渲染选项按钮。**SSE 连接仍然保持，reader 等待新数据。**

### Phase 4：用户点击 → 队列解锁

```
前端: POST /clarify-reply {"choice": "Yes"}
FastAPI: session.respond_to_clarify("Yes")
       → _clarify_queue.put("Yes")
       → agent 线程的 .get() 解锁
       → clarify_cb 返回 "Yes"
       → tool result 回到 agent context
       → 继续 LLM 推理
```

### Phase 5：对话恢复

Agent 继续生成，`token_queue` 重新有 delta，SSE 继续流，前端继续更新，
最终收到 `__done__` → `_clarify_queue = None`（清理），SSE 连接关闭。

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `mock-app/backend/agent_bridge.py` | 双队列定义、clarify_cb、respond_to_clarify、SSE loop |
| `mock-app/backend/main.py` | `POST /clarify-reply` 端点 |
| `mock-app/frontend/src/lib/api.ts` | SSE 解析、onClarify 回调、sendClarifyReply |
| `mock-app/frontend/src/app/page.tsx` | clarifyPrompt state、handleChoiceSelect |
| `mock-app/frontend/src/components/ChatPanel.tsx` | 选项按钮渲染 |
| `skills/smart_talk/SKILL.md` | smart_talk skill 定义（4 维度、问题库、状态管理） |
| `tools/smart_talk_state_tool.py` | 跨 round 状态持久化 |
| `tools/clarify_tool.py` | clarify tool schema + callback 分发 |
