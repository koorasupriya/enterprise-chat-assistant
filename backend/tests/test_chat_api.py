import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.providers import DemoProvider, build_provider
from app.schemas import Message


class FailingProvider:
    name = "failing"

    async def stream(self, messages, system):
        yield "partial "
        raise RuntimeError("upstream down")


class RecordingProvider:
    name = "recording"

    def __init__(self):
        self.seen = None

    async def stream(self, messages, system):
        self.seen = messages
        yield "ok"


def client(provider=None, **settings):
    return TestClient(create_app(Settings(**settings), provider or DemoProvider(delay=0)))


def sse_events(resp) -> list[dict]:
    return [json.loads(line[len("data: "):]) for line in resp.text.splitlines() if line.startswith("data: ")]


def test_health():
    body = client().get("/api/health").json()
    assert body["status"] == "ok" and body["provider"] == "demo"


def test_chat_returns_assistant_message():
    r = client().post("/api/chat", json={"messages": [{"role": "user", "content": "hello"}]})
    body = r.json()
    assert r.status_code == 200
    assert body["message"]["role"] == "assistant"
    assert body["message"]["content"].startswith("Hello!")
    assert body["conversation_id"]


def test_stream_emits_start_tokens_done():
    r = client().post("/api/chat/stream", json={"messages": [{"role": "user", "content": "what can you do"}],
                                               "conversation_id": "c-1"})
    assert r.headers["content-type"].startswith("text/event-stream")
    events = sse_events(r)
    assert events[0] == {"type": "start", "conversation_id": "c-1"}
    assert events[-1] == {"type": "done", "conversation_id": "c-1"}
    tokens = [e["content"] for e in events if e["type"] == "token"]
    assert len(tokens) > 5
    assert "".join(tokens) == DemoProvider().reply([Message(role="user", content="what can you do")])


def test_stream_reports_errors():
    events = sse_events(client(FailingProvider()).post(
        "/api/chat/stream", json={"messages": [{"role": "user", "content": "hi"}]}))
    assert events[-1]["type"] == "error"


@pytest.mark.parametrize("payload", [
    {"messages": []},
    {"messages": [{"role": "user", "content": ""}]},
    {"messages": [{"role": "system", "content": "x"}]},
    {"messages": [{"role": "user", "content": "q"}, {"role": "assistant", "content": "a"}]},
])
def test_invalid_requests_rejected(payload):
    assert client().post("/api/chat", json=payload).status_code == 422


def test_history_window_keeps_latest_turns():
    rec = RecordingProvider()
    msgs = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}"} for i in range(9)]
    client(rec, max_history=4).post("/api/chat", json={"messages": msgs})
    assert [m.content for m in rec.seen] == ["m5", "m6", "m7", "m8"]


def test_unknown_provider():
    with pytest.raises(ValueError):
        build_provider(Settings(provider="nope"))
