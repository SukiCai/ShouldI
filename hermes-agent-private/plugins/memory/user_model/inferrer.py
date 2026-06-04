"""UserModelInferrer — session-end parallel LLM tasks for trait + signal vocab update."""

from __future__ import annotations

import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, List, Optional

from plugins.memory.user_model.store import UserModel, UserModelStore

logger = logging.getLogger(__name__)

MIN_TURNS = 3        # Skip inference if fewer than 3 user turns
COOLDOWN_HOURS = 1   # Skip if last inference was < 1 hour ago

_TASK_A_PROMPT = """\
Analyze this conversation and update the user model.

Existing inferred dimensions:
{existing_inferred}

Conversation transcript:
{transcript}

For each dimension where you observe new evidence OR existing evidence is reinforced, \
return a JSON array of updated dimensions:
[
  {{
    "field": "communication_style",
    "keywords": [{{"value": "direct", "evidence_strength": 0.8}}],
    "summary": "1-2 sentence summary capturing what this trait means for this specific user \
based on HOW they expressed it in this conversation (not just the keywords)"
  }}
]

Available fields: role, domain, experience_level, communication_style, technical_depth, \
preferred_response_length, industry, decision_making_style

Rules:
- Only return dimensions with clear evidence in THIS conversation
- evidence_strength: 0.5 (possible) to 1.0 (explicit statement by user)
- summary field is ALWAYS required:
  * NEW dimension (no existing summary): write a fresh 1-2 sentence summary from this conversation
  * EXISTING dimension, keywords changed materially: update the summary to reflect new evidence
  * EXISTING dimension, keywords unchanged: copy the existing summary verbatim
- summary MUST reflect conversation context — capture nuance, not just keywords
- Return [] if no evidence found
- Return ONLY valid JSON, no commentary"""

_TASK_B_PROMPT = """\
Analyze this conversation and extract phrases that signal when this user is about to \
reveal something about their professional background or preferences.

Return a JSON array:
[{{"term": "as a PM", "trigger_for": "role", "confidence": 0.8}}]

Rules:
- Terms MUST be in the user's ORIGINAL language (do not translate)
- Focus on phrases that PRECEDE self-disclosure (e.g. "in my experience", "我们团队", "as an engineer")
- confidence: 0.5 (weak signal) to 1.0 (strong predictor)
- Return [] if no useful signal phrases found
- Return ONLY valid JSON, no commentary

Conversation:
{transcript}"""


def _build_transcript(messages: List[dict], max_turns: int = 20) -> str:
    lines = []
    for msg in messages[-max_turns * 2:]:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if isinstance(content, list):
            content = " ".join(
                block.get("text", "") for block in content if isinstance(block, dict)
            )
        if role in ("user", "assistant") and content:
            lines.append(f"{role.upper()}: {content}")
    return "\n".join(lines)


def _count_user_turns(messages: List[dict]) -> int:
    return sum(1 for m in messages if m.get("role") == "user")


def _parse_json_array(text: str) -> list:
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        result = json.loads(text)
        return result if isinstance(result, list) else []
    except Exception:
        logger.debug("Failed to parse JSON from LLM response: %s", text[:200])
        return []


class UserModelInferrer:
    def __init__(
        self,
        store: UserModelStore,
        client: Any,
        model: Optional[str],
        *,
        task_a_client: Any = None,
        task_a_model: Optional[str] = None,
    ):
        self._store = store
        self._client = client          # Task B + Gate 3
        self._model = model
        # Task A uses a separate (typically smarter) client; falls back to aux client
        self._task_a_client = task_a_client or client
        self._task_a_model = task_a_model or model

    def run(self, user_id: str, messages: List[dict], user_model: UserModel) -> None:
        """Run Task A + Task B in parallel. Both update the store on success."""
        if not self._task_a_client or not self._task_a_model:
            logger.debug("UserModelInferrer: no client for Task A, skipping inference")
            return
        if not self._client or not self._model:
            logger.debug("UserModelInferrer: no aux client for Task B, skipping inference")
            return

        if _count_user_turns(messages) < MIN_TURNS:
            logger.debug("UserModelInferrer: < %d user turns, skipping", MIN_TURNS)
            return

        # Cooldown check
        last_updated = user_model.updated_at
        if time.time() - last_updated < COOLDOWN_HOURS * 3600:
            logger.debug("UserModelInferrer: within cooldown window, skipping")
            return

        transcript = _build_transcript(messages)
        if not transcript:
            return

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {
                executor.submit(self._task_a, user_id, transcript, user_model): "task_a",
                executor.submit(self._task_b, user_id, transcript): "task_b",
            }
            for future in as_completed(futures):
                task_name = futures[future]
                try:
                    future.result()
                except Exception:
                    logger.warning("UserModelInferrer %s failed", task_name, exc_info=True)

    def _task_a(self, user_id: str, transcript: str, user_model: UserModel) -> None:
        from agent.auxiliary_client import auxiliary_max_tokens_param

        existing = json.dumps(
            [{"field": d.field, "keywords": [k.value for k in d.keywords], "summary": d.summary}
             for d in user_model.inferred],
            ensure_ascii=False,
        )
        prompt = _TASK_A_PROMPT.format(existing_inferred=existing, transcript=transcript)

        response = self._task_a_client.chat.completions.create(
            model=self._task_a_model,
            messages=[{"role": "user", "content": prompt}],
            **auxiliary_max_tokens_param(600),
            temperature=0,
        )
        raw = response.choices[0].message.content or ""
        new_dimensions = _parse_json_array(raw)
        if new_dimensions:
            self._store.update_inferred(user_id, new_dimensions)
            logger.debug("Task A: updated %d dimensions for %s", len(new_dimensions), user_id)

    def _task_b(self, user_id: str, transcript: str) -> None:
        from agent.auxiliary_client import auxiliary_max_tokens_param

        prompt = _TASK_B_PROMPT.format(transcript=transcript)
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            **auxiliary_max_tokens_param(300),
            temperature=0,
        )
        raw = response.choices[0].message.content or ""
        new_terms = _parse_json_array(raw)
        if new_terms:
            self._store.update_signal_vocab(user_id, new_terms)
            logger.debug("Task B: updated %d signal terms for %s", len(new_terms), user_id)
