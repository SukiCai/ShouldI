"""FastAPI entrypoint for the Hermes mock test app."""

from __future__ import annotations

import os
import sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Make the hermes-agent repo root importable before we touch any Hermes modules.
_HERMES_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _HERMES_ROOT not in sys.path:
    sys.path.insert(0, _HERMES_ROOT)

# Load ~/.hermes/.env so API keys (e.g. OPENROUTER_API_KEY) are available.
from hermes_constants import get_hermes_home  # noqa: E402
from hermes_cli.env_loader import load_hermes_dotenv  # noqa: E402
load_hermes_dotenv(hermes_home=get_hermes_home())

from agent_bridge import create_session, get_session  # noqa: E402
import mock_users  # noqa: E402
from models import (  # noqa: E402
    ClarifyReplyRequest,
    CreateSessionRequest,
    CreateSessionResponse,
    MockUser,
    SendMessageRequest,
    UpdateUserRequest,
    UserModelSchema,
)

app = FastAPI(title="Hermes Mock App", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _on_startup() -> None:
    mock_users.init_db()


@app.get("/api/users", response_model=list[MockUser])
def list_users() -> list[dict]:
    return mock_users.get_all_users()


@app.post("/api/sessions", response_model=CreateSessionResponse)
def create_new_session(req: CreateSessionRequest) -> dict:
    user = mock_users.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    registration_data = {
        "role": user["role"],
        "domain": user["domain"],
        "years_experience": user["years_experience"],
        "industry": user["industry"],
    }
    session = create_session(req.user_id, registration_data)
    return {"session_id": session.session_id, "user": user}


@app.post("/api/sessions/{session_id}/messages")
async def send_message(session_id: str, req: SendMessageRequest):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return StreamingResponse(
        session.send_message(req.content, smart_talk_mode=req.smart_talk_mode),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/sessions/{session_id}/profile", response_model=UserModelSchema | None)
def get_profile(session_id: str):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.get_profile()


@app.put("/api/users/{user_id}", response_model=MockUser)
def update_user_endpoint(user_id: str, req: UpdateUserRequest) -> dict:
    existing = mock_users.get_user(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    fields = req.model_dump(exclude_none=True)
    updated = mock_users.update_user(user_id, fields)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")

    registration_data = {
        "role": updated["role"],
        "domain": updated["domain"],
        "years_experience": updated["years_experience"],
        "industry": updated["industry"],
    }

    # Re-seed any active sessions for this user with the new registration data.
    from agent_bridge import _sessions as _active_sessions

    for session in _active_sessions.values():
        if session.user_id == user_id:
            try:
                session.update_registration(registration_data)
            except Exception:
                pass

    return updated


@app.get("/api/sessions/{session_id}/system-prompt")
def get_system_prompt(session_id: str) -> dict:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"context": session.get_system_prompt_context()}


@app.get("/api/sessions/{session_id}/gate-log")
def get_gate_log(session_id: str) -> list:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.get_gate_log()


@app.post("/api/sessions/{session_id}/infer")
def trigger_infer_endpoint(session_id: str) -> dict:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.trigger_inference()
    return {"status": "ok"}


@app.delete("/api/sessions/{session_id}/inferred")
def reset_inferred_endpoint(session_id: str) -> dict:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.reset_inferred()
    return {"status": "ok"}


@app.post("/api/sessions/{session_id}/clarify-reply")
def clarify_reply(session_id: str, req: ClarifyReplyRequest) -> dict:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.respond_to_clarify(req.choice)
    return {"ok": True}
