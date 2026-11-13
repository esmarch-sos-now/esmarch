"""Phase 3: nearby verified responders and support requests ("Tìm kiếm người hỗ trợ").

Verified profiles live in Postgres; live presence, requests and request photos are RAM-only and single-instance by
design. Every public operation runs under one lock, mirroring the legacy synchronized service.

Responders are reached two ways: the original bearer-token HTTP API (admin-enrolled responders, polling) and
signed-in users (a profile whose id is the user id, see `self_enroll`) over the `/api/support/ws` WebSocket or the
`/api/support/me` HTTP fallback. State changes call `notify(kind, target, message)`, which the WebSocket hub
(`realtime.py`) turns into pushes: kind "responder" targets a responder id, kind "request" targets the requester of a
request id.

Privacy: before accepting, a responder only sees the situation, a short description and a distance rounded to 100 m.
The exact location, the requester's phone number and photos go to the accepting responder only, and are dropped when
the request completes, is cancelled or expires. Once a responder accepts, the requester also sees the courses that
responder has completed (`completedCourses`), the same record shown on the responder's own profile.
"""

import logging
import re
import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any

from sqlmodel import Session, select

from app.common import tokens
from app.common.checks import location, meters, need, require, reviewed, text
from app.common.checks import nearby as check_nearby
from app.core import clock
from app.core.config import get_settings
from app.core.errors import error
from app.modules.auth.models import User
from app.modules.courses.service import course_service
from app.modules.guides.schemas import Audience
from app.modules.guides.service import catalog
from app.modules.support.models import Responder, Skill
from app.modules.support.schemas import (
    Availability,
    CreateSupportRequest,
    Enrollment,
    NearbyResponder,
    SelfEnrollment,
)

log = logging.getLogger(__name__)

PRESENCE_TTL = timedelta(minutes=5)
REQUEST_TTL = timedelta(minutes=10)
_PHONE = r"\+?[0-9]{8,15}"
PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
DEMO_SOURCE = "Demo self-enrolment (SUPPORT_DEMO_SELF_ENROLL); qualification not verified"

Notify = Callable[[str, str, dict[str, Any]], None]


class State(StrEnum):
    OPEN = "OPEN"
    ACCEPTED = "ACCEPTED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


@dataclass
class Presence:
    latitude: float
    longitude: float
    expires_at: datetime


@dataclass
class Photo:
    content_type: str
    data: bytes


@dataclass
class Ticket:
    id: str
    owner_hash: str
    scenario_id: str | None
    audience: Audience
    skill: Skill
    expires_at: datetime
    invited: set[str]
    latitude: float | None
    longitude: float | None
    radius: int = 0
    state: State = State.OPEN
    accepted_by: str | None = None
    contact_phone: str | None = None
    situation: str | None = None
    description: str | None = None
    photos: list[Photo] = field(default_factory=list)
    declined: set[str] = field(default_factory=set)

    def clear_location(self) -> None:
        """Drop everything personal: location, phone number, description and photos."""
        self.latitude = self.longitude = None
        self.contact_phone = self.description = None
        self.photos.clear()
        self.invited.clear()


def _rounded(d: float) -> int:
    return round(d / 100) * 100


def _completed_courses(session: Session, user_id: str) -> list[dict[str, Any]]:
    """Finished courses for profile views ("Đã hoàn thành khóa ..."); camelCase like every dict in this module."""
    return [
        {"id": c.id, "title": c.title, "badge": c.badge, "completedAt": c.completed_at}
        for c in course_service.completed_courses(session, user_id)
    ]


def _phone(value: str | None) -> str:
    phone = re.sub(r"[\s.-]", "", text(value, 30, "contact phone"))
    require(re.fullmatch(_PHONE, phone) is not None, "Invalid contact phone.")
    return phone


