from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response, UploadFile
from sqlmodel import Session

from app.common.params import Lat, Limit, Lng, Radius
from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import error
from app.modules.auth.deps import AdminUser, CurrentUser, OptionalUser, require_auth_configured
from app.modules.districts import service as districts
from app.modules.guides.schemas import Audience
from app.modules.support.models import Skill
from app.modules.support.realtime import hub
from app.modules.support.schemas import (
    Availability,
    CreateSupportRequest,
    DeviceRegistration,
    Enrollment,
    LocationUpdate,
    NearbyResponder,
    ResponderAreas,
    ResponderUpdate,
    SelfEnrollment,
)
from app.modules.support.service import support

router = APIRouter(prefix="/api", tags=["support"])
Admin = Annotated[str | None, Header(alias="X-Admin-Token")]
Auth = Annotated[str | None, Header()]
Db = Annotated[Session, Depends(get_session)]


@router.get("/support-areas", response_model=list[str])
def support_areas() -> list[str]:
    """The canonical area labels accepted for area-based SOS dispatch."""
    return districts.DISTRICTS


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
def cancel(request_id: str, authorization: Auth = None) -> Response:
    support.cancel(authorization, request_id)
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
async def upload_photo(request_id: str, file: UploadFile, authorization: Auth = None) -> dict:
    """The requester attaches up to SUPPORT_MAX_PHOTOS photos (JPEG/PNG/WebP), kept in RAM until the request ends."""
    data = await file.read(get_settings().support_photo_max_bytes + 1)
    return support.add_photo(authorization, request_id, file.content_type, data)


@router.post("/support-requests/{request_id}/video", status_code=201)
async def upload_video(request_id: str, file: UploadFile, authorization: Auth = None) -> dict:
    """The requester attaches one short video (MP4/WebM/QuickTime), kept in RAM until the request ends."""
    data = await file.read(get_settings().support_video_max_bytes + 1)
    return support.add_video(authorization, request_id, file.content_type, data)


# ---- signed-in users as responders ("Sẵn sàng hỗ trợ") -----------------------------------------
me = APIRouter(prefix="/api/support", tags=["support"], dependencies=[Depends(require_auth_configured)])


@me.get("/me")
def my_profile(user: CurrentUser, session: Db) -> dict:
    return support.me(session, user)


@me.post("/me")
def self_enroll(body: SelfEnrollment, user: CurrentUser, session: Db) -> dict:
    return support.self_enroll(session, user, body)


@me.put("/me/areas")
def my_areas(body: ResponderAreas, user: CurrentUser, session: Db) -> dict:
    return support.set_areas(session, support.profile_for_user(session, user), body.areas)


@me.put("/me/devices")
def register_device(body: DeviceRegistration, user: CurrentUser, session: Db) -> dict:
    return support.register_device(session, support.profile_for_user(session, user), body.token)


@me.delete("/me/devices")
def remove_device(body: DeviceRegistration, user: CurrentUser, session: Db) -> Response:
    support.remove_device(session, support.profile_for_user(session, user), body.token)
    return Response(status_code=204)


@me.post("/ws-ticket")
def ws_ticket(user: CurrentUser, session: Db) -> dict:
    """One-time, 30 s ticket that authenticates the next `/api/support/ws` connection as this responder."""
    support.profile_for_user(session, user)
    return {"ticket": hub.issue_ticket(user.id), "expiresInSeconds": 30}


# HTTP fallback for the WebSocket (polling): the same operations, signed in with the account.
@me.put("/me/availability")
def my_availability(body: Availability, user: CurrentUser, session: Db) -> dict:
    profile = support.profile_for_user(session, user)
    if not body.available:
        return support.go_area_unavailable(session, profile)
    return support.go_area_available(profile, session)


@me.post("/me/location", status_code=204)
def my_location(body: LocationUpdate, user: CurrentUser, session: Db) -> Response:
    support.update_location(support.profile_for_user(session, user).id, body.latitude, body.longitude)
    return Response(status_code=204)


@me.get("/me/requests")
def my_requests(user: CurrentUser, session: Db) -> list[dict]:
    return support.requests_for(support.profile_for_user(session, user))


@me.post("/me/requests/{request_id}/accept")
def my_accept(request_id: str, user: CurrentUser, session: Db) -> dict:
    return support.accept_for(support.profile_for_user(session, user), request_id)


@me.post("/me/requests/{request_id}/decline", status_code=204)
def my_decline(request_id: str, user: CurrentUser, session: Db) -> Response:
    support.decline_for(support.profile_for_user(session, user).id, request_id)
    return Response(status_code=204)


@me.post("/me/requests/{request_id}/complete", status_code=204)
def my_complete(request_id: str, user: CurrentUser, session: Db) -> Response:
    support.complete_for(support.profile_for_user(session, user).id, request_id)
    return Response(status_code=204)


@me.get("/me/requests/{request_id}/photos/{index}")
def my_photo(request_id: str, index: int, user: CurrentUser, session: Db) -> Response:
    photo = support.photo_for(support.profile_for_user(session, user).id, request_id, index)
    return Response(photo.data, media_type=photo.content_type, headers={"Cache-Control": "private, no-store"})


@me.get("/me/requests/{request_id}/video")
def my_video(request_id: str, user: CurrentUser, session: Db) -> Response:
    video = support.video_for(support.profile_for_user(session, user).id, request_id)
    return Response(video.data, media_type=video.content_type, headers={"Cache-Control": "private, no-store"})
