from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response
from sqlmodel import Session

from app.common.params import Lat, Limit, Lng, Radius
from app.core.db import get_session
from app.modules.guides.schemas import Audience
from app.modules.support.models import Skill
from app.modules.support.schemas import Availability, CreateSupportRequest, Enrollment, NearbyResponder
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
