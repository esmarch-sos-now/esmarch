"""POST /api/support/transcribe: the requester's recorded description as text. OpenAI is faked here."""

import httpx2  # the HTTP client openai is built on
import openai
import pytest

from app.core.config import get_settings
from app.modules.support import transcribe as speech

ORIGIN = {"Origin": "https://esmarch.example"}
AUDIO = b"\x1aE\xdf\xa3" + b"\0" * 2000  # a WebM header; the fake never decodes it


class FakeOpenAI:
    calls: list[dict] = []
    fail = False

    def __init__(self, **kwargs) -> None:
        self.audio = self
        self.transcriptions = self

    async def create(self, **kwargs):
        if FakeOpenAI.fail:
            raise openai.APIConnectionError(request=httpx2.Request("POST", "https://api.openai.com/v1/audio"))
        FakeOpenAI.calls.append(kwargs)
        return type("Transcription", (), {"text": "  Có người ngã bất tỉnh trước cửa hàng.  "})()


@pytest.fixture
def stt(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "openai_api_key", "sk-test")
    monkeypatch.setattr(speech, "AsyncOpenAI", FakeOpenAI)
    monkeypatch.setattr(speech, "_limiter", None)
    FakeOpenAI.calls, FakeOpenAI.fail = [], False
    return FakeOpenAI


def send(client, data=AUDIO, content_type="audio/webm;codecs=opus", headers=ORIGIN):
    return client.post("/api/support/transcribe", headers=headers, files={"file": ("voice", data, content_type)})


def test_disabled_without_a_key(client, monkeypatch):
    monkeypatch.setattr(speech, "_limiter", None)
    assert client.get("/api/support/transcribe").json() == {"enabled": False}
    assert send(client).status_code == 503


def test_the_backend_tells_the_form_to_offer_voice_input(client, stt):
    assert client.get("/api/support/transcribe").json() == {"enabled": True}


def test_returns_the_text_from_gpt_transcribe_in_vietnamese(client, stt):
    response = send(client)
    assert response.status_code == 200
    assert response.json() == {"text": "Có người ngã bất tỉnh trước cửa hàng."}
    (call,) = stt.calls
    assert call["model"] == "gpt-transcribe" and call["language"] == "vi"
    assert call["file"] == ("description.webm", AUDIO, "audio/webm")


def test_safari_mp4_recordings_are_accepted(client, stt):
    assert send(client, content_type="audio/mp4").status_code == 200
    assert stt.calls[0]["file"][0] == "description.mp4"


def test_rejects_other_sites_formats_and_sizes_before_calling_openai(client, stt, monkeypatch):
    assert send(client, headers={"Origin": "https://evil.example"}).status_code == 403
    assert send(client, content_type="image/png").status_code == 400
    assert send(client, data=b"").status_code == 400
    monkeypatch.setattr(get_settings(), "support_transcribe_max_bytes", 1000)
    assert send(client).status_code == 400
    assert stt.calls == []


def test_recordings_per_ip_are_capped(client, stt, monkeypatch):
    monkeypatch.setattr(get_settings(), "support_transcribe_per_ip", 2)
    assert send(client).status_code == 200 and send(client).status_code == 200
    assert send(client).status_code == 429
    assert len(stt.calls) == 2


def test_an_openai_failure_is_a_502_without_details(client, stt):
    stt.fail = True
    response = send(client)
    assert response.status_code == 502
    assert response.json()["detail"] == "Speech-to-text failed."
