"""Bridge between FastAPI and the Hermes AIAgent.

Wraps AIAgent in a per-session HermesSession that exposes an async generator
yielding SSE-formatted strings as the model streams tokens.
"""

from __future__ import annotations

import asyncio
import json
import os
import queue
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

# Ensure the hermes-agent repo root is importable so we can import AIAgent and plugins.
_HERMES_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _HERMES_ROOT not in sys.path:
    sys.path.insert(0, _HERMES_ROOT)

from hermes_constants import get_hermes_home  # noqa: E402

_executor = ThreadPoolExecutor(max_workers=8)
_sessions: dict[str, "HermesSession"] = {}


def _extract_skills_used(messages: list) -> list[str]:
    """Return unique skill names loaded via skill_view() in a list of messages."""
    skills: list[str] = []
    for msg in messages:
        if not isinstance(msg, dict) or msg.get("role") != "assistant":
            continue
        content = msg.get("content", [])
        # Anthropic format: content is a list of typed blocks
        if isinstance(content, list):
            for block in content:
                if (
                    isinstance(block, dict)
                    and block.get("type") == "tool_use"
                    and block.get("name") == "skill_view"
                ):
                    name = (block.get("input") or {}).get("name", "")
                    if name and name not in skills:
                        skills.append(name)
        # OpenAI format: tool_calls array on the message
        for tc in msg.get("tool_calls") or []:
            if not isinstance(tc, dict):
                continue
            fn = tc.get("function", {})
            if fn.get("name") == "skill_view":
                try:
                    args = json.loads(fn.get("arguments", "{}"))
                    name = args.get("name", "")
                    if name and name not in skills:
                        skills.append(name)
                except Exception:
                    pass
    return skills


