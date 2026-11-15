"""The voice call over plain HTTP: state in Postgres, OpenAI reached only through `app.voice.live` (faked here)."""

import json

import pytest
from sqlalchemy import text

from app.core import clock
from app.core.config import get_settings
from app.voice import live, service
from app.voice.call_state import GREETING_TEXT

ORIGIN = {"Origin": "https://esmarch.example"}
SDP = "v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n"
CRON = "cron-secret-of-at-least-16-chars"


class FakeLive:
    def __init__(self) -> None:
        self.started: list[str] = []
        self.sent: list[tuple[str, list[dict]]] = []
        self.hung_up: list[str] = []
        self.fail_start = False
        self.fail_hang_up = False
        self.gone: set[str] = set()  # sessions OpenAI no longer has

    async def start_session(self, s, sdp):
        if self.fail_start:
            raise live.LiveError("down")
        self.started.append(sdp)
        return f"live_{len(self.started)}", "answer-sdp"

    async def send(self, s, session_id, events):
        if session_id in self.gone:
            raise live.SessionGone("404")
        self.sent.append((session_id, events))

    async def hang_up(self, s, session_id):
        if self.fail_hang_up:
            raise live.LiveError("down")
        self.hung_up.append(session_id)

    async def alive(self, s, session_id):
        return session_id not in self.gone


@pytest.fixture
def openai(monkeypatch):
    fake = FakeLive()
    s = get_settings()
    monkeypatch.setattr(s, "openai_api_key", "sk-test")
    monkeypatch.setattr(s, "cron_secret", CRON)
    for name in ("start_session", "send", "hang_up", "alive"):
        monkeypatch.setattr(live, name, getattr(fake, name))
    return fake


def start(client, headers=ORIGIN, **body):
    return client.post("/api/voice/calls", headers=headers, json={"consent": True, "sdp": SDP, **body})


def auth(created: dict) -> dict:
    return {**ORIGIN, "Authorization": f"Bearer {created['token']}"}


def relay(client, created, *calls):
    body = {"calls": [{"callId": cid, "name": name, "arguments": json.dumps(args)} for cid, name, args in calls]}
    return client.post(f"/api/voice/calls/{created['callId']}/tools", headers=auth(created), json=body)


def test_disabled_without_a_key(client):
    assert start(client).status_code == 503


def test_consent_origin_and_a_real_offer_are_required(client, openai):
    assert client.post("/api/voice/calls", headers=ORIGIN, json={"consent": False, "sdp": SDP}).status_code == 400
    assert client.post("/api/voice/calls", headers=ORIGIN, json={"consent": True, "sdp": ""}).status_code == 400
    assert start(client, headers={"Origin": "https://evil.example"}).status_code == 403
    assert openai.started == []


def test_a_call_starts_with_its_own_credential(client, openai, session):
    created = start(client).json()
    assert created["sdp"] == "answer-sdp" and len(created["token"]) > 30 and created["limitSeconds"] == 600
    row = session.execute(text("SELECT token_hash, openai_session_id FROM voice_calls")).one()
    assert row.token_hash != created["token"] and row.openai_session_id == "live_1"  # only a hash is stored


def test_concurrent_calls_and_new_calls_per_ip_are_capped(client, openai, monkeypatch):
    monkeypatch.setattr(get_settings(), "voice_max_sessions", 2)
    monkeypatch.setattr(get_settings(), "voice_connects_per_window", 3)
    assert start(client).status_code == 201 and start(client).status_code == 201
    busy = start(client)
    assert busy.status_code == 503 and busy.json()["detail"] == "busy"
    clock.advance(61)  # the window has passed and the reaper frees the calls that went quiet
    assert start(client).status_code == 201
    monkeypatch.setattr(get_settings(), "voice_max_sessions", 10)
    assert start(client).status_code == 201 and start(client).status_code == 201
    assert start(client).status_code == 429  # a fourth new call from this IP within the window


def test_a_failed_start_frees_the_slot(client, openai, session):
    openai.fail_start = True
    assert start(client).status_code == 502
    row = session.execute(text("SELECT end_reason, ended_at IS NOT NULL AS ended FROM voice_calls")).one()
    assert row == ("failed", True)  # no slot held, but it still counts toward the per-IP limit


def test_a_call_past_its_limit_is_over_even_without_a_scheduler(client, openai):
    created = start(client).json()
    clock.advance(601)
    r = client.post(f"/api/voice/calls/{created['callId']}/heartbeat", headers=auth(created))
    assert r.status_code == 410 and openai.hung_up == ["live_1"]


