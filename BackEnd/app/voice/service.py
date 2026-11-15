"""Voice calls without a long-lived server process: every step is one short HTTP request (fits Vercel Functions).

    browser ══ WebRTC (audio, captions, the backend's function calls) ══ OpenAI GPT-Live
       │
       ├─ POST /api/voice/calls              offer -> answer; reserves one of `voice_max_sessions` slots
       ├─ POST /api/voice/calls/{id}/tools   relayed function calls -> run here -> results sent on a short sideband
       ├─ POST /api/voice/calls/{id}/nudge   greeting / check-in / "ending soon": the server picks the words
       ├─ POST /api/voice/calls/{id}/step    the caller moved the on-screen step by hand
       ├─ POST /api/voice/calls/{id}/heartbeat
       ├─ POST /api/voice/calls/{id}/end
       └─ GET  /api/voice/reap               cron (secret): hangs up calls past their limit or gone quiet

The cost cap does not depend on the browser: `reap` (run by a cron and at the start of every new call) hangs up any
call past `expires_at`, any call whose browser stopped sending heartbeats, and any call `voice_handoff_end_seconds`
after its hand-over. A browser that simply vanishes is also ended by OpenAI itself within seconds.
"""

import asyncio
import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, text, update
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, select

from app.core import clock
from app.core.config import Settings
from app.voice import live, tools
from app.voice.agent import CallSession
from app.voice.call_state import GREETING_TEXT, CallPhase
from app.voice.models import VoiceCall

log = logging.getLogger(__name__)

#: `pg_advisory_xact_lock` key that serialises slot reservations (so two requests cannot both take the last slot).
_SLOT_LOCK = 7_301_115
#: A reservation whose OpenAI session never started (the request died midway) is freed after this long.
_UNSTARTED_SECONDS = 30
#: Calls older than this are asked whether OpenAI still has them (a browser that never connected ends in seconds).
_PROBE_AFTER_SECONDS = 20
#: Ended calls (no call content left, only times and an IP hash) are deleted after this long.
_RETENTION = timedelta(days=1)
#: Tool outputs kept per call so a retried relay gets the same answer.
_KEPT_OUTPUTS = 32

#: What the assistant says (as a commentary append, so in its own words) when the caller has said nothing for a while,
#: by phase. Several lines per phase so repeated check-ins do not sound alike.
CHECK_INS: dict[CallPhase, tuple[str, ...]] = {
    "guiding": (
        "Bạn làm được bước này chưa? Xong thì nói mình biết, cần mình nhắc lại cũng được.",
        "Mình vẫn ở đây. Bạn cứ làm từ từ, xong bước này thì nói mình.",
        "Bạn có vướng chỗ nào không? Nói mình nghe, mình chỉ lại liền.",
    ),
    "monitoring": (
        "Nạn nhân giờ sao rồi bạn? Còn tỉnh và còn thở không?",
        "Mình vẫn ở đây. Nạn nhân có gì thay đổi không bạn?",
        "Bạn kể mình nghe nạn nhân giờ thế nào.",
    ),
}


def ending_soon_line(seconds: int) -> str:
    left = f"khoảng {round(seconds / 60)} phút" if seconds >= 90 else f"khoảng {seconds} giây"
    return (
        f"Cuộc gọi này sẽ tự kết thúc sau {left} nữa. Bạn có thể gọi lại ngay sau đó. "
        "Nếu đây là tình huống khẩn cấp, hãy gọi 115."
    )


class VoiceError(Exception):
    status = 400
    detail = "Bad request."

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.detail)
        self.detail = detail or self.detail


class Busy(VoiceError):
    status, detail = 503, "busy"


class TooMany(VoiceError):
    status, detail = 429, "Too many requests."


class Unavailable(VoiceError):
    status, detail = 502, "The voice service did not answer."


class NotFound(VoiceError):
    status, detail = 404, "Unknown call."


class Gone(VoiceError):
    status, detail = 410, "The call has ended."


def _hash(secret: str, value: str) -> str:
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _active():
    return VoiceCall.ended_at.is_(None)  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]


# ---- start ------------------------------------------------------------------------------------------------------