class HermesSession:
    """Per-user chat session wrapping Hermes AIAgent with SSE streaming."""

    def __init__(self, user_id: str, registration_data: dict):
        self.session_id = str(uuid.uuid4())
        self.user_id = user_id
        self.history: list[dict] = []
        self.gate_log: list[dict] = []
        self._hermes_home = str(get_hermes_home())
        self._registration_data = registration_data
        self._clarify_queue: Optional[queue.Queue] = None

        # Seed registration data into the UserModelStore so the agent can use it.
        from plugins.memory.user_model.bridge import seed_user_from_registration

        seed_user_from_registration(user_id, registration_data, self._hermes_home)

    @staticmethod
    def _load_hermes_config() -> dict:
        """Read model/provider settings from ~/.hermes/config.yaml."""
        import yaml
        from hermes_constants import get_hermes_home
        cfg_path = get_hermes_home() / "config.yaml"
        if cfg_path.exists():
            with open(cfg_path) as f:
                return yaml.safe_load(f) or {}
        return {}

    @staticmethod
    def _resolve_api_key(provider: str) -> str | None:
        """Look up the API key for a provider from the environment."""
        env_map = {
            "openrouter": "OPENROUTER_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "openai": "OPENAI_API_KEY",
            "google": "GOOGLE_API_KEY",
        }
        env_var = env_map.get((provider or "").lower())
        if env_var:
            return os.environ.get(env_var)
        # Generic fallback: <PROVIDER>_API_KEY
        if provider:
            return os.environ.get(f"{provider.upper()}_API_KEY")
        return None

    _SMART_TALK_FORCE_PROMPT = (
        'smart_talk mode is ACTIVE. For EVERY user message: call skill_view("smart_talk") '
        "and follow its protocol exactly as written — do not summarize or skip steps.\n"
        "One critical rule the skill requires: asking the user anything MUST be done via "
        "the clarify() tool call, never as plain text in your response."
    )
    _SMART_TALK_SUGGEST_PROMPT = (
        'If the user mentions "smart_talk" by name or asks to use/run it, immediately call '
        'skill_view("smart_talk") and follow its protocol — do not explain or ask first.\n'
        'Also: when any request is ambiguous — unclear intent, scope, or success criteria — '
        'proactively invoke the smart_talk skill by calling skill_view("smart_talk") '
        "before taking any action. Do not guess or assume; clarify first."
    )

    def _make_agent(self, token_queue: "queue.Queue", smart_talk_mode: bool = False):
        from run_agent import AIAgent

        cfg = self._load_hermes_config()
        model_cfg = cfg.get("model", {})
        provider = model_cfg.get("provider")
        api_key = self._resolve_api_key(provider)

        def on_delta(text):
            if text is None:
                token_queue.put(("done_signal", None))
            else:
                token_queue.put(("delta", text))

        def clarify_cb(question: str, choices):
            token_queue.put(("clarify", {"question": question, "choices": choices or []}))
            try:
                return self._clarify_queue.get(timeout=300)
            except Exception:
                return ""

        return AIAgent(
            model=model_cfg.get("default", ""),
            provider=provider,
            base_url=model_cfg.get("base_url"),
            api_key=api_key,
            api_mode=model_cfg.get("api_mode"),
            session_id=self.session_id,
            user_id=self.user_id,
            stream_delta_callback=on_delta,
            clarify_callback=clarify_cb,
            quiet_mode=False,
            platform="mock_app",
            max_tokens=32768,  # smart_talk needs room for multi-round analysis + tool calls
            ephemeral_system_prompt=(
                self._SMART_TALK_FORCE_PROMPT if smart_talk_mode else self._SMART_TALK_SUGGEST_PROMPT
            ),
        )

    def respond_to_clarify(self, choice: str) -> None:
        if self._clarify_queue is not None:
            self._clarify_queue.put(choice)

    async def send_message(self, content: str, smart_talk_mode: bool = False):
        """Async generator yielding SSE-formatted strings."""
        token_queue: "queue.Queue" = queue.Queue()
        self._clarify_queue = queue.Queue()
        result_holder: dict = {}

        def run():
            try:
                agent = self._make_agent(token_queue, smart_talk_mode=smart_talk_mode)
                result = agent.run_conversation(
                    user_message=content,
                    conversation_history=list(self.history),
                )
                result_holder["result"] = result
            except Exception as e:  # noqa: BLE001
                token_queue.put(("error", str(e)))
            finally:
                token_queue.put(("__done__", None))

        loop = asyncio.get_event_loop()
        loop.run_in_executor(_executor, run)

        accumulated = ""
        while True:
            try:
                # 360 s > clarify_cb's 300 s block so interactive questions don't time out
                kind, data = await asyncio.to_thread(token_queue.get, True, 360)
            except Exception:
                yield f"data: {json.dumps({'type': 'error', 'content': 'timeout'})}\n\n"
                break

            if kind == "delta":
                accumulated += data
                yield f"data: {json.dumps({'type': 'delta', 'content': data})}\n\n"
            elif kind == "clarify":
                yield f"data: {json.dumps({'type': 'clarify', 'question': data['question'], 'choices': data['choices']})}\n\n"
            elif kind == "done_signal":
                # First end-of-stream signal from the callback. Keep pumping
                # until the worker thread completes so we can capture the
                # final result and update history.
                continue
            elif kind == "error":
                yield f"data: {json.dumps({'type': 'error', 'content': data})}\n\n"
                self._clarify_queue = None
                break
            elif kind == "__done__":
                result = result_holder.get("result", {})
                skills_used: list[str] = []
                if isinstance(result, dict):
                    final = result.get("final_response", accumulated) or accumulated
                    msgs = result.get("messages", [])
                    old_len = len(self.history)
                    if msgs:
                        self.history = [m for m in msgs if isinstance(m, dict)]
                        new_msgs = self.history[old_len:]
                    else:
                        self.history.append({"role": "user", "content": content})
                        self.history.append({"role": "assistant", "content": final})
                        new_msgs = []
                    skills_used = _extract_skills_used(new_msgs)
                    payload = final
                else:
                    self.history.append({"role": "user", "content": content})
                    self.history.append({"role": "assistant", "content": accumulated})
                    payload = accumulated
                self._clarify_queue = None
                self._log_gate(content)
                if skills_used:
                    yield f"data: {json.dumps({'type': 'skills_used', 'skills': skills_used})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'content': payload})}\n\n"
                break

    def _log_gate(self, user_content: str) -> None:
        """Record gate 1+2 results for the completed user turn."""
        try:
            from plugins.memory.user_model.store import UserModelStore
            store = UserModelStore(hermes_home=self._hermes_home)
            model = store.get_model(self.user_id)
            vocab: list[str] = model.signal_vocab if model else []
        except Exception:
            vocab = []

        terms = [t["term"] for t in vocab if isinstance(t, dict) and "term" in t]
        gate1 = len(user_content) > 30
        matched = [t for t in terms if t.lower() in user_content.lower()] if gate1 else []
        gate2 = bool(matched)

        self.gate_log.append({
            "turn": len(self.gate_log) + 1,
            "preview": user_content[:100],
            "gate1": gate1,
            "gate2": gate2,
            "matched_terms": matched,
        })

    def get_gate_log(self) -> list[dict]:
        return list(self.gate_log)

    def get_profile(self) -> Optional[dict]:
        try:
            from plugins.memory.user_model.store import UserModelStore

            store = UserModelStore(hermes_home=self._hermes_home)
            model = store.get_model(self.user_id)
            if not model:
                return None
            return {
                "user_id": model.user_id,
                "profile": model.profile,
                "inferred": [
                    {
                        "field": d.field,
                        "keywords": [
                            {"value": k.value, "confidence": round(k.confidence, 3)}
                            for k in d.keywords
                        ],
                        "summary": d.summary,
                    }
                    for d in model.inferred
                ],
                "signal_vocab": model.signal_vocab,
                "updated_at": model.updated_at,
            }
        except Exception:
            return None

    def update_registration(self, registration_data: dict) -> None:
        """Re-seed the user model with updated registration data."""
        from plugins.memory.user_model.bridge import seed_user_from_registration

        self._registration_data = registration_data
        seed_user_from_registration(self.user_id, registration_data, self._hermes_home)

    def get_system_prompt_context(self) -> str:
        try:
            from plugins.memory.user_model.store import UserModelStore
            store = UserModelStore(hermes_home=self._hermes_home)
            ctx = store.get_compressed_context(self.user_id)
            return ctx or "(No user model context yet — start chatting)"
        except Exception as e:
            return f"(Error: {e})"

    def trigger_inference(self) -> None:
        """Run session-end trait inference against the current conversation history."""
        import dataclasses, threading, time
        from plugins.memory.user_model.store import UserModelStore
        from plugins.memory.user_model.inferrer import UserModelInferrer, MIN_TURNS

        user_turns = [m for m in self.history if m.get("role") == "user"]
        print(f"[trigger_inference] user_id={self.user_id} history_len={len(self.history)} user_turns={len(user_turns)}")

        if not self.history:
            print("[trigger_inference] SKIP: no history")
            return

        if len(user_turns) < MIN_TURNS:
            print(f"[trigger_inference] SKIP: only {len(user_turns)} user turns, need {MIN_TURNS}")
            return

        store = UserModelStore(hermes_home=self._hermes_home)
        model = store.get_model(self.user_id)
        if not model:
            print("[trigger_inference] SKIP: no user model in store")
            return

        try:
            from agent.auxiliary_client import get_text_auxiliary_client
            aux_client, aux_model = get_text_auxiliary_client(task="user_model")
            print(f"[trigger_inference] aux_client={aux_client is not None} aux_model={aux_model}")
        except Exception as e:
            print(f"[trigger_inference] SKIP: aux client unavailable — {e}")
            aux_client, aux_model = None, None
            return

        if not aux_client:
            print("[trigger_inference] SKIP: aux_client is None")
            return

        # Bypass the 1-hour cooldown for manual trigger in mock app.
        model_force = dataclasses.replace(model, updated_at=0.0)

        def _infer():
            try:
                inferrer = UserModelInferrer(store, aux_client, aux_model)
                inferrer.run(self.user_id, list(self.history), model_force)
                # Log what was saved
                updated = store.get_model(self.user_id)
                print(f"[trigger_inference] done — signal_vocab={[t.get('term') for t in (updated.signal_vocab if updated else [])]}")
            except Exception as e:
                print(f"[trigger_inference] ERROR: {e}")

        t = threading.Thread(target=_infer, daemon=True, name="user_model_infer")
        t.start()
        t.join(timeout=60)  # Block until inference completes (max 60s)

    def reset_inferred(self) -> None:
        import sqlite3, json, time
        from pathlib import Path
        db_path = Path(self._hermes_home) / "state.db"
        conn = sqlite3.connect(str(db_path), timeout=5.0, isolation_level=None)
        conn.execute("PRAGMA journal_mode=WAL")
        now = time.time()
        conn.execute(
            "UPDATE user_models SET inferred_json='[]', signal_vocab='[]', updated_at=? WHERE user_id=?",
            (now, self.user_id)
        )
        conn.close()


def get_session(session_id: str) -> Optional[HermesSession]:
    return _sessions.get(session_id)


def create_session(user_id: str, registration_data: dict) -> HermesSession:
    session = HermesSession(user_id, registration_data)
    _sessions[session.session_id] = session
    return session
