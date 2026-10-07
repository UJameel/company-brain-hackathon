"""Hermes' model router: every LLM call goes through the Respan gateway, and each
step gets the model that fits it. Cheap models for routing/tagging/judging,
a strong model for synthesis. Usage is visible per step in Respan."""
from __future__ import annotations

from dataclasses import dataclass, field

from openai import OpenAI

from . import config

# step -> model slug on the Respan gateway
ROUTES: dict[str, str] = {
    "route": "gpt-4o-mini",          # classify intent, pick agents
    "tag": "gpt-4o-mini",            # provenance tagging helpers
    "synthesize": "claude-sonnet-4-5",  # the answer the user reads
    "draft": "claude-haiku-4-5",     # action payloads (Slack message, issue body)
    "judge": "claude-haiku-4-5",     # Themis: pinned, independent of the model Athena answers with
}


@dataclass
class Usage:
    calls: list[dict] = field(default_factory=list)

    def add(self, step: str, model: str, resp) -> None:
        u = getattr(resp, "usage", None)
        self.calls.append(
            {
                "step": step,
                "model": model,
                "prompt_tokens": getattr(u, "prompt_tokens", None),
                "completion_tokens": getattr(u, "completion_tokens", None),
            }
        )


_client: OpenAI | None = None


def client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(base_url=config.RESPAN_BASE_URL, api_key=config.RESPAN_API_KEY)
    return _client


def complete(step: str, system: str, user: str, usage: Usage | None = None, max_tokens: int = 700) -> str:
    model = ROUTES[step]
    resp = client().chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_completion_tokens=max_tokens,
        temperature=0,
    )
    if usage is not None:
        usage.add(step, model, resp)
    return (resp.choices[0].message.content or "").strip()
