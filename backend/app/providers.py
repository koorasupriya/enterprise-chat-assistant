"""LLM providers behind one small interface: stream text chunks for a conversation.

`DemoProvider` runs offline (no API key) so the app, UI and tests work anywhere.
`ClaudeProvider` streams real responses from Anthropic Claude.
"""
from __future__ import annotations

import asyncio
import re
from typing import AsyncIterator, Protocol

from .config import Settings
from .schemas import Message


class LLMProvider(Protocol):
    name: str

    def stream(self, messages: list[Message], system: str) -> AsyncIterator[str]: ...


class DemoProvider:
    """Deterministic offline assistant. Streams word by word to mimic a real model."""

    name = "demo"

    def __init__(self, delay: float = 0.02):
        self.delay = delay

    def reply(self, messages: list[Message]) -> str:
        text = messages[-1].content.strip()
        low = text.lower()
        turns = sum(1 for m in messages if m.role == "user")
        if re.search(r"\b(hi|hello|hey|good (morning|afternoon|evening))\b", low):
            return ("Hello! I'm the enterprise assistant running in demo mode. I can answer questions, "
                    "and in later versions I'll search company documents and raise tickets for you.")
        if "help" in low or "what can you do" in low:
            return ("Here's what I can do:\n\n- Answer general questions\n- Keep track of our conversation\n"
                    "- Search internal documents with citations (coming soon)\n"
                    "- Raise IT tickets and approval requests (coming soon)")
        return (f"You said: \"{text}\". I'm running in demo mode, so this is a placeholder reply. "
                f"Set CHAT_PROVIDER=claude and ANTHROPIC_API_KEY to get real answers. "
                f"(Message {turns} in this conversation.)")

    async def stream(self, messages: list[Message], system: str) -> AsyncIterator[str]:
        for token in re.findall(r"\S+\s*|\s+", self.reply(messages)):
            if self.delay:
                await asyncio.sleep(self.delay)
            yield token


class ClaudeProvider:
    name = "claude"

    def __init__(self, settings: Settings):
        import anthropic

        self.client = anthropic.AsyncAnthropic()
        self.model = settings.model
        self.max_tokens = settings.max_tokens

    async def stream(self, messages: list[Message], system: str) -> AsyncIterator[str]:
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=[m.model_dump() for m in messages],
        ) as stream:
            async for text in stream.text_stream:
                yield text


def build_provider(settings: Settings) -> LLMProvider:
    if settings.provider == "claude":
        return ClaudeProvider(settings)
    if settings.provider == "demo":
        return DemoProvider()
    raise ValueError(f"Unknown CHAT_PROVIDER '{settings.provider}' (use 'demo' or 'claude')")
