from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlmodel import Session

from app.common.params import Lat, Limit, Lng, Radius
from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import error
from app.modules.auth.deps import CurrentUser, require_auth_configured
from app.modules.guides.schemas import Audience
from app.modules.support.models import Skill
from app.modules.support.schemas import (
    Availability,
    CreateSupportRequest,
    Enrollment,
    LocationUpdate,
    NearbyResponder,
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
def revoke(responder_id: str, session: Db, admin: Admin = None) -> Response:
    support.revoke(session, admin, responder_id)
    return Response(status_code=204)


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
    profile = support.profile_for_user(session, user.id)
    if not body.available:
        return support.go_unavailable(session, profile.id)
    if not body.consent_to_location_use or body.latitude is None or body.longitude is None:
        raise error(400, "Location consent and coordinates are required to become available.")
    return support.go_available(session, profile, body.latitude, body.longitude)


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
