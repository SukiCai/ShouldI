"""
Internal per-turn subprocess RPC service (Phase 6,
docs/engineering/user-account-isolation-plan.md).

Runs as a background process inside the same container as the main Hermes
gateway (api_server on 8642) — started from docker/hermes/entrypoint.sh.
Listens on a separate, internal-only port. `apps/api` will call this instead
of the shared api_server once Phase 7 lands; until then it's independently
testable via curl. The shared api_server path is kept permanently as a
fallback (per the Phase 6 decision log), so this service is additive, not a
replacement of anything that already exists.

Endpoints:
  GET  /health
  POST /v1/provision  {"userId": str}
       -> creates /opt/data/users/<userId>/ (idempotent)
  POST /v1/turn       {"userId", "messages": [...], "sessionId"?: str}
       -> spawns gateway/internal_turn_runner.py as a subprocess with
          HERMES_HOME scoped to that user's home, returns
          {"content": str, "sessionId": str|null}

HERMES_HOME is a process-global env var (not contextvar-safe), which is
exactly why each turn gets spawned as its own OS subprocess instead of being
handled in-process here — this service just routes and supervises.
"""
import asyncio
import json
import logging
import os
import re
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from aiohttp import web

logger = logging.getLogger(__name__)

INSTALL_DIR = Path("/opt/hermes")
USERS_ROOT = Path(os.environ.get("SHOULDI_USERS_HOME_ROOT", "/opt/data/users"))
ANON_USER_ID = "anonymous-local"
SHARED_SKILLS_DIR = INSTALL_DIR / "shared-skills"
# API keys belong to the ShouldI platform, not to individual end users, so
# every per-user HERMES_HOME shares the same .env — copied once at
# provisioning time from the original shared home.
PLATFORM_ENV_SOURCE = Path(os.environ.get("SHOULDI_PLATFORM_ENV", "/opt/data/.env"))

INTERNAL_API_KEY = os.environ.get("SHOULDI_INTERNAL_RPC_KEY", "").strip()
PORT = int(os.environ.get("SHOULDI_INTERNAL_RPC_PORT", "8643"))
TURN_TIMEOUT_S = int(os.environ.get("SHOULDI_INTERNAL_RPC_TURN_TIMEOUT_S", "180"))

_user_locks: Dict[str, asyncio.Lock] = {}
_user_locks_guard = asyncio.Lock()


def _safe_user_id(user_id: str) -> str:
    """Reject anything that isn't a plain userId — this becomes a filesystem path segment."""
    if not user_id or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", user_id):
        raise ValueError(f"invalid userId: {user_id!r}")
    return user_id


def _home_for(user_id: str) -> Path:
    safe = _safe_user_id(user_id or ANON_USER_ID)
    return USERS_ROOT / safe


def _patch_fresh_config(config_path: Path, shared_dir: str) -> None:
    """Same skills.external_dirs logic as docker/hermes/entrypoint.sh's
    bootstrap patch (kept in sync manually — one is shell, one is Python;
    both exist because entrypoint.sh handles the single legacy shared home
    and this handles every future per-user home), PLUS memory.provider,
    which cli-config.yaml.example doesn't set at all (only the legacy
    shared home's already-hand-edited config.yaml has it). Without this,
    the user_model plugin is simply never activated for a per-user home —
    MemoryManager.providers is empty, so on_session_end()/sync_turn() etc.
    silently no-op with no error, no log, nothing — this is what actually
    caused inferred_json/signal_vocab to stay empty even after wiring up
    shutdown_memory_provider(), not a missing call site."""
    from ruamel.yaml import YAML

    yaml = YAML()
    yaml.preserve_quotes = True
    with open(config_path) as f:
        data = yaml.load(f) or {}
    skills = data.setdefault("skills", {})
    dirs = skills.get("external_dirs") or []
    if shared_dir not in dirs:
        dirs.append(shared_dir)
    skills["external_dirs"] = dirs
    memory = data.setdefault("memory", {})
    memory["provider"] = "user_model"
    with open(config_path, "w") as f:
        yaml.dump(data, f)


def _provision_home(home: Path, user_id: str) -> None:
    for sub in ("cron", "sessions", "logs", "memories", "skills", "workspace", "home"):
        (home / sub).mkdir(parents=True, exist_ok=True)

    config_path = home / "config.yaml"
    if not config_path.exists():
        example = INSTALL_DIR / "cli-config.yaml.example"
        if example.exists():
            shutil.copy(example, config_path)
            _patch_fresh_config(config_path, str(SHARED_SKILLS_DIR))

    soul_path = home / "SOUL.md"
    if not soul_path.exists():
        docker_soul = INSTALL_DIR / "docker" / "SOUL.md"
        if docker_soul.exists():
            shutil.copy(docker_soul, soul_path)

    env_path = home / ".env"
    if not env_path.exists() and PLATFORM_ENV_SOURCE.exists():
        shutil.copy(PLATFORM_ENV_SOURCE, env_path)

    # apps/api's seedHermesUserModel() (Phase 4) seeds a user_models row in
    # the SHARED home's state.db, which the fallback api_server path reads
    # from — but conversations that route through THIS per-user home read
    # from THIS home's own state.db, a completely different file. Without
    # this, get_model() here would always return None and user_model memory
    # personalization would silently never work once Phase 7 traffic lands.
    try:
        from hermes_state import SessionDB
        from plugins.memory.user_model.store import UserModelStore

        # UserModelStore assumes the `user_models` table already exists —
        # it never creates it. Only SessionDB's own schema init does (see
        # hermes_state.py's CREATE TABLE IF NOT EXISTS user_models). On a
        # brand-new per-user state.db, nothing has constructed a SessionDB
        # against it yet, so seed_from_registration() would 500 with
        # "no such table: user_models". Touch SessionDB first to guarantee
        # the schema exists before seeding into it.
        SessionDB(db_path=home / "state.db")
        UserModelStore(hermes_home=str(home)).seed_from_registration(user_id, {})
    except Exception:
        logger.exception("user_model seed failed during provision for %s", user_id)


