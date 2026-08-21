"""UserModelStore — SQLite CRUD for per-user profiles and inferred traits."""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

DECAY_FACTOR = 0.95
REINFORCE_WEIGHT = 0.5
PRUNE_THRESHOLD = 0.3
MAX_KEYWORDS_PER_DIM = 5
MAX_DIMENSIONS = 10
MAX_SIGNAL_TERMS = 20


@dataclass
class TraitKeyword:
    value: str
    confidence: float
    updated_at: float


@dataclass
class TraitDimension:
    field: str
    keywords: List[TraitKeyword] = field(default_factory=list)
    summary: str = ""
    summary_updated_at: float = 0.0


@dataclass
class UserModel:
    user_id: str
    profile: dict
    inferred: List[TraitDimension]
    signal_vocab: List[dict]
    updated_at: float


def _avg_confidence(keywords: List[TraitKeyword]) -> float:
    if not keywords:
        return 0.0
    return sum(k.confidence for k in keywords) / len(keywords)


def _dim_from_dict(d: dict) -> TraitDimension:
    keywords = [
        TraitKeyword(
            value=k["value"],
            confidence=float(k["confidence"]),
            updated_at=float(k.get("updated_at", time.time())),
        )
        for k in d.get("keywords", [])
    ]
    return TraitDimension(
        field=d["field"],
        keywords=keywords,
        summary=d.get("summary", ""),
        summary_updated_at=float(d.get("summary_updated_at", 0.0)),
    )


def _dim_to_dict(dim: TraitDimension) -> dict:
    return {
        "field": dim.field,
        "keywords": [
            {"value": k.value, "confidence": k.confidence, "updated_at": k.updated_at}
            for k in dim.keywords
        ],
        "summary": dim.summary,
        "summary_updated_at": dim.summary_updated_at,
    }


