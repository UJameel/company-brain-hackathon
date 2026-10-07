"""Hermes' model router: every step gets the model that fits it, and usage is visible per step.

Two providers:
  - the Respan gateway (OpenAI-compatible) for anything that writes text: synthesis, drafts;
  - a local small model through Ollama for closed-set decisions: routing and judging. These
    are classification tasks; an 8B model answers them in a fraction of a second for free,
    and keeps the question text on the machine. If Ollama is not reachable (e.g. in the
    hosted Docker image) the step falls back to its gateway model automatically.
Toggle with PANTHEON_LOCAL=1; pick the model with LOCAL_MODEL (any Ollama tag)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from openai import OpenAI

from . import config

# step -> gateway model slug (always available)
ROUTES: dict[str, str] = {
    "route": "gpt-4o-mini",             # classify intent, pick agents
    "tag": "gpt-4o-mini",               # provenance tagging helpers
    "synthesize": "claude-sonnet-4-5",  # the answer the user reads
    "draft": "claude-haiku-4-5",        # action payloads (Slack message, issue body)
    "judge": "claude-haiku-4-5",        # Themis: pinned, independent of the model Athena answers with
}

LOCAL_ENABLED = os.environ.get("PANTHEON_LOCAL", "0") == "1"
LOCAL_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
LOCAL_MODEL = os.environ.get("LOCAL_MODEL", "llama3.1:8b")
LOCAL_STEPS = set(filter(None, os.environ.get("LOCAL_STEPS", "route,judge").split(",")))
_local_down = False


def model_for(step: str) -> tuple[str, str]:
    """(provider, model) actually used for a step right now."""
    if LOCAL_ENABLED and step in LOCAL_STEPS and not _local_down:
        return "ollama", LOCAL_MODEL
    return "respan", ROUTES[step]


@dataclass
class Usage:
    calls: list[dict] = field(default_factory=list)

    def add(self, step: str, provider: str, model: str, resp, fallback: bool = False) -> None:
        u = getattr(resp, "usage", None)
        self.calls.append({"step": step, "provider": provider, "model": model,
                           "prompt_tokens": getattr(u, "prompt_tokens", None),
                           "completion_tokens": getattr(u, "completion_tokens", None),
                           **({"fallback": True} if fallback else {})})


_clients: dict[str, OpenAI] = {}


def client(provider: str = "respan") -> OpenAI:
    if provider not in _clients:
        if provider == "ollama":
            _clients[provider] = OpenAI(base_url=LOCAL_BASE_URL, api_key="ollama", timeout=60)
        else:
            _clients[provider] = OpenAI(base_url=config.RESPAN_BASE_URL, api_key=config.RESPAN_API_KEY)
    return _clients[provider]


def complete(step: str, system: str, user: str, usage: Usage | None = None, max_tokens: int = 700, json_mode: bool = False) -> str:
    global _local_down
    provider, model = model_for(step)
    kwargs = {"messages": [{"role": "system", "content": system}, {"role": "user", "content": user}], "temperature": 0}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    if provider == "ollama":
        try:
            resp = client("ollama").chat.completions.create(model=model, max_tokens=max_tokens, **kwargs)
            if usage is not None:
                usage.add(step, provider, model, resp)
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:  # Ollama not running, model not pulled, or timeout: fall back once, then stay on the gateway
            print(f"[hermes] local model unavailable for {step} ({str(e).splitlines()[0][:80]}); falling back to {ROUTES[step]}")
            _local_down = True
            provider, model = "respan", ROUTES[step]
    resp = client("respan").chat.completions.create(model=model, max_completion_tokens=max_tokens, **{k: v for k, v in kwargs.items() if k != "response_format"})
    if usage is not None:
        usage.add(step, provider, model, resp, fallback=LOCAL_ENABLED and step in LOCAL_STEPS)
    return (resp.choices[0].message.content or "").strip()
