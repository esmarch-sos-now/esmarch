from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlmodel import Session

from app.common.params import Lat, Limit, Lng, Radius
from app.core.config import get_settings
from app.core.db import get_session
from app.core.ratelimit import client_ip
from app.modules.auth.deps import AdminUser, CurrentUser, OptionalUser, require_auth_configured
from app.modules.guides.schemas import Audience
from app.modules.support import transcribe as speech
from app.modules.support.models import Skill
from app.modules.support.schemas import (
    Availability,
    CreateSupportRequest,
    Enrollment,
    LocationUpdate,
    NearbyResponder,
    ResponderUpdate,
    SelfEnrollment,
)
from app.modules.support.service import support

router = APIRouter(prefix="/api", tags=["support"])
Admin = Annotated[str | None, Header(alias="X-Admin-Token")]
Auth = Annotated[str | None, Header()]
Db = Annotated[Session, Depends(get_session)]


@router.post("/admin/responders", status_code=201)
def enroll(request: Enrollment, session: Db, admin: Admin = None) -> dict:
    return support.enroll(session, admin, request)


@router.delete("/admin/responders/{responder_id}", status_code=204)
def revoke(responder_id: str, session: Db, user: OptionalUser, admin: Admin = None) -> Response:
    """Deletes a responder profile. Allowed with X-Admin-Token or as a signed-in ADMIN account (the admin page)."""
    support.revoke(session, admin, responder_id, user)
    return Response(status_code=204)


@router.get("/admin/responders", dependencies=[Depends(require_auth_configured)])
def admin_responders(session: Db, user: AdminUser) -> list[dict]:
    """All responder profiles with their linked account and on-duty state (admin page)."""
    return support.admin_list(session, user)


@router.patch("/admin/responders/{responder_id}", dependencies=[Depends(require_auth_configured)])
def admin_update_responder(responder_id: str, body: ResponderUpdate, session: Db, user: AdminUser) -> dict:
    """Suspends (`verified: false`) or reinstates a responder, or changes its skills (admin page)."""
    return support.admin_update(session, user, responder_id, body.verified, body.skills)


@router.post("/admin/responders/{responder_id}/rotate-token")
def rotate(responder_id: str, session: Db, admin: Admin = None) -> dict:
    return support.rotate(session, admin, responder_id)


@router.put("/responders/me/availability")
def available(request: Availability, session: Db, authorization: Auth = None) -> dict:
    return support.available(session, authorization, request)


@router.get("/responders/nearby", response_model=list[NearbyResponder])
def nearby(
    lat: Lat,
    lng: Lng,
    session: Db,
    radius: Radius = 5000,
    limit: Limit = 5,
    skill: Skill = Skill.FIRST_AID,
    audience: Audience = Audience.ADULT,
):
    return support.nearby(session, lat, lng, radius, limit, skill, audience)


@router.get("/responders/me/requests")
def inbox(session: Db, authorization: Auth = None) -> list[dict]:
    return support.inbox(session, authorization)


@router.post("/support-requests", status_code=201)
def create(request: CreateSupportRequest, session: Db) -> dict:
    return support.create(session, request)


@router.get("/support-requests/{request_id}")
def state(request_id: str, session: Db, authorization: Auth = None) -> dict:
    return support.state(session, authorization, request_id)


@router.delete("/support-requests/{request_id}", status_code=204)
def cancel(request_id: str, session: Db, authorization: Auth = None) -> Response:
    support.cancel(session, authorization, request_id)
    return Response(status_code=204)


@router.post("/support-requests/{request_id}/accept")
def accept(request_id: str, session: Db, authorization: Auth = None) -> dict:
    return support.accept(session, authorization, request_id)


@router.post("/support-requests/{request_id}/complete", status_code=204)
def complete(request_id: str, session: Db, authorization: Auth = None) -> Response:
    support.complete(session, authorization, request_id)
    return Response(status_code=204)


# ---- request photos ---------------------------------------------------------------------------
@router.post("/support-requests/{request_id}/photos", status_code=201)
async def upload_photo(request_id: str, file: UploadFile, session: Db, authorization: Auth = None) -> dict:
    """The requester attaches up to SUPPORT_MAX_PHOTOS photos (JPEG/PNG/WebP), kept in private storage until it ends."""
    data = await file.read(get_settings().support_photo_max_bytes + 1)
    return await run_in_threadpool(support.add_photo, session, authorization, request_id, file.content_type, data)


@router.post("/support-requests/{request_id}/video-upload")
def video_upload(request_id: str, session: Db, authorization: Auth = None) -> dict:
    """Where the requester uploads its one scene video: `mode: "signed"` = straight to Supabase Storage with the
    returned token (then call `/video/complete`), `mode: "backend"` = POST the file to `/video` (local dev)."""
    return support.video_upload(session, authorization, request_id)


