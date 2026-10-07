"""Athena (prefrontal cortex): recall, reason, answer with provenance.

Recall is scoped by Cerberus to the datasets this user may read. Chunks are pulled
raw (no LLM inside Cognee) so the provenance headers survive; synthesis happens in
Hermes' routed model through the Respan gateway, so the trace shows the model and
cost of the step. If relevant datasets exist that the user cannot read, the answer
says so instead of guessing: access shapes the behaviour."""
from __future__ import annotations

import re

from . import config, llm
from .cerberus import get_or_create_user

import cognee
from cognee import SearchType

SOURCE_TAG = re.compile(r"\[(source:[a-z]+)[^\]]*\]")

SYSTEM = """You are Athena, the reasoning agent of a company brain called Pantheon.
Answer the user's question using ONLY the context passages. Each passage starts with a
provenance header like [source:slack channel:#general ...] or [source:github repo:... pr:#42].
Rules:
- Be concise (2-5 sentences). State facts with their source in brackets, e.g. "(Slack #general)" or "(GitHub PR #42)".
- If the passages do not contain the answer, say exactly what is missing. Never invent.
- If a HIDDEN section lists datasets the user cannot read, add one final sentence:
  "There is information in <dataset> you do not have access to; ask <owner> for access."
- Do not reveal anything that is not in the readable passages."""


async def recall(user_key: str, question: str, readable: list[str], top_k: int = 8) -> list[str]:
    if not readable:
        return []
    user = await get_or_create_user(user_key)
    results = await cognee.recall(question, query_type=SearchType.CHUNKS, datasets=readable, user=user, top_k=top_k)
    passages: list[str] = []
    for r in results:
        text = getattr(r, "text", None) or getattr(r, "content", None) or str(r)
        if text and text not in passages:
            passages.append(text)
    return passages


def sources_in(passages: list[str]) -> list[str]:
    found: list[str] = []
    for p in passages:
        for m in SOURCE_TAG.findall(p):
            if m not in found:
                found.append(m)
    return found


async def answer(user_key: str, question: str, scope: dict, usage: llm.Usage) -> dict:
    passages = await recall(user_key, question, scope["readable"])
    hidden = scope.get("hidden") or {}
    context = "\n\n---\n\n".join(passages) if passages else "(no readable passages)"
    hidden_txt = ""
    if hidden:
        hidden_txt = "\n\nHIDDEN (exists, not readable by this user):\n" + "\n".join(
            f"- {name} (owner: {meta.get('owner')}, contains: {', '.join(meta.get('extra') or meta.get('sources', []))})" for name, meta in hidden.items()
        )
    prompt = f"User: {user_key} ({scope['identifier']})\nQuestion: {question}\n\nCONTEXT:\n{context}{hidden_txt}"
    text = llm.complete("synthesize", SYSTEM, prompt, usage=usage)
    return {"answer": text, "sources": sources_in(passages), "passages": len(passages), "hidden": list(hidden.keys())}