def _check_auth(request: "web.Request") -> Optional["web.Response"]:
    if not INTERNAL_API_KEY:
        return None  # no key configured — internal-only network, allow all
    auth = request.headers.get("Authorization", "")
    if auth == f"Bearer {INTERNAL_API_KEY}":
        return None
    return web.json_response({"error": "unauthorized"}, status=401)


async def handle_health(request: "web.Request") -> "web.Response":
    return web.json_response({"ok": True, "service": "shouldi-internal-rpc"})


async def handle_provision(request: "web.Request") -> "web.Response":
    auth_err = _check_auth(request)
    if auth_err:
        return auth_err
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid_json"}, status=400)

    user_id = str(body.get("userId") or "").strip() or ANON_USER_ID
    try:
        home = _home_for(user_id)
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)

    await asyncio.to_thread(_provision_home, home, user_id)
    return web.json_response({"ok": True, "home": str(home)})


async def _get_user_lock(user_id: str) -> asyncio.Lock:
    async with _user_locks_guard:
        lock = _user_locks.get(user_id)
        if lock is None:
            lock = asyncio.Lock()
            _user_locks[user_id] = lock
        return lock


def _split_system_and_last_user_message(messages: List[Dict[str, Any]]) -> tuple[Optional[str], str]:
    """Mirrors api_server.py's `_handle_chat_completions`: concatenate all
    system messages, take the LAST message's content as the turn's input.
    Prior turns are not replayed here — continuity comes from Hermes's own
    session_id-scoped state.db, exactly like the X-Hermes-Session-Id path."""
    system_parts = [m.get("content", "") for m in messages if m.get("role") == "system"]
    system_prompt = "\n".join(p for p in system_parts if p) or None
    last = messages[-1] if messages else None
    user_message = (last or {}).get("content", "") if last else ""
    return system_prompt, str(user_message)


async def _run_turn_subprocess(home: Path, payload: Dict[str, Any]) -> Dict[str, Any]:
    env = dict(os.environ)
    env["HERMES_HOME"] = str(home)

    proc = await asyncio.create_subprocess_exec(
        "python3",
        str(INSTALL_DIR / "gateway" / "internal_turn_runner.py"),
        cwd=str(INSTALL_DIR),
        env=env,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(json.dumps(payload).encode("utf-8")),
            timeout=TURN_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise TimeoutError("turn subprocess timed out")

    if proc.returncode != 0:
        logger.error(
            "internal_turn_runner failed rc=%s stderr=%s stdout=%s",
            proc.returncode,
            stderr_bytes.decode(errors="replace")[:2000],
            stdout_bytes.decode(errors="replace")[:2000],
        )

    try:
        return json.loads(stdout_bytes.decode(errors="replace"))
    except Exception as e:
        raise RuntimeError(
            f"unparseable subprocess output: {e}; stderr={stderr_bytes.decode(errors='replace')[:500]}"
        )


async def handle_turn(request: "web.Request") -> "web.Response":
    auth_err = _check_auth(request)
    if auth_err:
        return auth_err
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid_json"}, status=400)

    user_id = str(body.get("userId") or "").strip() or ANON_USER_ID
    messages = body.get("messages")
    if not messages or not isinstance(messages, list):
        return web.json_response({"error": "missing messages"}, status=400)
    session_id = body.get("sessionId")

    try:
        home = _home_for(user_id)
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)

    if not (home / "config.yaml").exists():
        await asyncio.to_thread(_provision_home, home, user_id)

    system_prompt, user_message = _split_system_and_last_user_message(messages)
    if not user_message.strip():
        return web.json_response({"error": "empty_user_message"}, status=400)

    lock = await _get_user_lock(user_id)
    async with lock:
        try:
            result = await _run_turn_subprocess(
                home,
                {
                    "systemPrompt": system_prompt,
                    "userMessage": user_message,
                    "sessionId": session_id,
                    "userId": user_id,
                },
            )
        except TimeoutError:
            return web.json_response({"error": "timeout"}, status=504)
        except Exception as e:
            logger.exception("turn subprocess crashed")
            return web.json_response({"error": f"subprocess_error: {e}"}, status=502)

    if not result.get("ok"):
        return web.json_response({"error": result.get("error", "unknown_error")}, status=502)

    return web.json_response({"content": result.get("content", ""), "sessionId": session_id})


def build_app() -> "web.Application":
    app = web.Application()
    app.router.add_get("/health", handle_health)
    app.router.add_post("/v1/provision", handle_provision)
    app.router.add_post("/v1/turn", handle_turn)
    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    USERS_ROOT.mkdir(parents=True, exist_ok=True)
    web.run_app(build_app(), host="0.0.0.0", port=PORT, print=None)


if __name__ == "__main__":
    main()