@router.post("/support-requests/{request_id}/video/complete")
def video_complete(request_id: str, session: Db, authorization: Auth = None) -> dict:
    """Checks the uploaded video (MP4/WebM/QuickTime, SUPPORT_VIDEO_MAX_BYTES) and shows it to responders."""
    return support.confirm_video(session, authorization, request_id)


@router.post("/support-requests/{request_id}/video", status_code=201)
async def upload_video(request_id: str, file: UploadFile, session: Db, authorization: Auth = None) -> dict:
    """Backend upload of the video, when Supabase Storage is not configured (local dev)."""
    data = await file.read(get_settings().support_video_max_bytes + 1)
    return await run_in_threadpool(support.add_video, session, authorization, request_id, file.content_type, data)


# ---- voice description -> text ----------------------------------------------------------------
@router.post("/support/transcribe")
async def transcribe(request: Request, file: UploadFile) -> dict:
    """The requester's recorded description as text (OpenAI speech-to-text). Nothing is stored. 503 without
    OPENAI_API_KEY; the form then keeps the recording and asks for typed text."""
    s = get_settings()
    origin = request.headers.get("origin")
    if origin is not None and origin not in s.origins:
        raise HTTPException(403, "Origin not allowed.")
    data = await file.read(s.support_transcribe_max_bytes + 1)
    extension = speech.check(s, client_ip(request, s.client_ip_header), file.content_type, data)
    return {"text": await speech.transcribe(s, extension, file.content_type, data)}


# ---- signed-in users as responders ("Sẵn sàng hỗ trợ") -----------------------------------------
# Realtime is Supabase Broadcast ("changed" signals, see app.core.supabase); every action is plain HTTP.
me = APIRouter(prefix="/api/support", tags=["support"], dependencies=[Depends(require_auth_configured)])


@me.get("/me")
def my_profile(user: CurrentUser, session: Db) -> dict:
    return support.me(session, user)


@me.post("/me")
def self_enroll(body: SelfEnrollment, user: CurrentUser, session: Db) -> dict:
    return support.self_enroll(session, user, body)


@me.put("/me/availability")
def my_availability(body: Availability, user: CurrentUser, session: Db) -> dict:
    """Readiness needs no GPS. Coordinates are only stored with explicit consent (radius requests use them)."""
    profile = support.profile_for_user(session, user.id)
    if not body.available:
        return support.go_unavailable(session, profile.id)
    if body.consent_to_location_use and body.latitude is not None and body.longitude is not None:
        return support.go_available(session, profile, body.latitude, body.longitude)
    return support.go_available(session, profile)


@me.post("/me/location", status_code=204)
def my_location(body: LocationUpdate, user: CurrentUser, session: Db) -> Response:
    support.update_location(session, support.profile_for_user(session, user.id).id, body.latitude, body.longitude)
    return Response(status_code=204)


@me.get("/me/requests")
def my_requests(user: CurrentUser, session: Db) -> list[dict]:
    return support.requests_for(session, support.profile_for_user(session, user.id))


@me.post("/me/requests/{request_id}/accept")
def my_accept(request_id: str, user: CurrentUser, session: Db) -> dict:
    return support.accept_for(session, support.profile_for_user(session, user.id), request_id)


@me.post("/me/requests/{request_id}/decline", status_code=204)
def my_decline(request_id: str, user: CurrentUser, session: Db) -> Response:
    support.decline_for(session, support.profile_for_user(session, user.id).id, request_id)
    return Response(status_code=204)


@me.post("/me/requests/{request_id}/complete", status_code=204)
def my_complete(request_id: str, user: CurrentUser, session: Db) -> Response:
    support.complete_for(session, support.profile_for_user(session, user.id).id, request_id)
    return Response(status_code=204)


@me.get("/me/requests/{request_id}/photos/{index}")
def my_photo(request_id: str, index: int, user: CurrentUser, session: Db) -> Response:
    content_type, data = support.photo_for(session, support.profile_for_user(session, user.id).id, request_id, index)
    return Response(data, media_type=content_type, headers={"Cache-Control": "private, no-store"})


@me.get("/me/requests/{request_id}/video-url")
def my_video_url(request_id: str, user: CurrentUser, session: Db) -> dict:
    """A short-lived Storage link to the scene video, or `url: null` to stream it from `/video` (local dev)."""
    return support.video_for(session, support.profile_for_user(session, user.id).id, request_id)


@me.get("/me/requests/{request_id}/video")
def my_video(request_id: str, user: CurrentUser, session: Db) -> Response:
    content_type, data = support.video_bytes(session, support.profile_for_user(session, user.id).id, request_id)
    return Response(data, media_type=content_type, headers={"Cache-Control": "private, no-store"})
