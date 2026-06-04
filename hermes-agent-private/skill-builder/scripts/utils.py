import json
import os
import sys
from pathlib import Path

import yaml


# ---------------------------------------------------------------------------
# LLM client abstraction — supports ANTHROPIC_API_KEY or OPENROUTER_API_KEY
# ---------------------------------------------------------------------------

class LLMClient:
    """Thin wrapper: same .chat() call whether using Anthropic or OpenRouter."""

    def __init__(self) -> None:
        # 1. Direct Anthropic key
        if os.environ.get("ANTHROPIC_API_KEY"):
            import anthropic
            self._backend = "anthropic"
            self._client = anthropic.Anthropic()
            return

        # 2. OpenRouter key from env
        if os.environ.get("OPENROUTER_API_KEY"):
            import openai
            self._backend = "openrouter"
            self._client = openai.OpenAI(
                api_key=os.environ["OPENROUTER_API_KEY"],
                base_url="https://openrouter.ai/api/v1",
            )
            return

        # 3. Hermes auth.json fallback (~/.hermes/auth.json credential_pool)
        try:
            auth_path = Path.home() / ".hermes" / "auth.json"
            with open(auth_path) as f:
                auth = json.load(f)
            pool = auth.get("credential_pool", {}).get("openrouter", [])
            if pool and isinstance(pool, list):
                entry = next((e for e in pool if e.get("access_token")), None)
                if entry:
                    import openai
                    self._backend = "openrouter"
                    self._client = openai.OpenAI(
                        api_key=entry["access_token"],
                        base_url=entry.get("base_url", "https://openrouter.ai/api/v1"),
                    )
                    print(f"  [auth] Using OpenRouter key from ~/.hermes/auth.json")
                    return
        except Exception:
            pass

        sys.exit(
            "No API key found. Set one of:\n"
            "  export ANTHROPIC_API_KEY=sk-ant-...\n"
            "  export OPENROUTER_API_KEY=sk-or-..."
        )

    def _model(self, model: str) -> str:
        """Prefix model name for OpenRouter if needed."""
        if self._backend == "openrouter" and not model.startswith("anthropic/"):
            return f"anthropic/{model}"
        return model

    def chat(self, model: str, messages: list[dict], max_tokens: int = 4096) -> str:
        m = self._model(model)
        if self._backend == "anthropic":
            resp = self._client.messages.create(
                model=m, max_tokens=max_tokens, messages=messages
            )
            return resp.content[0].text
        else:
            resp = self._client.chat.completions.create(
                model=m, max_tokens=max_tokens, messages=messages
            )
            return resp.choices[0].message.content


def load_config(skill_dir: Path) -> dict:
    with open(skill_dir / "config.yaml") as f:
        return yaml.safe_load(f)


def save_json(path: Path, data: dict, indent: int = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_prompt(name: str) -> str:
    prompts_dir = Path(__file__).parent.parent / "prompts"
    return (prompts_dir / name).read_text(encoding="utf-8")


def get_skill_dir(skill_name: str) -> Path:
    return Path(__file__).parent.parent / "skills" / skill_name


def strip_json_fences(text: str) -> str:
    """Remove markdown code fences around JSON if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Drop first line (```json or ```) and last line (```)
        inner = lines[1:] if lines[-1].strip() == "```" else lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        text = "\n".join(inner)
    return text.strip()
