"""
AC5 Verification — Token reduction for profiled vs new users.

Compares avg input_tokens/turn between:
  - New users: sessions where NO user_model record exists for that user_id
  - Profiled users: sessions after the user's 3rd session (model has had time to accumulate)

Usage:
    python plugins/memory/user_model/verify_ac5.py
    python plugins/memory/user_model/verify_ac5.py --days 60
    python plugins/memory/user_model/verify_ac5.py --source cli
"""

from __future__ import annotations

import argparse
import sqlite3
import time
from pathlib import Path


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def run(db_path: Path, days: int = 30, source: str = None) -> None:
    cutoff = time.time() - days * 86400
    conn = _connect(db_path)

    # Check user_models table exists
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    if "user_models" not in tables:
        print("user_models table not found — run Hermes once to trigger schema migration.")
        return

    # ── Profiled users: sessions for user_ids that have a user_model ──────────
    profiled_q = """
        SELECT
            s.user_id,
            s.input_tokens,
            s.output_tokens,
            s.message_count,
            s.started_at,
            ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.started_at) AS session_num
        FROM sessions s
        INNER JOIN user_models u ON s.user_id = u.user_id
        WHERE s.started_at >= ?
          AND s.user_id IS NOT NULL
          AND s.message_count > 0
          {source_filter}
    """
    source_filter = "AND s.source = ?" if source else ""
    params_profiled = [cutoff, source] if source else [cutoff]
    profiled_rows = conn.execute(
        profiled_q.format(source_filter=source_filter), params_profiled
    ).fetchall()

    # ── New users: sessions where NO user_model exists ────────────────────────
    new_q = """
        SELECT
            s.user_id,
            s.input_tokens,
            s.output_tokens,
            s.message_count
        FROM sessions s
        LEFT JOIN user_models u ON s.user_id = u.user_id
        WHERE s.started_at >= ?
          AND u.user_id IS NULL
          AND s.message_count > 0
          {source_filter}
    """
    params_new = [cutoff, source] if source else [cutoff]
    new_rows = conn.execute(
        new_q.format(source_filter=source_filter), params_new
    ).fetchall()

    conn.close()

    # ── Compute metrics ───────────────────────────────────────────────────────

    def tokens_per_turn(rows, min_session_num: int = 1):
        filtered = [r for r in rows if (r["session_num"] if "session_num" in r.keys() else 1) >= min_session_num]
        total_input = sum(r["input_tokens"] or 0 for r in filtered)
        total_turns = sum(r["message_count"] or 0 for r in filtered)
        sessions = len(filtered)
        return total_input, total_turns, sessions

    new_input, new_turns, new_sessions = tokens_per_turn(new_rows)
    # "Mature" profiled: session 3+ (model had 2 prior sessions to accumulate traits)
    profiled_input, profiled_turns, profiled_sessions = tokens_per_turn(profiled_rows, min_session_num=3)

    avg_new = new_input / new_turns if new_turns else 0
    avg_profiled = profiled_input / profiled_turns if profiled_turns else 0
    reduction = (avg_new - avg_profiled) / avg_new * 100 if avg_new else 0

    # ── Output ────────────────────────────────────────────────────────────────
    print()
    print(f"  AC5 Token Reduction Verification  (last {days} days{f', source={source}' if source else ''})")
    print("  " + "─" * 55)
    print()
    print(f"  {'Group':<30}  {'Sessions':>8}  {'Turns':>8}  {'Avg input/turn':>14}")
    print(f"  {'─'*30}  {'─'*8}  {'─'*8}  {'─'*14}")
    print(f"  {'New users (no model)':<30}  {new_sessions:>8}  {new_turns:>8}  {avg_new:>14.0f}")
    print(f"  {'Profiled users (session 3+)':<30}  {profiled_sessions:>8}  {profiled_turns:>8}  {avg_profiled:>14.0f}")
    print()

    if new_sessions == 0 or profiled_sessions == 0:
        print("  ⚠  Insufficient data for comparison.")
        print("     Need sessions from both new and profiled users.")
        print()
        return

    target = 30.0
    status = "✓ PASS" if reduction >= target else "✗ FAIL"
    print(f"  Token reduction:  {reduction:+.1f}%  (target: ≥{target:.0f}%)")
    print(f"  AC5 result:       {status}")
    print()

    if reduction < target:
        print("  Tips to improve:")
        print("    · Ensure registration data is seeded before session 1")
        print("    · Check system_prompt_block output: hermes → /profile")
        print("    · Verify inferred traits are accumulating: check user_models table")
        print()

    # ── Per-user breakdown (profiled) ─────────────────────────────────────────
    if profiled_rows:
        by_user: dict = {}
        for r in profiled_rows:
            uid = r["user_id"] or "unknown"
            if uid not in by_user:
                by_user[uid] = {"input": 0, "turns": 0, "sessions": 0}
            by_user[uid]["input"] += r["input_tokens"] or 0
            by_user[uid]["turns"] += r["message_count"] or 0
            by_user[uid]["sessions"] += 1

        print(f"  {'Per-user breakdown (profiled):'}")
        print(f"  {'user_id':<24}  {'sessions':>8}  {'avg input/turn':>14}")
        print(f"  {'─'*24}  {'─'*8}  {'─'*14}")
        for uid, d in sorted(by_user.items(), key=lambda x: x[1]["input"], reverse=True)[:10]:
            avg = d["input"] / d["turns"] if d["turns"] else 0
            print(f"  {uid[:24]:<24}  {d['sessions']:>8}  {avg:>14.0f}")
        print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AC5 token reduction verification")
    parser.add_argument("--days", type=int, default=30, help="Look-back window in days")
    parser.add_argument("--source", type=str, default=None, help="Filter by platform source (cli, telegram, discord, ...)")
    parser.add_argument("--db", type=str, default=None, help="Path to state.db (default: ~/.hermes/state.db)")
    args = parser.parse_args()

    from hermes_constants import get_hermes_home
    db_path = Path(args.db) if args.db else get_hermes_home() / "state.db"

    if not db_path.exists():
        print(f"DB not found: {db_path}")
        raise SystemExit(1)

    run(db_path, days=args.days, source=args.source)
