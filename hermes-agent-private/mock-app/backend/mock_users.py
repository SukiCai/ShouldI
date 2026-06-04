"""SQLite-backed registry of mock users for the Hermes mock app."""

from __future__ import annotations

import os
import sqlite3
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_users.db")

SEED_USERS: list[dict] = [
    {
        "id": "pm_sarah",
        "name": "Sarah Chen",
        "role": "Product Manager",
        "domain": "B2B SaaS",
        "years_experience": 8,
        "industry": "Technology",
        "bio": "Focuses on user research and data-driven decisions",
    },
    {
        "id": "eng_marcus",
        "name": "Marcus Johnson",
        "role": "Software Engineer",
        "domain": "Backend Systems",
        "years_experience": 5,
        "industry": "Fintech",
        "bio": "Specializes in distributed systems and API design",
    },
    {
        "id": "des_priya",
        "name": "Priya Sharma",
        "role": "UX Designer",
        "domain": "Mobile Apps",
        "years_experience": 6,
        "industry": "Healthcare",
        "bio": "Passionate about accessibility and inclusive design",
    },
    {
        "id": "ds_alex",
        "name": "Alex Rivera",
        "role": "Data Scientist",
        "domain": "ML/NLP",
        "years_experience": 4,
        "industry": "E-commerce",
        "bio": "Builds recommendation systems and customer analytics",
    },
    {
        "id": "mkt_jamie",
        "name": "Jamie Park",
        "role": "Marketing Lead",
        "domain": "Growth Marketing",
        "years_experience": 7,
        "industry": "Consumer Tech",
        "bio": "Expert in user acquisition and retention campaigns",
    },
]


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create table and seed mock users (idempotent)."""
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                domain TEXT NOT NULL,
                years_experience INTEGER NOT NULL,
                industry TEXT NOT NULL,
                bio TEXT NOT NULL
            )
            """
        )
        for user in SEED_USERS:
            conn.execute(
                """
                INSERT OR REPLACE INTO users
                    (id, name, role, domain, years_experience, industry, bio)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user["id"],
                    user["name"],
                    user["role"],
                    user["domain"],
                    user["years_experience"],
                    user["industry"],
                    user["bio"],
                ),
            )
        conn.commit()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "role": row["role"],
        "domain": row["domain"],
        "years_experience": row["years_experience"],
        "industry": row["industry"],
        "bio": row["bio"],
    }


def get_all_users() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM users ORDER BY id"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_user(user_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    return _row_to_dict(row) if row else None


ALLOWED_UPDATE_FIELDS = {"role", "domain", "years_experience", "industry", "bio"}


def update_user(user_id: str, fields: dict) -> Optional[dict]:
    """Update allowed fields on a user. Returns the updated user dict or None."""
    updates = {k: v for k, v in fields.items() if k in ALLOWED_UPDATE_FIELDS and v is not None}
    if not updates:
        return get_user(user_id)

    set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
    values = list(updates.values()) + [user_id]

    with _connect() as conn:
        cursor = conn.execute(
            f"UPDATE users SET {set_clause} WHERE id = ?",
            values,
        )
        conn.commit()
        if cursor.rowcount == 0:
            return None
    return get_user(user_id)
