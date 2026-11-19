"""Request and response models for the chat API."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=20_000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(..., min_length=1)
    conversation_id: str | None = None

    @field_validator("messages")
    @classmethod
    def last_message_from_user(cls, v: list[Message]) -> list[Message]:
        if v[-1].role != "user":
            raise ValueError("the last message must come from the user")
        return v


class ChatResponse(BaseModel):
    conversation_id: str
    message: Message
    provider: str
