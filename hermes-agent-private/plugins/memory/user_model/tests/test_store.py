"""Unit tests for UserModelStore — CRUD, decay, reinforcement, cap eviction, isolation."""

from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from plugins.memory.user_model.store import (
    DECAY_FACTOR,
    MAX_DIMENSIONS,
    MAX_KEYWORDS_PER_DIM,
    MAX_SIGNAL_TERMS,
    PRUNE_THRESHOLD,
    REINFORCE_WEIGHT,
    UserModelStore,
)


@pytest.fixture()
def store(tmp_path: Path) -> UserModelStore:
    """Fresh store backed by a real (in-memory-path) SQLite DB."""
    import hermes_state
    hermes_state.SessionDB(db_path=tmp_path / "state.db")
    return UserModelStore(hermes_home=str(tmp_path))


# ── Registration ──────────────────────────────────────────────────────────────

def test_seed_creates_model(store):
    store.seed_from_registration("u1", {"role": "PM", "domain": "SaaS"})
    m = store.get_model("u1")
    assert m is not None
    assert m.profile["role"] == "PM"
    assert m.inferred == []


def test_seed_idempotent(store):
    store.seed_from_registration("u1", {"role": "PM"})
    store.seed_from_registration("u1", {"role": "Engineer"})
    m = store.get_model("u1")
    assert m.profile["role"] == "Engineer"  # updated
    assert m.inferred == []  # inferred untouched


def test_seed_preserves_inferred(store):
    store.seed_from_registration("u1", {"role": "PM"})
    store.update_inferred("u1", [{"field": "communication_style", "keywords": [{"value": "direct", "evidence_strength": 0.9}], "summary": "Direct"}])
    store.seed_from_registration("u1", {"role": "Engineer"})
    m = store.get_model("u1")
    assert len(m.inferred) == 1  # inferred survived re-seed


def test_get_model_unknown_returns_none(store):
    assert store.get_model("nonexistent") is None


# ── Inferred trait update ─────────────────────────────────────────────────────

def test_update_inferred_adds_dimension(store):
    store.seed_from_registration("u1", {})
    store.update_inferred("u1", [
        {"field": "communication_style", "keywords": [{"value": "direct", "evidence_strength": 0.8}], "summary": "Direct"}
    ])
    m = store.get_model("u1")
    assert len(m.inferred) == 1
    assert m.inferred[0].field == "communication_style"
    assert m.inferred[0].summary == "Direct"
    assert len(m.inferred[0].keywords) == 1
    assert m.inferred[0].keywords[0].value == "direct"


def test_keyword_decay(store):
    store.seed_from_registration("u1", {})
    # Seed with a known confidence value via direct update
    store.update_inferred("u1", [
        {"field": "tech", "keywords": [{"value": "python", "evidence_strength": 1.0}], "summary": ""}
    ])
    m = store.get_model("u1")
    initial_conf = m.inferred[0].keywords[0].confidence

    # Second update with no new evidence for this keyword → decay only
    store.update_inferred("u1", [
        {"field": "tech", "keywords": [], "summary": ""}
    ])
    m2 = store.get_model("u1")
    decayed_conf = m2.inferred[0].keywords[0].confidence
    assert abs(decayed_conf - initial_conf * DECAY_FACTOR) < 0.001


def test_keyword_reinforcement(store):
    store.seed_from_registration("u1", {})
    store.update_inferred("u1", [
        {"field": "tech", "keywords": [{"value": "python", "evidence_strength": 1.0}], "summary": ""}
    ])
    m = store.get_model("u1")
    conf_before = m.inferred[0].keywords[0].confidence

    # Reinforce same keyword
    store.update_inferred("u1", [
        {"field": "tech", "keywords": [{"value": "python", "evidence_strength": 1.0}], "summary": ""}
    ])
    m2 = store.get_model("u1")
    conf_after = m2.inferred[0].keywords[0].confidence
    # After decay × 0.95 then + 1.0 × 0.5, should be higher than just decayed
    decayed = conf_before * DECAY_FACTOR
    expected = min(1.0, decayed + 1.0 * REINFORCE_WEIGHT)
    assert abs(conf_after - expected) < 0.001