@dataclass
class SupportService:
    presence: dict[str, Presence] = field(default_factory=dict)
    requests: dict[str, Ticket] = field(default_factory=dict)
    lock: threading.RLock = field(default_factory=threading.RLock)
    notify: Notify | None = None

    # ---- helpers ------------------------------------------------------------------------------
    def _emit(self, kind: str, target: str, message: dict[str, Any]) -> None:
        if self.notify is None:
            return
        try:
            self.notify(kind, target, message)
        except Exception:
            log.exception("Support notification failed.")

    def _admin(self, credential: str | None) -> None:
        admin = get_settings().support_admin_token
        if len(admin) < 32:
            raise error(503, "Responder administration is not configured.")
        if not tokens.equal(admin, credential):
            raise error(401, "Invalid administrator credential.")

    def _authenticate(self, session: Session, authorization: str | None) -> Responder:
        profile = session.exec(
            select(Responder).where(Responder.token_hash == tokens.bearer_hash(authorization))
        ).first()
        if profile is None:
            raise error(401, "Invalid responder token.")
        if not reviewed(profile.verified_at, clock.now()):
            raise error(403, "Responder qualification is not verified.")
        return profile

    def profile_for_user(self, session: Session, user: User) -> Responder:
        """The responder profile of a signed-in user (its id is the user id)."""
        profile = session.get(Responder, user.id)
        if profile is None:
            raise error(404, "You are not registered as a responder.")
        if not reviewed(profile.verified_at, clock.now()):
            raise error(403, "Responder qualification is not verified.")
        return profile

    def _find(self, request_id: str) -> Ticket:
        ticket = self.requests.get(request_id)
        if ticket is None:
            raise error(404, "Support request not found or expired.")
        return ticket

    def _owned(self, authorization: str | None, request_id: str) -> Ticket:
        digest = tokens.bearer_hash(authorization)
        ticket = self._find(request_id)
        if not tokens.equal(digest, ticket.owner_hash):
            raise error(401, "Invalid requester token.")
        return ticket

    def _eligible(self, profile: Responder, ticket: Ticket) -> bool:
        return ticket.skill.value in profile.skills and (
            ticket.audience == Audience.ADULT or Skill.PEDIATRIC.value in profile.skills
        )

    def _responder_view(self, t: Ticket, live: Presence | None, accepted: bool) -> dict[str, Any]:
        view: dict[str, Any] = {
            "id": t.id,
            "status": t.state,
            "scenarioId": t.scenario_id,
            "audience": t.audience,
            "expiresAt": t.expires_at,
            "situation": t.situation,
            "description": t.description,
            "photoCount": len(t.photos),
        }
        if accepted:
            view["latitude"], view["longitude"] = t.latitude, t.longitude
            view["contactPhone"] = t.contact_phone
        elif live is not None and t.latitude is not None and t.longitude is not None:
            view["approximateDistanceMeters"] = _rounded(meters(live.latitude, live.longitude, t.latitude, t.longitude))
        return view

    def _requester_view(self, session: Session, t: Ticket, responder: Responder | None) -> dict[str, Any]:
        view: dict[str, Any] = {
            "id": t.id,
            "status": t.state,
            "expiresAt": t.expires_at,
            "invitedCount": len(t.invited),
            "photoCount": len(t.photos),
            "dispatchConnected": False,
            "emergencyNumber": "115",
        }
        if t.state == State.ACCEPTED and responder is not None:
            info: dict[str, Any] = {
                "id": responder.id,
                "displayName": responder.display_name,
                "contactPhone": responder.contact_phone,
                "completedCourses": _completed_courses(session, responder.id),
            }
            live = self.presence.get(responder.id)
            if live is not None:
                info["latitude"], info["longitude"] = live.latitude, live.longitude
                if t.latitude is not None and t.longitude is not None:
                    info["distanceMeters"] = round(meters(live.latitude, live.longitude, t.latitude, t.longitude))
            view["responder"] = info
        return view

    def purge(self) -> None:
        with self.lock:
            now = clock.now()
            for k in [k for k, p in self.presence.items() if p.expires_at <= now]:
                del self.presence[k]
            for k in [k for k, t in self.requests.items() if t.expires_at <= now]:
                t = self.requests[k]
                gone = {"type": "request.expired", "requestId": k}
                if t.state in (State.OPEN, State.ACCEPTED):
                    self._emit("request", k, gone)
                    for rid in t.invited | ({t.accepted_by} if t.accepted_by else set()):
                        self._emit("responder", rid, gone)
                t.clear_location()
                del self.requests[k]

    # ---- admin --------------------------------------------------------------------------------
    def enroll(self, session: Session, credential: str | None, e: Enrollment) -> dict:
        with self.lock:
            self._admin(credential)
            display_name = text(e.display_name, 100, "display name")
            phone = text(e.contact_phone, 30, "contact phone")
            require(re.fullmatch(_PHONE, phone) is not None, "Invalid contact phone.")
            skills = need(e.skills or None, "Verified skills are required.")
            require(reviewed(e.verified_at, clock.now()), "Completed qualification verification is required.")
            source = text(e.verification_source, 1000, "qualification verification source")
            if len(session.exec(select(Responder.id)).all()) >= 10_000:
                raise error(503, "Responder catalog capacity reached.")
            rid, token = str(uuid.uuid4()), tokens.issue()
            session.add(
                Responder(
                    id=rid,
                    display_name=display_name,
                    contact_phone=phone,
                    skills=sorted({s.value for s in skills}),
                    verified_at=e.verified_at,
                    verification_source=source,
                    token_hash=tokens.hash_token(token),
                )
            )
            session.commit()
            return {"responderId": rid, "accessToken": token, "tokenType": "Bearer", "showTokenOnce": True}

    def revoke(self, session: Session, credential: str | None, rid: str) -> None:
        with self.lock:
            self._admin(credential)
            self.purge()
            profile = session.get(Responder, rid)
            if profile is None:
                raise error(404, "Responder not found.")
            self.presence.pop(rid, None)
            for t in self.requests.values():
                t.invited.discard(rid)
                if t.accepted_by == rid:
                    t.state = State.CANCELLED
                    t.clear_location()
            session.delete(profile)
            session.commit()

    def rotate(self, session: Session, credential: str | None, rid: str) -> dict:
        with self.lock:
            self._admin(credential)
            profile = session.get(Responder, rid)
            if profile is None:
                raise error(404, "Responder not found.")
            token = tokens.issue()
            profile.token_hash = tokens.hash_token(token)
            session.commit()
            self.presence.pop(rid, None)
            return {"responderId": rid, "accessToken": token, "tokenType": "Bearer", "showTokenOnce": True}

    # ---- signed-in users as responders (demo) --------------------------------------------------
    def self_enroll(self, session: Session, user: User, body: SelfEnrollment) -> dict:
        """Register (or update) the signed-in user as a responder without admin verification. Demo only."""
        with self.lock:
            if not get_settings().support_demo_self_enroll:
                raise error(403, "Self-enrolment is disabled.")
            phone = _phone(body.contact_phone)
            name = (body.display_name or user.display_name or "").strip() or "Người hỗ trợ"
            name = text(name, 100, "display name")
            profile = session.get(Responder, user.id)
            if profile is None:
                profile = Responder(
                    id=user.id,
                    display_name=name,
                    contact_phone=phone,
                    skills=sorted([Skill.FIRST_AID.value, Skill.CPR.value]),
                    verified_at=clock.now(),
                    verification_source=DEMO_SOURCE,
                    token_hash=tokens.hash_token(tokens.issue()),  # unused: this profile signs in with the account
                )
                session.add(profile)
            else:
                profile.display_name, profile.contact_phone = name, phone
            session.commit()
            return self.me(session, user)

    def me(self, session: Session, user: User) -> dict:
        with self.lock:
            profile = session.get(Responder, user.id)
            if profile is None:
                return {"enrolled": False, "selfEnrollEnabled": get_settings().support_demo_self_enroll}
            return {
                "enrolled": True,
                "selfEnrollEnabled": get_settings().support_demo_self_enroll,
                "displayName": profile.display_name,
                "contactPhone": profile.contact_phone,
                "skills": sorted(profile.skills),
                "available": profile.id in self.presence,
                "completedCourses": _completed_courses(session, user.id),
            }

    # ---- responders (shared core: by profile) --------------------------------------------------
    def go_available(self, profile: Responder, lat: float, lng: float) -> dict:
        with self.lock:
            self.purge()
            location(lat, lng)
            if len(self.presence) >= 1000 and profile.id not in self.presence:
                raise error(503, "Live responder capacity reached.")
            expires = clock.now() + PRESENCE_TTL
            live = Presence(lat, lng, expires)
            self.presence[profile.id] = live
            self._invite_to_open(profile, live)
            return {"available": True, "expiresAt": expires, "refreshAfterSeconds": 120}

    def go_unavailable(self, responder_id: str) -> dict:
        with self.lock:
            self.presence.pop(responder_id, None)
            return {"available": False}

    def _invite_to_open(self, profile: Responder, live: Presence) -> None:
        """A responder who becomes available also gets the open requests already waiting within their radius."""
        for t in self.requests.values():
            if t.state != State.OPEN or profile.id in t.invited or profile.id in t.declined:
                continue
            if t.latitude is None or t.longitude is None or not self._eligible(profile, t):
                continue
            if meters(live.latitude, live.longitude, t.latitude, t.longitude) > t.radius:
                continue
            t.invited.add(profile.id)
            self._emit(
                "responder", profile.id, {"type": "request.new", "request": self._responder_view(t, live, False)}
            )
            self._emit("request", t.id, {"type": "request.invited", "invitedCount": len(t.invited)})

    def update_location(self, responder_id: str, lat: float, lng: float) -> None:
        """Live position: refreshes presence and, while helping, moves the responder on the requester's map."""
        with self.lock:
            location(lat, lng)
            live = self.presence.get(responder_id)
            helping = [t for t in self.requests.values() if t.accepted_by == responder_id and t.state == State.ACCEPTED]
            if live is None and not helping:
                return  # not available: a stray update must not make anyone available
            self.presence[responder_id] = Presence(lat, lng, clock.now() + PRESENCE_TTL)
            for t in helping:
                info: dict[str, Any] = {"type": "responder.location", "latitude": lat, "longitude": lng}
                if t.latitude is not None and t.longitude is not None:
                    info["distanceMeters"] = round(meters(lat, lng, t.latitude, t.longitude))
                self._emit("request", t.id, info)

    def requests_for(self, profile: Responder) -> list[dict]:
        with self.lock:
            self.purge()
            live = self.presence.get(profile.id)
            views: list[dict[str, Any]] = []
            for t in sorted(self.requests.values(), key=lambda t: t.id):
                invited_open = profile.id in t.invited and t.state == State.OPEN and live is not None
                mine = t.accepted_by == profile.id and t.state == State.ACCEPTED
                if invited_open or mine:
                    views.append(self._responder_view(t, live, mine))
            return views

    def accept_for(self, session: Session, profile: Responder, request_id: str) -> dict:
        with self.lock:
            self.purge()
            ticket = self._find(request_id)
            if profile.id not in ticket.invited:
                raise error(403, "Responder was not invited.")
            if ticket.state != State.OPEN:
                raise error(409, "Support request is no longer open.")
            if profile.id not in self.presence or not self._eligible(profile, ticket):
                raise error(409, "Responder is not currently eligible.")
            ticket.state, ticket.accepted_by = State.ACCEPTED, profile.id
            accepted = {"type": "request.accepted", "request": self._requester_view(session, ticket, profile)}
            self._emit("request", request_id, accepted)
            for other in ticket.invited - {profile.id}:
                self._emit("responder", other, {"type": "request.taken", "requestId": request_id})
            return {
                **self._responder_view(ticket, self.presence.get(profile.id), True),
                "dispatchConnected": False,
                "emergencyNumber": "115",
            }

    def decline_for(self, responder_id: str, request_id: str) -> None:
        with self.lock:
            ticket = self._find(request_id)
            if ticket.state != State.OPEN or responder_id not in ticket.invited:
                return
            ticket.invited.discard(responder_id)
            ticket.declined.add(responder_id)
            self._emit("request", request_id, {"type": "request.invited", "invitedCount": len(ticket.invited)})

    def complete_for(self, responder_id: str, request_id: str) -> None:
        with self.lock:
            self.purge()
            ticket = self._find(request_id)
            if ticket.accepted_by != responder_id:
                raise error(403, "Only the accepting responder can complete this request.")
            if ticket.state != State.ACCEPTED:
                raise error(409, "Request is not accepted.")
            ticket.state = State.COMPLETED
            ticket.clear_location()
            self._emit("request", request_id, {"type": "request.completed", "requestId": request_id})

    # ---- responders (original bearer-token API) ------------------------------------------------
    def available(self, session: Session, authorization: str | None, a: Availability) -> dict:
        with self.lock:
            self.purge()
            profile = self._authenticate(session, authorization)
            if not a.available:
                return self.go_unavailable(profile.id)
            consent = "Location consent and coordinates are required to become available."
            require(a.consent_to_location_use, consent)
            return self.go_available(profile, need(a.latitude, consent), need(a.longitude, consent))

    def nearby(
        self, session: Session, lat: float, lng: float, radius: int, limit: int, skill: Skill, audience: Audience
    ) -> list[NearbyResponder]:
        with self.lock:
            check_nearby(lat, lng, radius, limit)
            self.purge()
            now = clock.now()
            found: list[tuple[float, Responder]] = []
            for p in session.exec(select(Responder)).all():
                live = self.presence.get(p.id)
                if live is None or not reviewed(p.verified_at, now) or skill.value not in p.skills:
                    continue
                if audience != Audience.ADULT and Skill.PEDIATRIC.value not in p.skills:
                    continue
                d = meters(lat, lng, live.latitude, live.longitude)
                if d <= radius:
                    found.append((d, p))
            found.sort(key=lambda c: (c[0], c[1].id))
            return [
                NearbyResponder(
                    responder_id=p.id,
                    display_name=p.display_name,
                    skills=sorted(p.skills),
                    approximate_distance_meters=_rounded(d),
                )
                for d, p in found[:limit]
            ]

    def inbox(self, session: Session, authorization: str | None) -> list[dict]:
        with self.lock:
            return self.requests_for(self._authenticate(session, authorization))

    def accept(self, session: Session, authorization: str | None, request_id: str) -> dict:
        with self.lock:
            return self.accept_for(session, self._authenticate(session, authorization), request_id)

    def complete(self, session: Session, authorization: str | None, request_id: str) -> None:
        with self.lock:
            self.complete_for(self._authenticate(session, authorization).id, request_id)

    # ---- requesters ---------------------------------------------------------------------------
    def create(self, session: Session, r: CreateSupportRequest) -> dict:
        with self.lock:
            consent = "Explicit consent to share location with the accepting responder is required."
            require(r.share_location_with_accepted_responder, consent)
            lat, lng = need(r.latitude, consent), need(r.longitude, consent)
            audience = r.audience or Audience.ADULT
            if r.scenario_id is not None:
                catalog.get(r.scenario_id, r.locale, audience)
            skill = Skill.CPR if r.scenario_id == "cardiac" else Skill.FIRST_AID
            radius = r.radius or get_settings().support_radius_meters
            check_nearby(lat, lng, radius, 5)
            phone = _phone(r.contact_phone) if r.contact_phone is not None else None
            situation = text(r.situation, 60, "situation") if r.situation else None
            description = text(r.description, 500, "description") if r.description else None
            self.purge()
            candidates = self.nearby(session, lat, lng, radius, 5, skill, audience)
            if not candidates:
                raise error(409, "No verified available responders in the requested radius.")
            if len(self.requests) >= 1000:
                raise error(503, "Support request capacity reached.")
            rid, token = str(uuid.uuid4()), tokens.issue()
            ticket = Ticket(
                rid,
                tokens.hash_token(token),
                r.scenario_id,
                audience,
                skill,
                clock.now() + REQUEST_TTL,
                {c.responder_id for c in candidates},
                lat,
                lng,
                radius=radius,
                contact_phone=phone,
                situation=situation,
                description=description,
            )
            self.requests[rid] = ticket
            for responder_id in ticket.invited:
                view = self._responder_view(ticket, self.presence.get(responder_id), False)
                self._emit("responder", responder_id, {"type": "request.new", "request": view})
            return {
                "id": rid,
                "status": ticket.state,
                "requesterToken": token,
                "expiresAt": ticket.expires_at,
                "invitedCount": len(ticket.invited),
                "delivery": "RESPONDER_PUSH" if self.notify else "RESPONDER_POLLING",
                "dispatchConnected": False,
                "emergencyNumber": "115",
            }

    def state(self, session: Session, authorization: str | None, request_id: str) -> dict:
        with self.lock:
            self.purge()
            return self.requester_state(session, self._owned(authorization, request_id))

    def requester_state(self, session: Session, ticket: Ticket) -> dict:
        with self.lock:
            responder = session.get(Responder, ticket.accepted_by) if ticket.accepted_by else None
            return self._requester_view(session, ticket, responder)

    def owned(self, authorization: str | None, request_id: str) -> Ticket:
        with self.lock:
            self.purge()
            return self._owned(authorization, request_id)

    def cancel(self, authorization: str | None, request_id: str) -> None:
        with self.lock:
            self.purge()
            ticket = self._owned(authorization, request_id)
            if ticket.state == State.COMPLETED:
                raise error(409, "Request is already completed.")
            notified = ticket.invited | ({ticket.accepted_by} if ticket.accepted_by else set())
            ticket.state = State.CANCELLED
            ticket.clear_location()
            for responder_id in notified:
                self._emit("responder", responder_id, {"type": "request.cancelled", "requestId": request_id})

    # ---- photos -------------------------------------------------------------------------------
    def add_photo(self, authorization: str | None, request_id: str, content_type: str | None, data: bytes) -> dict:
        s = get_settings()
        with self.lock:
            self.purge()
            ticket = self._owned(authorization, request_id)
            if ticket.state not in (State.OPEN, State.ACCEPTED):
                raise error(409, "Support request is no longer active.")
            require(content_type in PHOTO_TYPES, "Photos must be JPEG, PNG or WebP.")
            require(0 < len(data) <= s.support_photo_max_bytes, "Photo is empty or too large.")
            if len(ticket.photos) >= s.support_max_photos:
                raise error(409, "Photo limit reached.")
            ticket.photos.append(Photo(str(content_type), data))
            if ticket.state == State.ACCEPTED and ticket.accepted_by:
                view = self._responder_view(ticket, self.presence.get(ticket.accepted_by), True)
                self._emit("responder", ticket.accepted_by, {"type": "request.detail", "request": view})
            return {"photoCount": len(ticket.photos)}

    def photo_for(self, responder_id: str, request_id: str, index: int) -> Photo:
        """Photos are shown to the accepting responder only."""
        with self.lock:
            self.purge()
            ticket = self._find(request_id)
            if ticket.accepted_by != responder_id or ticket.state != State.ACCEPTED:
                raise error(403, "Only the accepting responder can see the photos.")
            if not 0 <= index < len(ticket.photos):
                raise error(404, "Photo not found.")
            return ticket.photos[index]


support = SupportService()