def test_calls_that_never_connected_cannot_hold_the_cap(client, openai, monkeypatch):
    monkeypatch.setattr(get_settings(), "voice_max_sessions", 1)
    squatter = start(client).json()
    openai.gone.add("live_1")  # the browser never connected, so OpenAI dropped the session
    clock.advance(21)
    client.post(f"/api/voice/calls/{squatter['callId']}/heartbeat", headers=auth(squatter))  # still heartbeating
    assert start(client).status_code == 201  # the probe found it gone and freed the slot
    assert openai.hung_up == []  # nothing to hang up


def test_a_session_openai_dropped_ends_the_call(client, openai):
    created = start(client).json()
    openai.gone.add("live_1")
    assert relay(client, created, ("c", "updateVictimSigns", {"signs": {"awake": True}})).status_code == 410
    url = f"/api/voice/calls/{created['callId']}/heartbeat"
    assert client.post(url, headers=auth(created)).status_code == 410


def test_relayed_tool_calls_run_here_and_results_go_back_on_the_sideband(client, openai):
    created = start(client).json()
    r = relay(client, created, ("c1", "openFirstAidGuide", {"guideId": "ep-bung"}))
    assert r.status_code == 200 and {"type": "phase", "phase": "confirming"} in r.json()["messages"]
    session_id, events = openai.sent[-1]
    assert session_id == "live_1" and [e["type"] for e in events] == ["response.item.create", "response.create"]
    output = json.loads(events[0]["item"]["output"])
    assert events[0]["item"]["call_id"] == "c1" and output["status"] == "awaiting_confirmation"

    r = relay(client, created, ("c2", "openFirstAidGuide", {"guideId": "ep-bung", "callerConfirmed": True}))
    step = next(m for m in r.json()["messages"] if m["type"] == "step")
    assert step["guideId"] == "ep-bung" and step["stepIndex"] == 0  # the state carried over between requests

    before = len(openai.sent)
    again = relay(client, created, ("c2", "openFirstAidGuide", {"guideId": "ep-bung", "callerConfirmed": True}))
    assert again.json()["messages"] == []  # a retried relay is answered from the stored output, not run twice
    assert openai.sent[before][1][0]["item"]["output"] == openai.sent[before - 1][1][0]["item"]["output"]


def test_unknown_tools_and_bad_arguments_are_errors_for_the_model(client, openai):
    created = start(client).json()
    relay(client, created, ("x", "deleteEverything", {}), ("y", "guideStep", {"action": "fly"}))
    first, second = (json.loads(e["item"]["output"]) for e in openai.sent[-1][1][:2])
    assert first == {"error": "Không có công cụ này."} and "deleteEverything" not in json.dumps(first)
    assert "error" in second


def test_every_call_endpoint_needs_the_calls_own_credential(client, openai):
    a, b = start(client).json(), start(client).json()
    url = f"/api/voice/calls/{a['callId']}/heartbeat"
    assert client.post(url, headers=ORIGIN).status_code == 401
    assert client.post(url, headers=auth(b)).status_code == 404  # another call's token
    assert client.post(url, headers=auth(a)).status_code == 200


def test_nudges_say_only_what_is_due(client, openai, monkeypatch):
    monkeypatch.setattr(get_settings(), "voice_checkin_seconds", 20)
    created = start(client).json()
    url = f"/api/voice/calls/{created['callId']}/nudge"
    assert client.post(url, headers=auth(created), json={"kind": "greeting"}).json()["said"] is True
    assert openai.sent[-1][1][0] == {**openai.sent[-1][1][0], "type": "session.commentary.append"}
    assert openai.sent[-1][1][0]["content"] == GREETING_TEXT
    assert client.post(url, headers=auth(created), json={"kind": "greeting"}).json()["said"] is False  # once
    assert client.post(url, headers=auth(created), json={"kind": "checkin"}).json()["said"] is False  # triage
    assert client.post(url, headers=auth(created), json={"kind": "ending_soon"}).json()["said"] is False  # too early
    assert client.post(url, headers=auth(created), json={"kind": "shout"}).status_code == 400  # no free text

    relay(client, created, ("c", "updateVictimSigns", {"signs": {"breathing": False}}))
    relay(client, created, ("d", "openFirstAidGuide", {"guideId": "ep-bung"}))  # critical: opens at once
    assert client.post(url, headers=auth(created), json={"kind": "checkin"}).json()["said"] is True
    assert client.post(url, headers=auth(created), json={"kind": "checkin"}).json()["said"] is False  # too soon

    clock.advance(545)
    client.post(f"/api/voice/calls/{created['callId']}/heartbeat", headers=auth(created))
    warned = client.post(url, headers=auth(created), json={"kind": "ending_soon"}).json()
    assert warned["said"] is True and 50 <= warned["seconds"] <= 60


