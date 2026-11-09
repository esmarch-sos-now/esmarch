"""Phase 3: nearby verified responders and support requests.

Verified profiles live in Postgres; live presence and requests are RAM-only and single-instance by design.
Every public operation runs under one lock, mirroring the legacy synchronized service.
"""

import threading
import uuid
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
from app.modules.guides.schemas import Audience
from app.modules.guides.service import catalog
from app.modules.support.models import Responder, Skill
from app.modules.support.schemas import Availability, CreateSupportRequest, Enrollment, NearbyResponder

PRESENCE_TTL = timedelta(minutes=5)
REQUEST_TTL = timedelta(minutes=10)
_PHONE = r"\+?[0-9]{8,15}"


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
class Ticket:
    id: str
    owner_hash: str
    scenario_id: str
    audience: Audience
    skill: Skill
    expires_at: datetime
    invited: set[str]
    latitude: float | None
    longitude: float | None
    state: State = State.OPEN
    accepted_by: str | None = None

    def clear_location(self) -> None:
        self.latitude = self.longitude = None
        self.invited.clear()


@dataclass
class SupportService:
    presence: dict[str, Presence] = field(default_factory=dict)
    requests: dict[str, Ticket] = field(default_factory=dict)
    lock: threading.RLock = field(default_factory=threading.RLock)

    # ---- helpers ------------------------------------------------------------------------------
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

    def purge(self) -> None:
        with self.lock:
            now = clock.now()
            for k in [k for k, p in self.presence.items() if p.expires_at <= now]:
                del self.presence[k]
            for k in [k for k, t in self.requests.items() if t.expires_at <= now]:
                self.requests[k].clear_location()
                del self.requests[k]

    # ---- admin --------------------------------------------------------------------------------
    def enroll(self, session: Session, credential: str | None, e: Enrollment) -> dict:
        with self.lock:
            self._admin(credential)
            display_name = text(e.display_name, 100, "display name")
            phone = text(e.contact_phone, 30, "contact phone")
            import re

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

    # ---- responders ---------------------------------------------------------------------------
    def available(self, session: Session, authorization: str | None, a: Availability) -> dict:
        with self.lock:
            self.purge()
            profile = self._authenticate(session, authorization)
            if not a.available:
                self.presence.pop(profile.id, None)
                return {"available": False}
            consent = "Location consent and coordinates are required to become available."
            require(a.consent_to_location_use, consent)
            lat, lng = need(a.latitude, consent), need(a.longitude, consent)
            location(lat, lng)
            if len(self.presence) >= 1000 and profile.id not in self.presence:
                raise error(503, "Live responder capacity reached.")
            expires = clock.now() + PRESENCE_TTL
            self.presence[profile.id] = Presence(lat, lng, expires)
            return {"available": True, "expiresAt": expires, "refreshAfterSeconds": 120}

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
                    approximate_distance_meters=round(d / 100) * 100,
                )
                for d, p in found[:limit]
            ]

    def inbox(self, session: Session, authorization: str | None) -> list[dict]:
        with self.lock:
            self.purge()
            profile = self._authenticate(session, authorization)
            live = self.presence.get(profile.id)
            views: list[dict[str, Any]] = []
            for t in sorted(self.requests.values(), key=lambda t: t.id):
                invited_open = profile.id in t.invited and t.state == State.OPEN and live is not None
                mine = t.accepted_by == profile.id and t.state == State.ACCEPTED
                if not (invited_open or mine):
                    continue
                view: dict[str, Any] = {
                    "id": t.id,
                    "status": t.state,
                    "scenarioId": t.scenario_id,
                    "audience": t.audience,
                    "expiresAt": t.expires_at,
                }
                if t.state == State.ACCEPTED:
                    view["latitude"], view["longitude"] = t.latitude, t.longitude
                elif live is not None and t.latitude is not None and t.longitude is not None:
                    view["approximateDistanceMeters"] = (
                        round(meters(live.latitude, live.longitude, t.latitude, t.longitude) / 100) * 100
                    )
                views.append(view)
            return views

    def accept(self, session: Session, authorization: str | None, request_id: str) -> dict:
        with self.lock:
            self.purge()
            profile = self._authenticate(session, authorization)
            ticket = self._find(request_id)
            if profile.id not in ticket.invited:
                raise error(403, "Responder was not invited.")
            if ticket.state != State.OPEN:
                raise error(409, "Support request is no longer open.")
            if (
                profile.id not in self.presence
                or ticket.skill.value not in profile.skills
                or (ticket.audience != Audience.ADULT and Skill.PEDIATRIC.value not in profile.skills)
            ):
                raise error(409, "Responder is not currently eligible.")
            ticket.state, ticket.accepted_by = State.ACCEPTED, profile.id
            return {
                "id": request_id,
                "status": ticket.state,
                "latitude": ticket.latitude,
                "longitude": ticket.longitude,
                "expiresAt": ticket.expires_at,
                "dispatchConnected": False,
                "emergencyNumber": "115",
            }

    def complete(self, session: Session, authorization: str | None, request_id: str) -> None:
        with self.lock:
            self.purge()
            profile = self._authenticate(session, authorization)
            ticket = self._find(request_id)
            if ticket.accepted_by != profile.id:
                raise error(403, "Only the accepting responder can complete this request.")
            if ticket.state != State.ACCEPTED:
                raise error(409, "Request is not accepted.")
            ticket.state = State.COMPLETED
            ticket.clear_location()

    # ---- requesters ---------------------------------------------------------------------------
    def create(self, session: Session, r: CreateSupportRequest) -> dict:
        with self.lock:
            consent = "Explicit consent to share location with the accepting responder is required."
            require(r.share_location_with_accepted_responder, consent)
            lat, lng = need(r.latitude, consent), need(r.longitude, consent)
            scenario_id = need(r.scenario_id, "Invalid scenario.")
            audience = need(r.audience, "Audience is required.")
            catalog.get(scenario_id, r.locale, audience)
            skill = Skill.CPR if scenario_id == "cardiac" else Skill.FIRST_AID
            check_nearby(lat, lng, r.radius, 5)
            self.purge()
            candidates = self.nearby(session, lat, lng, r.radius, 5, skill, audience)
            if not candidates:
                raise error(409, "No verified available responders in the requested radius.")
            if len(self.requests) >= 1000:
                raise error(503, "Support request capacity reached.")
            rid, token = str(uuid.uuid4()), tokens.issue()
            ticket = Ticket(
                rid,
                tokens.hash_token(token),
                scenario_id,
                audience,
                skill,
                clock.now() + REQUEST_TTL,
                {c.responder_id for c in candidates},
                lat,
                lng,
            )
            self.requests[rid] = ticket
            return {
                "id": rid,
                "status": ticket.state,
                "requesterToken": token,
                "expiresAt": ticket.expires_at,
                "invitedCount": len(ticket.invited),
                "delivery": "RESPONDER_POLLING",
                "dispatchConnected": False,
                "emergencyNumber": "115",
            }

    def state(self, session: Session, authorization: str | None, request_id: str) -> dict:
        with self.lock:
            self.purge()
            ticket = self._owned(authorization, request_id)
            view: dict[str, Any] = {
                "id": request_id,
                "status": ticket.state,
                "expiresAt": ticket.expires_at,
                "dispatchConnected": False,
                "emergencyNumber": "115",
            }
            if ticket.state == State.ACCEPTED and ticket.accepted_by:
                p = session.get(Responder, ticket.accepted_by)
                if p is not None:
                    view["responder"] = {"id": p.id, "displayName": p.display_name, "contactPhone": p.contact_phone}
            return view

    def cancel(self, authorization: str | None, request_id: str) -> None:
        with self.lock:
            self.purge()
            ticket = self._owned(authorization, request_id)
            if ticket.state == State.COMPLETED:
                raise error(409, "Request is already completed.")
            ticket.state = State.CANCELLED
            ticket.clear_location()


support = SupportService()
