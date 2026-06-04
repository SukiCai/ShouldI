"""Three-gate sync_turn filter — determines if a message is worth queuing for inference."""

from __future__ import annotations

import logging
from typing import Any, List, Optional

logger = logging.getLogger(__name__)

_GATE3_PROMPT = """\
Does this message reveal anything about the user's professional background, \
work habits, or communication preferences?

Message: {message}

Reply with exactly one word: YES or NO"""


class TurnGate:
    MIN_LEN = 30  # Gate 1: skip trivial ACKs

    def __init__(self, client: Any = None, model: Optional[str] = None):
        self._client = client
        self._model = model

    def check(self, message: str, signal_vocab: List[dict]) -> bool:
        """Return True if this message should be queued for session-end inference."""
        # Gate 1 — length
        if len(message.strip()) < self.MIN_LEN:
            return False

        # Gate 2 — dynamic signal vocabulary substring match
        msg_lower = message.lower()
        if not any(t.get("term", "").lower() in msg_lower for t in signal_vocab):
            return False

        # Gate 3 — LLM binary classifier (language-agnostic)
        return self._llm_classify(message)

    def _llm_classify(self, message: str) -> bool:
        if not self._client or not self._model:
            # No aux client configured — default to True (don't drop signals)
            return True
        try:
            from agent.auxiliary_client import auxiliary_max_tokens_param
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": "user", "content": _GATE3_PROMPT.format(message=message)}],
                **auxiliary_max_tokens_param(5),
                temperature=0,
            )
            answer = response.choices[0].message.content.strip().upper()
            return answer.startswith("YES")
        except Exception:
            logger.debug("TurnGate Gate 3 LLM call failed, defaulting to True", exc_info=True)
            return True