async def create_call(session: Session, s: Settings, *, ip: str, sdp: str) -> dict[str, Any]:
    await reap(session, s)
    now = clock.now()
    ip_hash = _hash(s.openai_api_key, ip)
    token = secrets.token_urlsafe(32)
    call_id = uuid.uuid4().hex

    session.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _SLOT_LOCK})
    window = now - timedelta(seconds=s.public_api_rate_limit_window_seconds)
    recent = session.scalar(
        select(func.count()).where(VoiceCall.ip_hash == ip_hash, VoiceCall.created_at >= window)  # pyright: ignore[reportArgumentType]
    )
    if (recent or 0) >= s.voice_connects_per_window:
        session.rollback()
        raise TooMany()
    if (session.scalar(select(func.count()).where(_active())) or 0) >= s.voice_max_sessions:
        session.rollback()
        raise Busy()
    row = VoiceCall(
        id=call_id,
        token_hash=_token_hash(token),
        ip_hash=ip_hash,
        created_at=now,
        expires_at=now + timedelta(seconds=s.voice_session_seconds),
        last_seen_at=now,
        state={**tools.dump(CallSession(emit=lambda _: None)), "meta": {}},
    )
    session.add(row)
    session.commit()  # the slot is ours; the lock is released before OpenAI is called

    try:
        session_id, answer = await live.start_session(s, sdp)
    except live.LiveError as e:
        session.execute(_ended(call_id, "failed"))  # frees the slot; still counts toward the per-IP limit
        session.commit()
        log.warning("voice: could not start a Live session", exc_info=True)
        raise Unavailable() from e
    row.openai_session_id = session_id
    session.add(row)
    session.commit()
    return {
        "callId": call_id,
        "token": token,
        "sdp": answer,
        "limitSeconds": s.voice_session_seconds,
        "warningSeconds": s.voice_end_warning_seconds,
        "checkinSeconds": s.voice_checkin_seconds,
        "heartbeatSeconds": s.voice_heartbeat_seconds,
    }


# ---- one call ---------------------------------------------------------------------------------------------------


def authorize(session: Session, call_id: str, token: str) -> VoiceCall:
    """The call, locked for this request, if `token` is its credential and it is still on."""
    row = session.exec(
        select(VoiceCall).where(VoiceCall.id == call_id).with_for_update()  # pyright: ignore[reportArgumentType]
    ).first()
    if row is None or not hmac.compare_digest(row.token_hash, _token_hash(token)):
        session.rollback()
        raise NotFound()
    if row.ended_at is not None or row.openai_session_id is None:
        session.rollback()
        raise Gone()
    return row


async def ensure_live(session: Session, s: Settings, row: VoiceCall) -> None:
    """A call past its limit is over even if no scheduler has run yet: hang it up now and refuse the request."""
    if clock.now() >= row.expires_at:
        await end(session, s, row, "time_limit")
        raise Gone()


async def _gone(session: Session, row_id: str, error: live.LiveError) -> VoiceError:
    """OpenAI no longer has the session: the call is over (its slot is freed)."""
    if isinstance(error, live.SessionGone):
        session.execute(_ended(row_id, "gone"))
        session.commit()
        return Gone()
    return Unavailable()


def _call(row: VoiceCall, screen: list[dict[str, Any]]) -> tuple[CallSession, dict[str, Any]]:
    return tools.load(row.state, screen.append), dict(row.state.get("meta") or {})


def _save(row: VoiceCall, call: CallSession, meta: dict[str, Any]) -> None:
    row.state = {**tools.dump(call), "meta": meta}
    row.last_seen_at = clock.now()


async def run_tools(session: Session, s: Settings, row: VoiceCall, calls: list[dict[str, str]]) -> dict[str, Any]:
    if row.tool_posts >= s.voice_max_tool_posts:
        session.rollback()
        raise TooMany()
    screen: list[dict[str, Any]] = []
    call, meta = _call(row, screen)
    stored = dict(row.tool_outputs)
    outputs: list[tuple[str, str]] = []
    for relayed in calls:
        call_id = relayed["callId"]
        if call_id not in stored:  # a retried relay gets the answer it already had
            stored[call_id] = await tools.run_tool(call, relayed["name"], relayed["arguments"])
        outputs.append((call_id, stored[call_id]))
    meta["checkins"] = 0  # the caller said something the backend acted on
    _save(row, call, meta)
    row.tool_outputs = dict(list(stored.items())[-_KEPT_OUTPUTS:])
    row.tool_posts += 1
    if call.handed_off and row.handoff_at is None:
        row.handoff_at = clock.now()
    session_id, row_id = row.openai_session_id or "", row.id
    session.add(row)
    session.commit()  # no lock is held while OpenAI is called

    try:
        await live.send(s, session_id, live.tool_result_events(outputs))
    except live.LiveError as e:
        log.warning("voice: tool results not delivered", exc_info=True)
        raise await _gone(session, row_id, e) from e
    return {"messages": screen, "handoff": call.handed_off}


async def nudge(session: Session, s: Settings, row: VoiceCall, kind: str) -> dict[str, Any]:
    """Say something the browser's timers asked for, if the call's state says it is due."""
    if row.nudges >= s.voice_max_nudges:
        session.rollback()
        raise TooMany()
    screen: list[dict[str, Any]] = []
    call, meta = _call(row, screen)
    now = clock.now()
    line: str | None = None
    reply: dict[str, Any] = {"said": False}
    if kind == "greeting" and not meta.get("greeted"):
        line, meta["greeted"] = GREETING_TEXT, True
    elif kind == "ending_soon" and not meta.get("warned"):
        left = (row.expires_at - now).total_seconds()
        if s.voice_end_warning_seconds and left <= s.voice_end_warning_seconds + 5:
            seconds = max(1, round(left))
            line, meta["warned"], reply["seconds"] = ending_soon_line(seconds), True, seconds
    elif kind == "checkin":
        lines = CHECK_INS.get(call.state.phase)
        done = int(meta.get("checkins", 0))
        last = float(meta.get("lastCheckin", 0))
        if (
            lines
            and s.voice_checkin_seconds
            and done < s.voice_checkin_max
            and now.timestamp() - last >= s.voice_checkin_seconds
        ):
            line = lines[done % len(lines)]
            meta["checkins"], meta["lastCheckin"] = done + 1, now.timestamp()
    row.nudges += 1
    _save(row, call, meta)
    session_id, row_id = row.openai_session_id or "", row.id
    session.add(row)
    session.commit()
    if line is None:
        return reply
    try:
        await live.send(s, session_id, [live.commentary_event(line)])
    except live.LiveError as e:
        raise await _gone(session, row_id, e) from e
    return {**reply, "said": True}


