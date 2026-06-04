"""bridge.py — product app API for seeding registration data into UserModelStore."""

from __future__ import annotations

from plugins.memory.user_model.store import UserModelStore


def seed_user_from_registration(
    user_id: str,
    registration_data: dict,
    hermes_home: str,
) -> None:
    """
    Called by the product app when a user starts a session.
    Idempotent — safe to call on every session start.

    Expected registration_data keys (all optional):
        role             e.g. "Product Manager"
        domain           e.g. "B2B SaaS"
        years_experience e.g. 5
        industry         e.g. "Technology"

    Example:
        seed_user_from_registration(
            user_id="user_123",
            registration_data={"role": "Product Manager", "domain": "B2B SaaS", "years_experience": 5},
            hermes_home=str(get_hermes_home()),
        )
    """
    store = UserModelStore(hermes_home=hermes_home)
    store.seed_from_registration(user_id, registration_data)
