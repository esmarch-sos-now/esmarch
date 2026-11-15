"""`/api/voice/*`: the voice call over plain HTTP (see `app.voice.service` for the flow).

Every call has its own credential (`token`, returned once by `POST /calls`, stored only as a hash); every per-call
endpoint needs it as `Authorization: Bearer <token>`. Browsers from other websites are turned away by the `Origin`
check (and by the frontend proxy); the per-IP rate limit, the cap on concurrent calls and the reaper bound the cost
whoever calls.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.voice import service
from app.voice.models import VoiceCall

router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_SDP = 20_000


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class StartCall(_Body):
    consent: Literal[True]
    sdp: Annotated[str, Field(min_length=10, max_length=MAX_SDP)]


class RelayedCall(_Body):
    call_id: Annotated[str, Field(alias="callId", min_length=1, max_length=100)]
    name: Annotated[str, Field(min_length=1, max_length=64)]
    arguments: Annotated[str, Field(max_length=8000)] = "{}"


class ToolBatch(_Body):
    calls: Annotated[list[RelayedCall], Field(min_length=1, max_length=8)]


class Nudge(_Body):
    kind: Literal["greeting", "checkin", "ending_soon"]


class StepMoved(_Body):
    guide_id: Annotated[str, Field(alias="guideId", max_length=64)]
    step_index: Annotated[int, Field(alias="stepIndex", ge=0, le=100)]


class EndCall(_Body):
    reason: Literal["stopped", "completed", "time_limit", "disconnected", "error"] = "stopped"


def _configured() -> Settings:
    s = get_settings()
    if not s.voice_configured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Voice is not available.")
    return s


def _same_site(request: Request, s: Settings = Depends(_configured)) -> Settings:
    origin = request.headers.get("origin")
    if origin is not None and origin not in s.origins:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Origin not allowed.")
    return s


def _client_ip(request: Request, s: Settings) -> str:
    if s.client_ip_header and (value := request.headers.get(s.client_ip_header)):
        return value.split(",")[0].strip()[:64]
    return request.client.host if request.client else "unknown"


def _call(
    call_id: str,
    authorization: Annotated[str, Header()] = "",
    session: Session = Depends(get_session),
    _: Settings = Depends(_same_site),
) -> VoiceCall:
    scheme, _sep, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token or len(call_id) > 32:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing call credential.")
    try:
        return service.authorize(session, call_id, token)
    except service.VoiceError as e:
        raise _fail(e) from e


Configured = Annotated[Settings, Depends(_same_site)]
DB = Annotated[Session, Depends(get_session)]
Call = Annotated[VoiceCall, Depends(_call)]


def _fail(e: service.VoiceError) -> HTTPException:
    return HTTPException(e.status, e.detail)


@router.post("/calls", status_code=status.HTTP_201_CREATED)
async def start(body: StartCall, request: Request, session: DB, s: Configured) -> dict:
    try:
        return await service.create_call(session, s, ip=_client_ip(request, s), sdp=body.sdp)
    except service.VoiceError as e:
        raise _fail(e) from e


async def _live(session: Session, s: Settings, row: VoiceCall) -> None:
    try:
        await service.ensure_live(session, s, row)
    except service.VoiceError as e:
        raise _fail(e) from e


@router.post("/calls/{call_id}/tools")
async def relay_tools(body: ToolBatch, row: Call, session: DB, s: Configured) -> dict:
    await _live(session, s, row)
    calls = [{"callId": c.call_id, "name": c.name, "arguments": c.arguments} for c in body.calls]
    try:
        return await service.run_tools(session, s, row, calls)
    except service.VoiceError as e:
        raise _fail(e) from e


@router.post("/calls/{call_id}/nudge")
async def nudge(body: Nudge, row: Call, session: DB, s: Configured) -> dict:
    await _live(session, s, row)
    try:
        return await service.nudge(session, s, row, body.kind)
    except service.VoiceError as e:
        raise _fail(e) from e


@router.post("/calls/{call_id}/step")
async def step(body: StepMoved, row: Call, session: DB, s: Configured) -> dict:
    await _live(session, s, row)
    return service.follow_step(session, row, body.guide_id, body.step_index)


@router.post("/calls/{call_id}/heartbeat")
async def heartbeat(row: Call, session: DB, s: Configured) -> dict:
    await _live(session, s, row)
    return service.heartbeat(session, row)


@router.post("/calls/{call_id}/end", status_code=status.HTTP_204_NO_CONTENT)
async def end(row: Call, session: DB, s: Configured, body: EndCall | None = None) -> None:
    await service.end(session, s, row, (body or EndCall()).reason)


@router.api_route("/reap", methods=["GET", "POST"])
async def reap(session: DB, authorization: Annotated[str, Header()] = "") -> JSONResponse:
    """For a scheduler (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; Supabase pg_cron can do the same)."""
    s = get_settings()
    if len(s.cron_secret) < 16 or not service.hmac.compare_digest(authorization, f"Bearer {s.cron_secret}"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized.")
    ended = await service.reap(session, s) if s.voice_configured else 0
    return JSONResponse({"ended": ended}, headers={"Cache-Control": "no-store"})