class UserModelStore:
    def __init__(self, hermes_home: str):
        self._db_path = Path(hermes_home) / "state.db"

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path), timeout=5.0, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    # ── Registration ──────────────────────────────────────────────────────────

    def seed_from_registration(self, user_id: str, profile: dict) -> None:
        """Idempotent upsert of registration data. Never overwrites inferred traits."""
        now = time.time()
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT profile_json FROM user_models WHERE user_id = ?", (user_id,)
            ).fetchone()
            if existing is None:
                conn.execute(
                    """INSERT INTO user_models
                       (user_id, profile_json, inferred_json, signal_vocab, created_at, updated_at)
                       VALUES (?, ?, '[]', '[]', ?, ?)""",
                    (user_id, json.dumps(profile), now, now),
                )
            else:
                conn.execute(
                    "UPDATE user_models SET profile_json = ?, updated_at = ? WHERE user_id = ?",
                    (json.dumps(profile), now, user_id),
                )

    # ── Read ──────────────────────────────────────────────────────────────────

    def get_model(self, user_id: str) -> Optional[UserModel]:
        """Returns None for unknown users (graceful degradation)."""
        try:
            with self._connect() as conn:
                return self._get_model_with_conn(conn, user_id)
        except Exception:
            logger.exception("UserModelStore.get_model failed for %s", user_id)
            return None

    def _get_model_with_conn(self, conn: sqlite3.Connection, user_id: str) -> Optional[UserModel]:
        """Same as get_model(), but reuses a caller-supplied connection so the
        read can happen inside the caller's own transaction (see
        update_inferred/update_signal_vocab — without this, a fresh
        connection here would read outside the BEGIN IMMEDIATE lock and
        reintroduce the read-then-write race it exists to close)."""
        row = conn.execute(
            "SELECT * FROM user_models WHERE user_id = ?", (user_id,)
        ).fetchone()
        if row is None:
            return None
        inferred = [_dim_from_dict(d) for d in json.loads(row["inferred_json"] or "[]")]
        return UserModel(
            user_id=user_id,
            profile=json.loads(row["profile_json"] or "{}"),
            inferred=inferred,
            signal_vocab=json.loads(row["signal_vocab"] or "[]"),
            updated_at=row["updated_at"],
        )

    # ── Inferred trait update ─────────────────────────────────────────────────

    def update_inferred(self, user_id: str, new_dimensions: list[dict]) -> None:
        """
        Merge Task A output into existing inferred dimensions.

        For each existing keyword: confidence *= DECAY_FACTOR
        For matching new keywords: confidence = min(1.0, decayed + evidence * REINFORCE_WEIGHT)
        New keywords are added with confidence = evidence * REINFORCE_WEIGHT
        Summary updated only when provided in new_dimensions (keyword delta detected by Task A)
        Prune keywords < PRUNE_THRESHOLD; cap MAX_KEYWORDS_PER_DIM; cap MAX_DIMENSIONS
        """
        # Read-merge-write, but the read and write must happen inside the
        # SAME locked transaction — otherwise two concurrent turns for the
        # same user (each now its own OS process, one per /v1/turn call)
        # can both read the pre-update state and each write back a merge
        # that doesn't know about the other's contribution, silently
        # dropping one of the two (see docs/engineering/
        # user-account-isolation-test-plan.md, item F4). BEGIN IMMEDIATE
        # takes SQLite's write lock up front — even in WAL mode, only one
        # writer at a time — so a concurrent call simply waits (up to the
        # connection's 5s timeout) instead of racing.
        conn = self._connect()
        try:
            conn.execute("BEGIN IMMEDIATE")
            model = self._get_model_with_conn(conn, user_id)
            if model is None:
                conn.execute("ROLLBACK")
                return
            self._merge_and_write_inferred(conn, user_id, model, new_dimensions)
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise
        finally:
            conn.close()

    def _merge_and_write_inferred(
        self, conn: sqlite3.Connection, user_id: str, model: "UserModel", new_dimensions: list[dict]
    ) -> None:
        now = time.time()
        existing: dict[str, TraitDimension] = {d.field: d for d in model.inferred}

        for nd in new_dimensions:
            field_name = nd.get("field", "")
            if not field_name:
                continue

            dim = existing.get(field_name) or TraitDimension(field=field_name)

            # Decay all existing keywords first
            for kw in dim.keywords:
                kw.confidence *= DECAY_FACTOR

            # Build lookup of decayed keywords
            kw_map: dict[str, TraitKeyword] = {k.value.lower(): k for k in dim.keywords}

            # Reinforce or add new keywords from Task A
            for new_kw in nd.get("keywords", []):
                val = new_kw.get("value", "").strip()
                evidence = float(new_kw.get("evidence_strength", 0.5))
                if not val:
                    continue
                key = val.lower()
                if key in kw_map:
                    kw_map[key].confidence = min(1.0, kw_map[key].confidence + evidence * REINFORCE_WEIGHT)
                    kw_map[key].updated_at = now
                else:
                    kw_map[key] = TraitKeyword(
                        value=val,
                        confidence=min(1.0, evidence * REINFORCE_WEIGHT),
                        updated_at=now,
                    )

            # Prune below threshold
            kept = [k for k in kw_map.values() if k.confidence >= PRUNE_THRESHOLD]

            # Cap at MAX_KEYWORDS_PER_DIM (evict lowest confidence)
            kept.sort(key=lambda k: k.confidence, reverse=True)
            dim.keywords = kept[:MAX_KEYWORDS_PER_DIM]

            # Update summary only when Task A provides one (keyword change detected)
            if nd.get("summary"):
                dim.summary = nd["summary"]
                dim.summary_updated_at = now

            existing[field_name] = dim

        # Prune dimensions with no keywords left
        alive = [d for d in existing.values() if d.keywords]

        # Cap at MAX_DIMENSIONS (evict lowest avg confidence)
        alive.sort(key=lambda d: _avg_confidence(d.keywords), reverse=True)
        final = alive[:MAX_DIMENSIONS]

        conn.execute(
            "UPDATE user_models SET inferred_json = ?, updated_at = ? WHERE user_id = ?",
            (json.dumps([_dim_to_dict(d) for d in final]), now, user_id),
        )

    # ── Signal vocabulary update ───────────────────────────────────────────────

    def update_signal_vocab(self, user_id: str, new_terms: list[dict]) -> None:
        """
        Merge Task B output into signal_vocab.
        Decay existing terms × DECAY_FACTOR, reinforce matches, prune < PRUNE_THRESHOLD,
        cap at MAX_SIGNAL_TERMS.

        Same BEGIN IMMEDIATE locking as update_inferred — see that method's
        comment for why the read and write must share one transaction.
        """
        conn = self._connect()
        try:
            conn.execute("BEGIN IMMEDIATE")
            model = self._get_model_with_conn(conn, user_id)
            if model is None:
                conn.execute("ROLLBACK")
                return
            self._merge_and_write_signal_vocab(conn, user_id, model, new_terms)
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise
        finally:
            conn.close()

    def _merge_and_write_signal_vocab(
        self, conn: sqlite3.Connection, user_id: str, model: "UserModel", new_terms: list[dict]
    ) -> None:
        now = time.time()
        vocab: dict[str, dict] = {t["term"].lower(): t for t in model.signal_vocab}

        # Decay all existing
        for t in vocab.values():
            t["confidence"] = t["confidence"] * DECAY_FACTOR

        for nt in new_terms:
            term = nt.get("term", "").strip()
            if not term:
                continue
            key = term.lower()
            evidence = float(nt.get("confidence", 0.5))
            if key in vocab:
                vocab[key]["confidence"] = min(1.0, vocab[key]["confidence"] + evidence * REINFORCE_WEIGHT)
                vocab[key]["updated_at"] = now
            else:
                vocab[key] = {
                    "term": term,
                    "trigger_for": nt.get("trigger_for", ""),
                    "confidence": min(1.0, evidence * REINFORCE_WEIGHT),
                    "updated_at": now,
                }

        # Prune + cap
        kept = [t for t in vocab.values() if t["confidence"] >= PRUNE_THRESHOLD]
        kept.sort(key=lambda t: t["confidence"], reverse=True)
        final = kept[:MAX_SIGNAL_TERMS]

        conn.execute(
            "UPDATE user_models SET signal_vocab = ?, updated_at = ? WHERE user_id = ?",
            (json.dumps(final), now, user_id),
        )

    # ── System prompt context ─────────────────────────────────────────────────

    def remove_inferred_dimension(self, user_id: str, field: str) -> bool:
        """Remove an inferred dimension by field name. Returns True if found and removed."""
        model = self.get_model(user_id)
        if not model:
            return False
        before = len(model.inferred)
        remaining = [d for d in model.inferred if d.field != field]
        if len(remaining) == before:
            return False
        now = time.time()
        with self._connect() as conn:
            conn.execute(
                "UPDATE user_models SET inferred_json = ?, updated_at = ? WHERE user_id = ?",
                (json.dumps([_dim_to_dict(d) for d in remaining]), now, user_id),
            )
        return True

    def get_compressed_context(self, user_id: str, max_chars: int = 600) -> str:
        """
        Returns compact string for system_prompt_block().
        Registration profile + all inferred dimension summaries, sorted by
        avg keyword confidence (highest first).
        """
        model = self.get_model(user_id)
        if not model:
            return ""

        parts = []

        # Registration data
        p = model.profile
        role_line = p.get("role", "")
        if p.get("domain"):
            role_line += f" at {p['domain']}"
        if p.get("years_experience"):
            role_line += f", {p['years_experience']} years"
        if p.get("industry"):
            role_line += f" ({p['industry']})"
        if role_line:
            parts.append(f"User: {role_line}.")

        # Inferred dimensions — only those with a summary, sorted by avg confidence.
        # Include dims above MIN_CONFIDENCE; if none qualify, fall back to top 2.
        MIN_CONFIDENCE = 0.4
        dims_with_summary = [d for d in model.inferred if d.summary]
        dims_sorted = sorted(dims_with_summary, key=lambda d: _avg_confidence(d.keywords), reverse=True)
        qualified = [d for d in dims_sorted if _avg_confidence(d.keywords) >= MIN_CONFIDENCE]
        selected = qualified if qualified else dims_sorted[:2]
        for dim in selected:
            label = dim.field.replace("_", " ").title()
            parts.append(f"{label}: {dim.summary}")

        result = "\n".join(parts)
        if len(result) > max_chars:
            result = result[:max_chars].rsplit("\n", 1)[0]
        return result
