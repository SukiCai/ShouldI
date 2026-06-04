"""
Smart Talk State Tool — session-scoped interview state persistence.

Stores cumulative_analysis dicts as JSON files under
  get_hermes_home() / "state" / "smart_talk" / {session_id}.json

State is ephemeral: files older than 24 h are lazily cleaned up on `get`.
"""

import json
import time
from pathlib import Path
from typing import Any, Optional

from hermes_constants import get_hermes_home
from tools.registry import registry, tool_error, tool_result


_STATE_TTL_SECONDS = 86_400  # 24 h


def _state_dir() -> Path:
    d = get_hermes_home() / "state" / "smart_talk"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _state_path(session_id: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_id)
    return _state_dir() / f"{safe}.json"


def _lazy_expire(directory: Path) -> None:
    """Delete state files older than TTL (best-effort, never raises)."""
    try:
        cutoff = time.time() - _STATE_TTL_SECONDS
        for f in directory.glob("*.json"):
            try:
                if f.stat().st_mtime < cutoff:
                    f.unlink(missing_ok=True)
            except OSError:
                pass
    except Exception:
        pass


_REQUIRED_ANALYSIS_KEYS = {"intent", "reality", "signal", "stakes"}
_REQUIRED_DIM_KEYS = {"score", "established_facts", "gaps"}


def _validate_state(state: Any) -> Optional[str]:
    """Return an error string if state fails schema validation, else None."""
    if not isinstance(state, dict):
        return "state must be a JSON object"
    for dim in _REQUIRED_ANALYSIS_KEYS:
        if dim not in state:
            return f"state.{dim} is required"
        d = state[dim]
        if not isinstance(d, dict):
            return f"state.{dim} must be an object"
        for k in _REQUIRED_DIM_KEYS:
            if k not in d:
                return f"state.{dim}.{k} is required"
        if not isinstance(d["score"], (int, float)) or not (0.0 <= d["score"] <= 1.0):
            return f"state.{dim}.score must be a float in [0.0, 1.0]"
        if not isinstance(d["established_facts"], list):
            return f"state.{dim}.established_facts must be an array"
        if not isinstance(d["gaps"], list):
            return f"state.{dim}.gaps must be an array"
    if "rounds_completed" in state and not isinstance(state["rounds_completed"], int):
        return "state.rounds_completed must be an integer"
    return None


_EMPTY_STATE = {
    "intent":  {"score": 0.0, "established_facts": [], "gaps": ["not yet explored"]},
    "reality": {"score": 0.0, "established_facts": [], "gaps": ["not yet explored"]},
    "signal":  {"score": 0.0, "established_facts": [], "gaps": ["not yet explored"]},
    "stakes":  {"score": 0.0, "established_facts": [], "gaps": ["not yet explored"]},
    "rounds_completed": 0,
    "challenge_modes_used": [],
    "ontology": [],
}


def smart_talk_state_tool(action: str, session_id: str, state: Optional[dict] = None) -> str:
    """
    Manage smart_talk interview state for a session.

    Actions:
      get   — load state for session_id (returns empty scaffold if none exists)
      set   — persist cumulative_analysis dict (validates schema first)
      clear — delete state file for session_id
    """
    if not session_id or not session_id.strip():
        return tool_error("session_id is required")

    action = (action or "").strip().lower()
    sid = session_id.strip()

    if action == "get":
        _lazy_expire(_state_dir())
        path = _state_path(sid)
        if not path.exists():
            return tool_result({"session_id": sid, "found": False, "state": _EMPTY_STATE})
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return tool_result({"session_id": sid, "found": True, "state": data})
        except (OSError, json.JSONDecodeError) as e:
            return tool_error(f"Failed to read state: {e}")

    elif action == "set":
        if state is None:
            return tool_error("state is required for action=set")
        err = _validate_state(state)
        if err:
            return tool_error(f"Schema validation failed: {err}")
        try:
            _state_path(sid).write_text(
                json.dumps(state, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return tool_result({"session_id": sid, "saved": True})
        except OSError as e:
            return tool_error(f"Failed to write state: {e}")

    elif action == "clear":
        path = _state_path(sid)
        try:
            path.unlink(missing_ok=True)
            return tool_result({"session_id": sid, "cleared": True})
        except OSError as e:
            return tool_error(f"Failed to clear state: {e}")

    else:
        return tool_error(f"Unknown action '{action}'. Use: get, set, clear")


def check_smart_talk_state_requirements() -> bool:
    return True


# ─────────────────────────── Schema ───────────────────────────────────────

SMART_TALK_STATE_SCHEMA = {
    "name": "smart_talk_state",
    "description": (
        "Read, write, or clear smart_talk interview state for a session.\n\n"
        "Actions:\n"
        "- get: load cumulative_analysis for session_id (returns empty scaffold on first call)\n"
        "- set: persist updated cumulative_analysis after scoring each round\n"
        "- clear: delete state when interview is complete\n\n"
        "The state object must have intent/reality/signal/stakes keys, each with "
        "score (0.0-0.90), established_facts (list), and gaps (list)."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["get", "set", "clear"],
                "description": "Operation to perform.",
            },
            "session_id": {
                "type": "string",
                "description": "Unique identifier for this interview session.",
            },
            "state": {
                "type": "object",
                "description": (
                    "cumulative_analysis object (required for action=set). "
                    "Must include goal, constraints, criteria with score/established_facts/gaps."
                ),
            },
        },
        "required": ["action", "session_id"],
    },
}


# ─────────────────────────── Registration ─────────────────────────────────

registry.register(
    name="smart_talk_state",
    toolset="smart_talk",
    schema=SMART_TALK_STATE_SCHEMA,
    handler=lambda args, **kw: smart_talk_state_tool(
        action=args.get("action", ""),
        session_id=args.get("session_id", ""),
        state=args.get("state"),
    ),
    check_fn=check_smart_talk_state_requirements,
    emoji="🗣️",
)