def test_the_caller_moving_the_step_by_hand_is_followed(client, openai):
    created = start(client).json()
    body = {"guideId": "ep-bung", "stepIndex": 2}
    r = client.post(f"/api/voice/calls/{created['callId']}/step", headers=auth(created), json=body)
    assert r.json()["messages"] == [{"type": "phase", "phase": "guiding"}]
    r = relay(client, created, ("n", "guideStep", {"action": "next"}))
    assert next(m for m in r.json()["messages"] if m["type"] == "step")["stepIndex"] == 3


def test_ending_hangs_up_and_wipes_the_call(client, openai, session):
    created = start(client).json()
    relay(client, created, ("c", "updateVictimSigns", {"signs": {"awake": False}}))
    url = f"/api/voice/calls/{created['callId']}"
    assert client.post(f"{url}/end", headers=auth(created), json={"reason": "stopped"}).status_code == 204
    assert openai.hung_up == ["live_1"]
    row = session.execute(text("SELECT state::text, tool_outputs::text, end_reason FROM voice_calls")).one()
    assert row == ("{}", "{}", "stopped")
    assert client.post(f"{url}/heartbeat", headers=auth(created)).status_code == 410


def test_a_failed_hang_up_is_left_for_the_reaper(client, openai):
    created = start(client).json()
    openai.fail_hang_up = True
    client.post(f"/api/voice/calls/{created['callId']}/end", headers=auth(created))
    openai.fail_hang_up = False
    assert client.get("/api/voice/reap", headers={"Authorization": f"Bearer {CRON}"}).json() == {"ended": 1}
    assert openai.hung_up == ["live_1"]


def test_the_reaper_enforces_the_limits_without_the_browser(client, openai, session, monkeypatch):
    monkeypatch.setattr(get_settings(), "voice_stale_seconds", 600)
    cron = {"Authorization": f"Bearer {CRON}"}
    expired = start(client).json()
    clock.advance(500)
    handed_off = start(client).json()
    relay(client, handed_off, ("h", "updateVictimSigns", {"signs": {"breathing": False}}))
    relay(client, handed_off, ("g", "openFirstAidGuide", {"guideId": "ep-bung"}))
    relay(client, handed_off, ("i", "handOff", {}))
    assert client.get("/api/voice/reap", headers=cron).json() == {"ended": 0}
    clock.advance(101)  # the first call passed its 600 s, the second its hand-over deadline
    client.post(f"/api/voice/calls/{handed_off['callId']}/heartbeat", headers=auth(handed_off))
    assert client.get("/api/voice/reap", headers=cron).json() == {"ended": 2}
    assert sorted(openai.hung_up) == ["live_1", "live_2"]
    reasons = dict(session.execute(text("SELECT id, end_reason FROM voice_calls")).all())
    assert reasons == {expired["callId"]: "time_limit", handed_off["callId"]: "completed"}
    assert client.post(f"/api/voice/calls/{expired['callId']}/heartbeat", headers=auth(expired)).status_code == 410


def test_a_call_whose_browser_went_quiet_is_hung_up(client, openai):
    start(client)
    clock.advance(61)
    assert client.post("/api/voice/reap", headers={"Authorization": f"Bearer {CRON}"}).json() == {"ended": 1}


def test_the_reaper_needs_the_cron_secret(client, openai):
    assert client.get("/api/voice/reap").status_code == 401
    assert client.get("/api/voice/reap", headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_the_browser_may_send_nothing_and_sees_no_session_config():
    s = get_settings()
    channel = live.live_settings(s)["openai_live_data_channel"]  # pyright: ignore[reportTypedDictNotRequiredAccess]
    assert channel["allowed_client_events"] == []
    types = {e["type"] for e in channel["allowed_server_events"]}
    assert not types & {"session.started", "session.updated", "session.closed"}


def test_the_backend_gets_every_agent_tool():
    names = {t.name for t in live.tool_definitions()}
    assert names == {"openFirstAidGuide", "guideStep", "answerFromGuide", "updateVictimSigns", "handOff"}


def test_ending_soon_line_names_the_time_left():
    assert "khoảng 2 phút" in service.ending_soon_line(120) and "khoảng 60 giây" in service.ending_soon_line(60)
