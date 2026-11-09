"""Call plumbing: the bridge's scripted speech, the silence/long-speech timers and the WebSocket admission rules."""

import json
from collections.abc import Callable, Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core import config
from app.voice import router as voice_router

pytestmark = pytest.mark.anyio


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[Callable[..., TestClient]]:
    def make(**env: str) -> TestClient:
        for key, value in {"OPENAI_API_KEY": "test-key", **env}.items():
            monkeypatch.setenv(key, value)
        config.get_settings.cache_clear()
        voice_router._limiter.cache_clear()  # noqa: SLF001
        monkeypatch.setattr(voice_router, "_active_calls", 0)
        app = FastAPI()
        app.include_router(voice_router.router)
        return TestClient(app)

    yield make
    config.get_settings.cache_clear()
    voice_router._limiter.cache_clear()  # noqa: SLF001


ORIGIN = {"Origin": "http://localhost:3000"}


def refused(test_client: TestClient, headers: dict[str, str]) -> int:
    with pytest.raises(WebSocketDisconnect) as closed, test_client.websocket_connect("/api/voice/ws", headers=headers):
        pass
    return closed.value.code


def test_disabled_without_a_token(client: Callable[..., TestClient]) -> None:
    assert refused(client(OPENAI_API_KEY=""), ORIGIN) == 1013


@pytest.mark.parametrize(
    "headers", [{}, {"Origin": "https://evil.example"}, {"Origin": "http://localhost:3000.evil.example"}]
)
def test_only_the_configured_frontends_may_connect(client: Callable[..., TestClient], headers: dict[str, str]) -> None:
    assert refused(client(), headers) == 1008


def test_consent_is_required_before_anything_starts(client: Callable[..., TestClient]) -> None:
    test_client = client()
    for first in ({"type": "start"}, {"type": "start", "consent": False}, {"type": "hello", "consent": True}):
        with test_client.websocket_connect("/api/voice/ws", headers=ORIGIN) as ws:
            ws.send_text(json.dumps(first))
            with pytest.raises(WebSocketDisconnect) as closed:
                ws.receive_text()
            assert closed.value.code == 1008


def test_connect_rate_and_concurrency_are_capped(client: Callable[..., TestClient]) -> None:
    limited = client(VOICE_CONNECTS_PER_WINDOW="2")
    assert [refused(limited, {"Origin": "https://evil.example"}) for _ in range(2)] == [1008, 1008]  # still counted
    assert refused(limited, ORIGIN) == 1013
    busy = client(VOICE_MAX_SESSIONS="1")
    voice_router._active_calls = 1  # noqa: SLF001
    assert refused(busy, ORIGIN) == 1013


def test_openai_provider_builds_gpt_live_with_a_cheap_backend():
    from pydantic_ai.realtime.openai_live import OpenAILiveModel

    from app.core.config import Settings
    from app.voice.call import build_model, live_settings

    s = Settings(openai_api_key="sk-test", voice_live_backend="gpt-6-luna")
    assert s.voice_configured
    assert isinstance(build_model(s), OpenAILiveModel)
    assert live_settings(s)["openai_live_delegation"]["model"] == "gpt-6-luna"
    assert not Settings(openai_api_key="").voice_configured


def test_captions_lose_non_speech_brackets_even_when_split_across_lines():
    from app.voice.call import clean_caption

    assert clean_caption("[clear throat]") == ""
    assert clean_caption("[clear throat") == ""  # the closing bracket has not arrived yet
    assert clean_caption("]") == ""  # ... and here it is, on a line of its own
    assert clean_caption("Con tôi [cough] bị hóc") == "Con tôi bị hóc"
    assert clean_caption("Xin chào [laughs") == "Xin chào"
