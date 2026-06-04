"""Unit tests for TurnGate — three-gate sync_turn filter."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from plugins.memory.user_model.gate import TurnGate


VOCAB = [
    {"term": "as a PM", "trigger_for": "role", "confidence": 0.8},
    {"term": "in my experience", "trigger_for": "experience_level", "confidence": 0.7},
]


def _gate_with_llm(answer: str) -> TurnGate:
    """Return a TurnGate whose Gate 3 LLM always returns the given answer."""
    client = MagicMock()
    client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=answer))]
    )
    return TurnGate(client=client, model="haiku")


# ── Gate 1 ────────────────────────────────────────────────────────────────────

def test_gate1_short_message_rejected():
    gate = _gate_with_llm("YES")
    assert gate.check("ok", VOCAB) is False
    gate._client.chat.completions.create.assert_not_called()


def test_gate1_empty_message_rejected():
    gate = _gate_with_llm("YES")
    assert gate.check("", VOCAB) is False


def test_gate1_exact_boundary_rejected():
    gate = _gate_with_llm("YES")
    msg = "x" * (TurnGate.MIN_LEN - 1)
    assert gate.check(msg, VOCAB) is False


# ── Gate 2 ────────────────────────────────────────────────────────────────────

def test_gate2_no_vocab_match_rejected():
    gate = _gate_with_llm("YES")
    msg = "This is a long enough message but contains no trigger terms at all here."
    assert gate.check(msg, VOCAB) is False
    gate._client.chat.completions.create.assert_not_called()


def test_gate2_empty_vocab_rejected():
    gate = _gate_with_llm("YES")
    msg = "as a PM I think we should redesign the onboarding flow for better retention"
    assert gate.check(msg, []) is False
    gate._client.chat.completions.create.assert_not_called()


def test_gate2_case_insensitive_match():
    gate = _gate_with_llm("YES")
    msg = "AS A PM I think we need better tooling for our team's workflow management"
    # Gate 2 passes (case-insensitive), Gate 3 returns YES
    assert gate.check(msg, VOCAB) is True


# ── Gate 3 ────────────────────────────────────────────────────────────────────

def test_gate3_llm_yes_passes():
    gate = _gate_with_llm("YES")
    msg = "as a PM I think we need better tooling for our team's workflow management"
    assert gate.check(msg, VOCAB) is True


def test_gate3_llm_no_rejects():
    gate = _gate_with_llm("NO")
    msg = "in my experience this particular coffee shop has great ambient noise levels"
    assert gate.check(msg, VOCAB) is False


def test_gate3_llm_failure_defaults_true():
    """Gate 3 LLM failure should default to True (don't lose signals)."""
    client = MagicMock()
    client.chat.completions.create.side_effect = Exception("network error")
    gate = TurnGate(client=client, model="haiku")
    msg = "as a PM I think we should redesign the entire product roadmap immediately"
    assert gate.check(msg, VOCAB) is True


def test_gate3_no_client_defaults_true():
    gate = TurnGate(client=None, model=None)
    msg = "as a PM I have strong opinions about our product strategy going forward"
    assert gate.check(msg, VOCAB) is True


# ── Full pass ─────────────────────────────────────────────────────────────────

def test_all_gates_pass():
    gate = _gate_with_llm("YES")
    msg = "in my experience as a product manager, prioritization frameworks rarely survive first contact with stakeholders"
    assert gate.check(msg, VOCAB) is True
    gate._client.chat.completions.create.assert_called_once()
