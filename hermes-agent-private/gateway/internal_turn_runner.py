"""
Standalone per-turn Hermes agent runner for ShouldI's internal RPC/exec
service (Phase 6, docs/engineering/user-account-isolation-plan.md).

Invoked as its own OS subprocess (never imported) because HERMES_HOME is a
process-global env var, not contextvar-safe — a single long-lived process
cannot safely serve two different users' homes back to back. internal_rpc.py
spawns one of these per conversation turn with HERMES_HOME already set in
its environment, feeds it a JSON request on stdin, and reads a JSON response
from stdout.

Mirrors gateway/platforms/api_server.py's `_create_agent()` /
`_handle_chat_completions` (system-message extraction, session continuity
via session_id + SessionDB) but skips the HTTP/SSE-specific machinery —
`AIAgent.chat()` is the same primitive the CLI's `-q` single-query mode
uses, and unlike the `hermes` CLI it has no way to inject a system prompt,
so this runner talks to AIAgent directly instead of shelling out to `hermes`.

stdin JSON:  {"systemPrompt": str|null, "userMessage": str,
              "sessionId": str|null, "userId": str|null}
stdout JSON: {"ok": true, "content": str} | {"ok": false, "error": str}
"""
import contextlib
import io
import json
import sys


def main() -> None:
    raw = sys.stdin.read()
    try:
        req = json.loads(raw)
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"invalid_json: {e}"}))
        sys.exit(1)

    system_prompt = req.get("systemPrompt")
    user_message = req.get("userMessage") or ""
    session_id = req.get("sessionId")
    user_id = req.get("userId")

    if not user_message.strip():
        print(json.dumps({"ok": False, "error": "empty_user_message"}))
        sys.exit(1)

    try:
        from run_agent import AIAgent
        from gateway.run import (
            _resolve_runtime_agent_kwargs,
            _resolve_gateway_model,
            _load_gateway_config,
            GatewayRunner,
        )
        from hermes_cli.tools_config import _get_platform_tools
        from hermes_state import SessionDB

        runtime_kwargs = _resolve_runtime_agent_kwargs()
        reasoning_config = GatewayRunner._load_reasoning_config()
        model = _resolve_gateway_model()
        user_config = _load_gateway_config()
        enabled_toolsets = sorted(_get_platform_tools(user_config, "api_server"))
        fallback_model = GatewayRunner._load_fallback_model()

        try:
            session_db = SessionDB()
        except Exception:
            session_db = None

        # Session continuity is NOT automatic from passing session_id to
        # AIAgent() — that only scopes where this turn's messages get
        # written. Prior turns have to be explicitly loaded from state.db
        # and threaded into run_conversation()'s conversation_history, the
        # same way api_server.py's `X-Hermes-Session-Id` path does.
        history = []
        if session_id and session_db is not None:
            try:
                history = session_db.get_messages_as_conversation(session_id)
            except Exception:
                history = []

        # AIAgent / run_conversation print progress, retry, and rate-limit
        # warnings directly to stdout (not stderr) — e.g. a provider 402/429
        # triggers multi-line "API call failed (attempt N/3)" chatter. Since
        # internal_rpc.py parses this process's ENTIRE stdout as one JSON
        # value, any such noise ahead of our own print() below breaks that
        # parse. Capture stdout during the actual run and only ever let our
        # final json.dumps(...) reach the real stdout; the captured noise
        # still goes to stderr so it's visible in internal_rpc.py's error
        # logging if something upstream (the LLM call itself) really failed.
        stdout_capture = io.StringIO()
        with contextlib.redirect_stdout(stdout_capture):
            agent = AIAgent(
                model=model,
                **runtime_kwargs,
                max_iterations=90,
                quiet_mode=True,
                verbose_logging=False,
                ephemeral_system_prompt=system_prompt or None,
                enabled_toolsets=enabled_toolsets,
                session_id=session_id,
                platform="internal_rpc",
                session_db=session_db,
                fallback_model=fallback_model,
                reasoning_config=reasoning_config,
                gateway_session_key=user_id,
            )
            result = agent.run_conversation(
                user_message=user_message,
                conversation_history=history,
                task_id=session_id or None,
            )
            # This subprocess is about to exit — that IS the session boundary
            # in this architecture (one ephemeral process per turn), so this
            # is the one moment shutdown_memory_provider() should ever fire
            # here. It triggers on_session_end() (queues user_model inference)
            # then shutdown_all(), which blocks until that inference thread
            # actually finishes — without this, on_session_end() is never
            # called anywhere and inferred_json/signal_vocab stay empty
            # forever, no matter how many turns a user has. UserModelInferrer
            # itself throttles the expensive part (MIN_TURNS=3, 1h cooldown),
            # so it's safe to call this after every single turn.
            try:
                agent.shutdown_memory_provider(messages=result.get("messages", []) if isinstance(result, dict) else [])
            except Exception:
                pass
        captured = stdout_capture.getvalue()
        if captured:
            print(captured, file=sys.stderr)
        content = result.get("final_response", "") if isinstance(result, dict) else ""
    except Exception as e:
        import traceback

        print(
            json.dumps(
                {
                    "ok": False,
                    "error": f"{type(e).__name__}: {e}",
                    "traceback": traceback.format_exc(),
                }
            )
        )
        sys.exit(1)

    print(json.dumps({"ok": True, "content": content}))


if __name__ == "__main__":
    main()
