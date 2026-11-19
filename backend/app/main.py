"""FastAPI app: a plain chat endpoint and a Server-Sent Events (SSE) streaming endpoint.

    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import __version__
from .config import Settings, get_settings
from .providers import LLMProvider, build_provider
from .schemas import ChatRequest, ChatResponse, Message

log = logging.getLogger("chat")


def create_app(settings: Settings | None = None, provider: LLMProvider | None = None) -> FastAPI:
    settings = settings or get_settings()
    provider = provider or build_provider(settings)

    app = FastAPI(title="Enterprise Chat Assistant", version=__version__)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"]
    )

    def window(messages: list[Message]) -> list[Message]:
        """Keep the most recent turns so long conversations stay within the model's context."""
        return messages[-settings.max_history:]

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok", "provider": provider.name, "version": __version__}

    @app.post("/api/chat", response_model=ChatResponse)
    async def chat(req: ChatRequest) -> ChatResponse:
        text = "".join([t async for t in provider.stream(window(req.messages), settings.system_prompt)])
        return ChatResponse(
            conversation_id=req.conversation_id or str(uuid.uuid4()),
            message=Message(role="assistant", content=text),
            provider=provider.name,
        )

    @app.post("/api/chat/stream")
    async def chat_stream(req: ChatRequest) -> StreamingResponse:
        conversation_id = req.conversation_id or str(uuid.uuid4())

        async def events() -> AsyncIterator[str]:
            def sse(payload: dict) -> str:
                return f"data: {json.dumps(payload)}\n\n"

            yield sse({"type": "start", "conversation_id": conversation_id})
            try:
                async for token in provider.stream(window(req.messages), settings.system_prompt):
                    yield sse({"type": "token", "content": token})
                yield sse({"type": "done", "conversation_id": conversation_id})
            except Exception:  # surface failures to the UI instead of silently closing the stream
                log.exception("streaming failed")
                yield sse({"type": "error", "message": "The assistant failed to respond. Please try again."})

        return StreamingResponse(
            events(), media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return app


app = create_app()
