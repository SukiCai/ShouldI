"""UserModelProvider — MemoryProvider plugin for persistent per-user modeling."""

from __future__ import annotations

import logging
import threading
from typing import Any, Dict, List, Optional

from agent.memory_provider import MemoryProvider
from plugins.memory.user_model.gate import TurnGate
from plugins.memory.user_model.inferrer import UserModelInferrer
from plugins.memory.user_model.store import UserModel, UserModelStore

logger = logging.getLogger(__name__)


class UserModelProvider(MemoryProvider):
    """Persistent per-user profile from registration data + conversation inference.

    MUTUALLY EXCLUSIVE with other external memory providers (Honcho, Mem0).
    Only one external provider is supported at a time.

    Activation (config.yaml):
        memory:
          provider: user_model
    """

    name = "user_model"

    def __init__(self) -> None:
        self._user_id: str = ""
        self._store: Optional[UserModelStore] = None
        self._model: Optional[UserModel] = None
        self._gate: Optional[TurnGate] = None
        self._aux_client: Any = None
        self._aux_model: Optional[str] = None
        self._task_a_client: Any = None
        self._task_a_model: Optional[str] = None
        # Threading.Event: set = "no in-flight inference", clear = "inference running"
        self._inference_event = threading.Event()
        self._inference_event.set()

    @property
    def name(self) -> str:  # type: ignore[override]
        return "user_model"

    def is_available(self) -> bool:
        return True  # Local SQLite — always available

    def initialize(self, session_id: str, **kwargs) -> None:
        self._user_id = kwargs.get("user_id", "") or ""
        hermes_home = kwargs["hermes_home"]

        self._store = UserModelStore(hermes_home=hermes_home)
        self._model = self._store.get_model(self._user_id) if self._user_id else None

        # Build auxiliary client for Task B + Gate 3
        try:
            from agent.auxiliary_client import get_text_auxiliary_client
            self._aux_client, self._aux_model = get_text_auxiliary_client(task="user_model")
        except Exception:
            logger.debug("UserModelProvider: no aux client available, Gate 3 will default to True")
            self._aux_client, self._aux_model = None, None

        # Build Task A client (smarter model for trait inference; falls back to aux client)
        try:
            from agent.auxiliary_client import get_text_auxiliary_client
            self._task_a_client, self._task_a_model = get_text_auxiliary_client(task="user_model_task_a")
        except Exception:
            logger.debug("UserModelProvider: no Task A client, will fall back to aux client")
            self._task_a_client, self._task_a_model = None, None

        self._gate = TurnGate(client=self._aux_client, model=self._aux_model)

        if self._model:
            logger.info(
                "UserModelProvider: loaded model for %s (%d inferred dims, %d signal terms)",
                self._user_id,
                len(self._model.inferred),
                len(self._model.signal_vocab),
            )
        else:
            logger.debug("UserModelProvider: no model for user_id=%r", self._user_id)

    def system_prompt_block(self) -> str:
        """Registration profile + all inferred dimension summaries.
        Position 7/9 in system prompt. Token savings from shorter conversations."""
        if not self._model or not self._store or not self._user_id:
            return ""
        try:
            ctx = self._store.get_compressed_context(self._user_id)
            if ctx:
                return f"## User Profile\n{ctx}"
            return ""
        except Exception:
            logger.debug("UserModelProvider.system_prompt_block failed", exc_info=True)
            return ""

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        """No-op — user profile is fully covered by system_prompt_block()."""
        return ""

    def sync_turn(
        self, user_content: str, assistant_content: str, *, session_id: str = "",
        messages: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        """Three-gate filter. Queue messages that pass all gates for session-end inference."""
        if not self._user_id or not self._model or not self._gate:
            return
        try:
            vocab = self._model.signal_vocab
            if self._gate.check(user_content, vocab):
                # Message is queued implicitly — the full messages list is passed
                # to on_session_end(), so we don't need to buffer here.
                logger.debug("UserModelProvider: signal detected in turn, will infer at session end")
        except Exception:
            logger.debug("UserModelProvider.sync_turn gate check failed", exc_info=True)

    def on_session_end(self, messages: List[Dict[str, Any]]) -> None:
        """Launch async inference (Task A + Task B in parallel).
        Event cleared until both tasks complete — shutdown() will wait."""
        if not self._user_id or not self._model or not self._store:
            return

        self._inference_event.clear()

        model_snapshot = self._model
        store = self._store
        aux_client = self._aux_client
        aux_model = self._aux_model
        task_a_client = self._task_a_client
        task_a_model = self._task_a_model
        user_id = self._user_id
        event = self._inference_event

        def _infer() -> None:
            try:
                inferrer = UserModelInferrer(
                    store, aux_client, aux_model,
                    task_a_client=task_a_client,
                    task_a_model=task_a_model,
                )
                inferrer.run(user_id, messages, model_snapshot)
            except Exception:
                logger.warning("UserModelProvider: inference failed", exc_info=True)
            finally:
                event.set()

        threading.Thread(target=_infer, daemon=True, name="user_model_infer").start()

    def shutdown(self) -> None:
        """Wait up to 10s for in-flight inference before teardown (mirrors Honcho pattern)."""
        self._inference_event.wait(timeout=10.0)

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        return []  # Pure context provider — no tools exposed to the model