def test_keyword_pruning_below_threshold(store):
    store.seed_from_registration("u1", {})
    store.update_inferred("u1", [
        {"field": "tech", "keywords": [{"value": "python", "evidence_strength": 0.5}], "summary": ""}
    ])
    # Run enough sessions to decay below PRUNE_THRESHOLD
    sessions_to_prune = 0
    conf = 0.5 * REINFORCE_WEIGHT  # initial confidence
    while conf >= PRUNE_THRESHOLD:
        conf *= DECAY_FACTOR
        sessions_to_prune += 1
        if sessions_to_prune > 100:
            break

    for _ in range(sessions_to_prune + 1):
        store.update_inferred("u1", [{"field": "tech", "keywords": [], "summary": ""}])

    m = store.get_model("u1")
    tech_dims = [d for d in m.inferred if d.field == "tech"]
    assert tech_dims == [] or tech_dims[0].keywords == []


def test_cap_keywords_per_dimension(store):
    store.seed_from_registration("u1", {})
    keywords = [{"value": f"kw{i}", "evidence_strength": 0.9} for i in range(MAX_KEYWORDS_PER_DIM + 2)]
    store.update_inferred("u1", [{"field": "tech", "keywords": keywords, "summary": ""}])
    m = store.get_model("u1")
    assert len(m.inferred[0].keywords) <= MAX_KEYWORDS_PER_DIM


def test_cap_dimensions(store):
    store.seed_from_registration("u1", {})
    dims = [
        {"field": f"dim_{i}", "keywords": [{"value": "x", "evidence_strength": 0.8}], "summary": f"S{i}"}
        for i in range(MAX_DIMENSIONS + 2)
    ]
    store.update_inferred("u1", dims)
    m = store.get_model("u1")
    assert len(m.inferred) <= MAX_DIMENSIONS


def test_summary_updated_only_when_provided(store):
    store.seed_from_registration("u1", {})
    store.update_inferred("u1", [
        {"field": "style", "keywords": [{"value": "concise", "evidence_strength": 0.8}], "summary": "Original summary"}
    ])
    # Update without providing a new summary
    store.update_inferred("u1", [
        {"field": "style", "keywords": [{"value": "concise", "evidence_strength": 0.8}], "summary": ""}
    ])
    m = store.get_model("u1")
    assert m.inferred[0].summary == "Original summary"


# ── Multi-user isolation ───────────────────────────────────────────────────────

def test_multi_user_isolation(store):
    store.seed_from_registration("userA", {"role": "PM"})
    store.seed_from_registration("userB", {"role": "Engineer"})
    store.update_inferred("userA", [
        {"field": "style", "keywords": [{"value": "direct", "evidence_strength": 0.9}], "summary": "Direct"}
    ])
    mb = store.get_model("userB")
    assert not any(d.field == "style" for d in mb.inferred)


# ── Signal vocabulary ─────────────────────────────────────────────────────────

def test_signal_vocab_added(store):
    store.seed_from_registration("u1", {})
    store.update_signal_vocab("u1", [
        {"term": "as a PM", "trigger_for": "role", "confidence": 0.8}
    ])
    m = store.get_model("u1")
    assert any(t["term"] == "as a PM" for t in m.signal_vocab)


def test_signal_vocab_cap(store):
    store.seed_from_registration("u1", {})
    terms = [{"term": f"term_{i}", "trigger_for": "role", "confidence": 0.8} for i in range(MAX_SIGNAL_TERMS + 3)]
    store.update_signal_vocab("u1", terms)
    m = store.get_model("u1")
    assert len(m.signal_vocab) <= MAX_SIGNAL_TERMS


# ── get_compressed_context ────────────────────────────────────────────────────

def test_compressed_context_includes_profile(store):
    store.seed_from_registration("u1", {"role": "PM", "domain": "SaaS", "years_experience": 3})
    ctx = store.get_compressed_context("u1")
    assert "PM" in ctx
    assert "SaaS" in ctx


def test_compressed_context_includes_inferred_summary(store):
    store.seed_from_registration("u1", {"role": "PM"})
    store.update_inferred("u1", [
        {"field": "communication_style", "keywords": [{"value": "direct", "evidence_strength": 0.9}], "summary": "Prefers terse responses"}
    ])
    ctx = store.get_compressed_context("u1")
    assert "Prefers terse responses" in ctx


def test_compressed_context_empty_for_unknown_user(store):
    assert store.get_compressed_context("nobody") == ""
