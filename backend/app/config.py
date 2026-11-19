"""Settings read from environment variables (see .env.example)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

DEFAULT_SYSTEM_PROMPT = (
    "You are an internal enterprise assistant. Be concise and accurate. "
    "If you don't know something, say so instead of guessing."
)


@dataclass(frozen=True)
class Settings:
    provider: str = field(default_factory=lambda: os.getenv("CHAT_PROVIDER", "demo"))
    model: str = field(default_factory=lambda: os.getenv("CHAT_MODEL", "claude-sonnet-5-5"))
    system_prompt: str = field(default_factory=lambda: os.getenv("CHAT_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT))
    max_tokens: int = field(default_factory=lambda: int(os.getenv("CHAT_MAX_TOKENS", "1024")))
    max_history: int = field(default_factory=lambda: int(os.getenv("CHAT_MAX_HISTORY", "20")))
    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv("CHAT_CORS_ORIGINS", "http://localhost:5173").split(",")
    )


def get_settings() -> Settings:
    return Settings()
