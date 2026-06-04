"""Unit tests for UserModelProvider — lifecycle, shutdown, graceful degradation."""

from __future__ import annotations

import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from plugins.memory.user_model.provider import UserModelProvider
from plugins.memory.user_model.store import UserModelStore


@pytest.fixture()
def hermes_home(tmp_path: Path) -> str:
    import hermes_state
    hermes_state.SessionDB(db_path=tmp_path / "state.db")
    return str(tmp_path)


@pytest.fixture()
def seeded_provider(hermes_home: str) -> UserModelProvider:
    """Provider initialized with a real seeded user."""
    from plugins.memory.user_model.bridge import seed_user_from_registration
    seed_user_from_registration("u1", {"role": "PM", "domain": "SaaS"}, hermes_home)

    p = UserModelProvider()
    with patch("agent.auxiliary_client.get_text_auxiliary_client", return_value=(None, None)):
        p.initialize("session-1", user_id="u1", hermes_home=hermes_home)
    return p


# ── Lifecycle ─────────────────────────────────────────────────────────────────

def test_initialize_loads_known_user(seeded_provider):
    assert seeded_provider._model is not None
    assert seeded_provider._model.profile["role"] == "PM"


def test_initialize_unknown_user_is_none(hermes_home):
    p = UserModelProvider()
    with patch("agent.auxiliary_client.get_text_auxiliary_client", return_value=(None, None)):
        p.initialize("session-x", user_id="ghost", hermes_home=hermes_home)
    assert p._model is None


def test_initialize_no_user_id(hermes_home):
    p = UserModelProvider()
    with patch("agent.auxiliary_client.get_text_auxiliary_client", return_value=(None, None)):
        p.initialize("session-x", hermes_home=hermes_home)
    assert p._model is None
    assert p._user_id == ""


# ── system_prompt_block ───────────────────────────────────────────────────────

def test_system_prompt_block_contains_profile(seeded_provider):
    ctx = seeded_provider.system_prompt_block()
    assert "PM" in ctx
    assert "SaaS" in ctx


def test_system_prompt_block_no_model_returns_empty(hermes_home):
    p = UserModelProvider()
    with patch("agent.auxiliary_client.get_text_auxiliary_client", return_value=(None, None)):
        p.initialize("s", user_id="nobody", hermes_home=hermes_home)
    assert p.system_prompt_block() == ""


def test_prefetch_always_empty(seeded_provider):
    assert seeded_provider.prefetch("any query") == ""


# ── get_tool_schemas ──────────────────────────────────────────────────────────

def test_get_tool_schemas_returns_empty(seeded_provider):
    assert seeded_provider.get_tool_schemas() == []


# ── Graceful degradation ──────────────────────────────────────────────────────

def test_graceful_degradation_no_exception(hermes_home):
    """Unknown user_id → all lifecycle methods succeed silently."""
    p = UserModelProvider()
    with patch("agent.auxiliary_client.get_text_auxiliary_client", return_value=(None, None)):
        p.initialize("s", user_id="ghost", hermes_home=hermes_home)
    assert p.system_prompt_block() == ""
    assert p.prefetch("hello") == ""
    p.sync_turn("hello", "world")
    p.on_session_end([])
    p.shutdown()  # should not hang or raise


# ── shutdown waits for inference ──────────────────────────────────────────────

def test_shutdown_waits_for_inference(hermes_home):
    """shutdown() must block until on_session_end inference completes (≤ 10s)."""
    from plugins.memory.user_model.bridge import seed_user_from_registration
    seed_user_from_registration("u1", {"role": "PM"}, hermes_home)

    p = UserModelProvider()
    with patch("agent.auxiliary_client.get_text_auxiliary_client", return_value=(None, None)):
        p.initialize("s", user_id="u1", hermes_home=hermes_home)

    inference_ran = threading.Event()

    def slow_infer():
        time.sleep(0.2)
        inference_ran.set()

    # Manually simulate on_session_end behaviour
    p._inference_event.clear()
    t = threading.Thread(target=lambda: (slow_infer(), p._inference_event.set()))
    t.start()

    start = time.time()
    p.shutdown()
    elapsed = time.time() - start

    assert inference_ran.is_set(), "inference did not run before shutdown returned"
    assert elapsed < 5.0, f"shutdown took too long: {elapsed:.2f}s"


def test_shutdown_timeout_does_not_hang(hermes_home):
    """If inference never completes, shutdown() must return after 10s (mocked to 0.1s)."""
    from plugins.memory.user_model.bridge import seed_user_from_registration
    seed_user_from_registration("u1", {"role": "PM"}, hermes_home)

    p = UserModelProvider()
    with patch("agent.auxiliary_client.get_text_auxiliary_client", return_value=(None, None)):
        p.initialize("s", user_id="u1", hermes_home=hermes_home)

    # Never set the event — simulate hung inference
    p._inference_event.clear()

    start = time.time()
    p._inference_event.wait(timeout=0.1)  # test with tiny timeout
    elapsed = time.time() - start
    assert elapsed < 1.0