def follow_step(session: Session, row: VoiceCall, guide_id: str, step_index: int) -> dict[str, Any]:
    screen: list[dict[str, Any]] = []
    call, meta = _call(row, screen)
    call.sync_with_client(guide_id, step_index)
    _save(row, call, meta)
    session.add(row)
    session.commit()
    return {"messages": screen}


def heartbeat(session: Session, row: VoiceCall) -> dict[str, Any]:
    row.last_seen_at = clock.now()
    session.add(row)
    session.commit()
    return {"expiresAt": row.expires_at.isoformat()}


def _ended(row_id: str, reason: str):
    return (
        update(VoiceCall)
        .where(VoiceCall.id == row_id, _active())  # pyright: ignore[reportArgumentType]
        .values(ended_at=clock.now(), end_reason=reason, state={}, tool_outputs={})
    )


async def end(session: Session, s: Settings, row: VoiceCall, reason: str) -> None:
    session_id, row_id = row.openai_session_id, row.id
    session.commit()  # release the row lock before calling OpenAI
    if session_id:
        try:
            await live.hang_up(s, session_id)
        except live.LiveError:
            log.warning("voice: hang up failed; the reaper will retry", exc_info=True)
            session.execute(
                update(VoiceCall).where(VoiceCall.id == row_id).values(last_seen_at=clock.now() - timedelta(days=1))  # pyright: ignore[reportArgumentType]
            )
            session.commit()
            return
    session.execute(_ended(row_id, reason))
    session.commit()


# ---- the cost cap -----------------------------------------------------------------------------------------------


def _reason(row: Any, now: datetime, s: Settings) -> str | None:
    """Why an active call must end now, by the server's own rules (None = it may go on)."""
    if row.expires_at <= now:
        return "time_limit"
    if row.handoff_at is not None and row.handoff_at < now - timedelta(seconds=s.voice_handoff_end_seconds):
        return "completed"
    if row.last_seen_at < now - timedelta(seconds=s.voice_stale_seconds):
        return "stale"
    if row.openai_session_id is None and row.created_at < now - timedelta(seconds=_UNSTARTED_SECONDS):
        return "failed"
    return None


async def reap(session: Session, s: Settings) -> int:
    """End every call that is over; returns how many ended. Idempotent (a scheduler may run it twice).

    Calls past their limit, quiet for too long or done with the hand-over are hung up. Calls OpenAI no longer has
    (the browser never connected, or went away) are only marked ended: that frees their slot, so nobody can hold the
    cap by starting calls and never connecting.
    """
    now = clock.now()
    rows = session.exec(
        select(  # pyright: ignore[reportCallIssue]
            VoiceCall.id,
            VoiceCall.openai_session_id,
            VoiceCall.expires_at,
            VoiceCall.handoff_at,
            VoiceCall.last_seen_at,
            VoiceCall.created_at,
        ).where(_active())
    ).all()
    session.commit()

    due: list[tuple[str, str | None, str]] = []
    probe: list[tuple[str, str]] = []
    for row in rows:
        if reason := _reason(row, now, s):
            due.append((row.id, row.openai_session_id, reason))
        elif row.openai_session_id and row.created_at < now - timedelta(seconds=_PROBE_AFTER_SECONDS):
            probe.append((row.id, row.openai_session_id))
    found = await asyncio.gather(*(live.alive(s, session_id) for _, session_id in probe))
    due += [(row_id, None, "gone") for (row_id, _), is_alive in zip(probe, found, strict=True) if not is_alive]

    ended = 0
    for row_id, session_id, reason in due:
        if session_id:
            try:
                await live.hang_up(s, session_id)
            except live.LiveError:
                log.warning("voice: reaper could not hang up a call; will retry", exc_info=True)
                continue
        try:
            # A request may hold the row; never wait long for it (this runs on the event loop).
            session.execute(text("SET LOCAL lock_timeout = '2s'"))
            session.execute(_ended(row_id, reason))
            session.commit()
            ended += 1
        except OperationalError:
            session.rollback()
    session.execute(
        delete(VoiceCall).where(VoiceCall.ended_at.is_not(None), VoiceCall.created_at < now - _RETENTION)  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue, reportOperatorIssue]
    )
    session.commit()
    return ended
