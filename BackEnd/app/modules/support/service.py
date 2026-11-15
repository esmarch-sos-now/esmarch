"""Phase 3: nearby verified responders and support requests ("Tìm kiếm người hỗ trợ").

Everything lives in Postgres (verified profiles, live presence, requests, invitations and photo metadata) and photos in
private object storage, so any number of stateless instances can serve it. A request's location, phone number,
description and photos are wiped when it completes, is cancelled or expires; expired rows are purged on each call.

Responders are reached two ways: the original bearer-token HTTP API (admin-enrolled, polling) and signed-in
users (a profile whose id is the user id, see `self_enroll`) over `/api/support/me*`. A state change queues a "something
changed" signal (`_signal`) that is sent through Supabase Realtime once the HTTP request is done (`app.core.db`).
Signals carry no personal data: clients refetch over authenticated HTTP.

Privacy: before accepting, a responder only sees the situation, a short description and a distance rounded to 100 m.
The exact location, the requester's phone number and photos go to the accepting responder only.
"""

import logging
import re
import uuid
from datetime import timedelta
from enum import StrEnum
from typing import Any

from sqlalchemy import delete, func, update
from sqlmodel import Session, col, select

from app.common import tokens
from app.common.checks import location, meters, need, require, reviewed, text
from app.common.checks import nearby as check_nearby
from app.core import clock
from app.core.config import get_settings
from app.core.errors import error
from app.core.supabase import get_storage
from app.modules.auth.models import Account
from app.modules.auth.security import AuthUser
from app.modules.guides.schemas import Audience
from app.modules.guides.service import catalog
from app.modules.support.models import Presence, Responder, Skill, SupportInvite, SupportPhoto, SupportRequest
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
ADMIN_SOURCE = "Reinstated by an administrator on the admin page"
MAX_PRESENCE = 1000
MAX_REQUESTS = 1000


class State(StrEnum):
    OPEN = "OPEN"
    ACCEPTED = "ACCEPTED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


def _rounded(d: float) -> int:
    return round(d / 100) * 100


def _phone(value: str | None) -> str:
    phone = re.sub(r"[\s.-]", "", text(value, 30, "contact phone"))
    require(re.fullmatch(_PHONE, phone) is not None, "Invalid contact phone.")
    return phone


def _signal(session: Session, kind: str, target: str, message: dict[str, Any]) -> None:
    """Queue a "changed" signal for `support:<kind>:<target>`; `get_session` sends it after the request."""
    session.info.setdefault("signals", []).append((f"support:{kind}:{target}", {"type": message["type"]}))


def _count(session: Session, column) -> int:
    return session.exec(select(func.count()).select_from(column.class_)).one()


class SupportService:
    # ---- helpers ------------------------------------------------------------------------------
    def _admin(self, credential: str | None, user: AuthUser | None = None) -> None:
        """Responder administration: a signed-in ADMIN account (role read from the database by `auth.deps`), or the
        shared X-Admin-Token for scripts."""
        if user is not None and user.is_admin:
            return
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

    def profile_for_user(self, session: Session, user_id: str) -> Responder:
        """The responder profile of a signed-in user (its id is the user id)."""
        profile = session.get(Responder, user_id)
        if profile is None:
            raise error(404, "You are not registered as a responder.")
        if not reviewed(profile.verified_at, clock.now()):
            raise error(403, "Responder qualification is not verified.")
        return profile

    def _find(self, session: Session, request_id: str) -> SupportRequest:
        ticket = session.get(SupportRequest, request_id)
        if ticket is None:
            raise error(404, "Support request not found or expired.")
        return ticket

    def _owned(self, session: Session, authorization: str | None, request_id: str) -> SupportRequest:
        digest = tokens.bearer_hash(authorization)
        ticket = self._find(session, request_id)
        if not tokens.equal(digest, ticket.owner_hash):
            raise error(401, "Invalid requester token.")
        return ticket

    def _presence(self, session: Session, responder_id: str) -> Presence | None:
        live = session.get(Presence, responder_id)
        return live if live is not None and live.expires_at > clock.now() else None

    def _invited(self, session: Session, request_id: str) -> set[str]:
        rows = session.exec(
            select(SupportInvite.responder_id).where(
                SupportInvite.request_id == request_id, col(SupportInvite.declined).is_(False)
            )
        ).all()
        return set(rows)

    def _photo_count(self, session: Session, request_id: str) -> int:
        query = select(func.count()).select_from(SupportPhoto).where(SupportPhoto.request_id == request_id)
        return session.exec(query).one()

    def _eligible(self, profile: Responder, ticket: SupportRequest) -> bool:
        return ticket.skill in profile.skills and (
            ticket.audience == Audience.ADULT or Skill.PEDIATRIC.value in profile.skills
        )

    def _responder_view(self, session: Session, t: SupportRequest, live: Presence | None, accepted: bool) -> dict:
        view: dict[str, Any] = {
            "id": t.id,
            "status": t.state,
            "scenarioId": t.scenario_id,
            "audience": t.audience,
            "expiresAt": t.expires_at,
            "situation": t.situation,
            "description": t.description,
            "photoCount": self._photo_count(session, t.id),
        }
        if accepted:
            view["latitude"], view["longitude"] = t.latitude, t.longitude
            view["contactPhone"] = t.contact_phone
        elif live is not None and t.latitude is not None and t.longitude is not None:
            view["approximateDistanceMeters"] = _rounded(meters(live.latitude, live.longitude, t.latitude, t.longitude))
        return view

    def _requester_view(self, session: Session, t: SupportRequest, responder: Responder | None) -> dict[str, Any]:
        view: dict[str, Any] = {
            "id": t.id,
            "status": t.state,
            "expiresAt": t.expires_at,
            "invitedCount": len(self._invited(session, t.id)),
            "photoCount": self._photo_count(session, t.id),
            "dispatchConnected": False,
            "emergencyNumber": "115",
        }
        if t.state == State.ACCEPTED and responder is not None:
            info: dict[str, Any] = {
                "id": responder.id,
                "displayName": responder.display_name,
                "contactPhone": responder.contact_phone,
            }
            live = self._presence(session, responder.id)
            if live is not None:
                info["latitude"], info["longitude"] = live.latitude, live.longitude
                if t.latitude is not None and t.longitude is not None:
                    info["distanceMeters"] = round(meters(live.latitude, live.longitude, t.latitude, t.longitude))
            view["responder"] = info
        return view

    def _clear(self, session: Session, t: SupportRequest) -> None:
        """Drop everything personal: location, phone number, description, photos and invitations."""
        t.latitude = t.longitude = t.contact_phone = t.description = None
        paths = [p.path for p in session.exec(select(SupportPhoto).where(SupportPhoto.request_id == t.id)).all()]
        session.exec(delete(SupportPhoto).where(col(SupportPhoto.request_id) == t.id))
        session.exec(delete(SupportInvite).where(col(SupportInvite.request_id) == t.id))
        session.add(t)
        try:
            get_storage().delete(paths)
        except Exception:
            log.warning("could not delete %d request photo(s) from storage", len(paths), exc_info=True)

    def purge(self, session: Session) -> None:
        """Remove expired presence and requests (their data is wiped first). Cheap, run at the start of each call."""
        now = clock.now()
        session.exec(delete(Presence).where(col(Presence.expires_at) <= now))
        for t in session.exec(select(SupportRequest).where(SupportRequest.expires_at <= now)).all():
            if t.state in (State.OPEN, State.ACCEPTED):
                gone = {"type": "request.expired", "requestId": t.id}
                _signal(session, "request", t.id, gone)
                invited = set(session.exec(select(SupportInvite.responder_id).where(SupportInvite.request_id == t.id)))
                for rid in invited | ({t.accepted_by} if t.accepted_by else set()):
                    _signal(session, "responder", rid, gone)
            self._clear(session, t)
            session.delete(t)
        session.commit()

    # ---- admin --------------------------------------------------------------------------------
    def enroll(self, session: Session, credential: str | None, e: Enrollment) -> dict:
        self._admin(credential)
        display_name = text(e.display_name, 100, "display name")
        phone = text(e.contact_phone, 30, "contact phone")
        require(re.fullmatch(_PHONE, phone) is not None, "Invalid contact phone.")
        skills = need(e.skills or None, "Verified skills are required.")
        require(reviewed(e.verified_at, clock.now()), "Completed qualification verification is required.")
        source = text(e.verification_source, 1000, "qualification verification source")
        if _count(session, Responder.id) >= 10_000:
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

    def withdraw(self, session: Session, rid: str) -> None:
        """Takes a responder off duty now: no presence, no invitations, and a request it accepted is cancelled (its
        personal data wiped). The caller commits."""
        session.exec(delete(Presence).where(col(Presence.responder_id) == rid))
        session.exec(delete(SupportInvite).where(col(SupportInvite.responder_id) == rid))
        accepted = select(SupportRequest).where(
            SupportRequest.accepted_by == rid, SupportRequest.state == State.ACCEPTED
        )
        for t in session.exec(accepted).all():
            t.state = State.CANCELLED
            self._clear(session, t)
            _signal(session, "request", t.id, {"type": "request.cancelled", "requestId": t.id})
        _signal(session, "responder", rid, {"type": "request.cancelled"})

    def revoke(self, session: Session, credential: str | None, rid: str, user: AuthUser | None = None) -> None:
        """Deletes a responder profile. Allowed with X-Admin-Token or as a signed-in ADMIN account (the admin page)."""
        self._admin(credential, user)
        self.purge(session)
        profile = session.get(Responder, rid)
        if profile is None:
            raise error(404, "Responder not found.")
        self.withdraw(session, rid)
        session.delete(profile)
        session.commit()

    def _admin_view(self, profile: Responder, account: Account | None, online: bool) -> dict[str, Any]:
        return {
            "id": profile.id,
            "displayName": profile.display_name,
            "contactPhone": profile.contact_phone,
            "skills": sorted(profile.skills),
            "verified": reviewed(profile.verified_at, clock.now()),
            "verifiedAt": profile.verified_at,
            "verificationSource": profile.verification_source,
            "online": online,
            # Self-enrolled responders share their id with the account; admin-enrolled ones have no account.
            "account": None
            if account is None
            else {
                "id": account.id,
                "phone": account.phone,
                "email": account.email,
                "displayName": account.display_name,
            },
        }

    def admin_list(self, session: Session, user: AuthUser) -> list[dict[str, Any]]:
        """Every responder profile for the admin page, with its linked account and whether it is on duty."""
        self._admin(None, user)
        self.purge(session)
        profiles = session.exec(select(Responder).order_by(col(Responder.display_name))).all()
        ids = [p.id for p in profiles]
        if not ids:
            return []
        accounts = {a.id: a for a in session.exec(select(Account).where(col(Account.id).in_(ids))).all()}
        online = set(session.exec(select(Presence.responder_id).where(col(Presence.responder_id).in_(ids))).all())
        return [self._admin_view(p, accounts.get(p.id), p.id in online) for p in profiles]

    def admin_update(
        self, session: Session, user: AuthUser, rid: str, verified: bool | None, skills: list[Skill] | None
    ) -> dict[str, Any]:
        """Suspends (verified=False) or reinstates a responder, or changes its skills."""
        self._admin(None, user)
        profile = session.get(Responder, rid)
        if profile is None:
            raise error(404, "Responder not found.")
        if skills is not None:
            profile.skills = sorted({s.value for s in need(skills or None, "Verified skills are required.")})
        if verified is False:
            profile.verified_at = None
            self.withdraw(session, rid)
        elif verified and not reviewed(profile.verified_at, clock.now()):
            profile.verified_at = clock.now()
            if profile.verification_source == DEMO_SOURCE:
                profile.verification_source = ADMIN_SOURCE
        session.commit()
        return self._admin_view(profile, session.get(Account, rid), self._presence(session, rid) is not None)

    def rotate(self, session: Session, credential: str | None, rid: str) -> dict:
        self._admin(credential)
        profile = session.get(Responder, rid)
        if profile is None:
            raise error(404, "Responder not found.")
        token = tokens.issue()
        profile.token_hash = tokens.hash_token(token)
        session.exec(delete(Presence).where(col(Presence.responder_id) == rid))
        session.commit()
        return {"responderId": rid, "accessToken": token, "tokenType": "Bearer", "showTokenOnce": True}

    # ---- signed-in users as responders (demo) --------------------------------------------------
    def self_enroll(self, session: Session, user: AuthUser, body: SelfEnrollment) -> dict:
        """Register (or update) the signed-in user as a responder without admin verification. Demo only."""
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

    def me(self, session: Session, user: AuthUser) -> dict:
        profile = session.get(Responder, user.id)
        if profile is None:
            return {"enrolled": False, "selfEnrollEnabled": get_settings().support_demo_self_enroll}
        return {
            "enrolled": True,
            "selfEnrollEnabled": get_settings().support_demo_self_enroll,
            "displayName": profile.display_name,
            "contactPhone": profile.contact_phone,
            "skills": sorted(profile.skills),
            "available": self._presence(session, profile.id) is not None,
        }

    # ---- responders (shared core: by profile) --------------------------------------------------
    def go_available(self, session: Session, profile: Responder, lat: float, lng: float) -> dict:
        self.purge(session)
        location(lat, lng)
        if session.get(Presence, profile.id) is None and _count(session, Presence.responder_id) >= MAX_PRESENCE:
            raise error(503, "Live responder capacity reached.")
        expires = clock.now() + PRESENCE_TTL
        live = Presence(responder_id=profile.id, latitude=lat, longitude=lng, expires_at=expires)
        session.merge(live)
        session.commit()
        self._invite_to_open(session, profile, live)
        session.commit()
        return {"available": True, "expiresAt": expires, "refreshAfterSeconds": 120}

    def go_unavailable(self, session: Session, responder_id: str) -> dict:
        session.exec(delete(Presence).where(col(Presence.responder_id) == responder_id))
        session.commit()
        return {"available": False}

    def _invite_to_open(self, session: Session, profile: Responder, live: Presence) -> None:
        """A responder who becomes available also gets the open requests already waiting within their radius."""
        known = set(session.exec(select(SupportInvite.request_id).where(SupportInvite.responder_id == profile.id)))
        for t in session.exec(select(SupportRequest).where(SupportRequest.state == State.OPEN)).all():
            if t.id in known or t.latitude is None or t.longitude is None or not self._eligible(profile, t):
                continue
            if meters(live.latitude, live.longitude, t.latitude, t.longitude) > t.radius:
                continue
            session.add(SupportInvite(request_id=t.id, responder_id=profile.id))
            _signal(session, "responder", profile.id, {"type": "request.new"})
            _signal(session, "request", t.id, {"type": "request.invited"})

    def update_location(self, session: Session, responder_id: str, lat: float, lng: float) -> None:
        """Live position: refreshes presence and, while helping, moves the responder on the requester's map."""
        location(lat, lng)
        live = self._presence(session, responder_id)
        helping = session.exec(
            select(SupportRequest).where(
                SupportRequest.accepted_by == responder_id, SupportRequest.state == State.ACCEPTED
            )
        ).all()
        if live is None and not helping:
            return  # not available: a stray update must not make anyone available
        session.merge(
            Presence(responder_id=responder_id, latitude=lat, longitude=lng, expires_at=clock.now() + PRESENCE_TTL)
        )
        session.commit()
        for t in helping:
            _signal(session, "request", t.id, {"type": "responder.location"})

    def requests_for(self, session: Session, profile: Responder) -> list[dict]:
        self.purge(session)
        live = self._presence(session, profile.id)
        rows: list[tuple[SupportRequest, bool]] = [
            (t, True)
            for t in session.exec(
                select(SupportRequest).where(
                    SupportRequest.accepted_by == profile.id, SupportRequest.state == State.ACCEPTED
                )
            ).all()
        ]
        if live is not None:
            invited = session.exec(
                select(SupportRequest)
                .join(SupportInvite, col(SupportInvite.request_id) == col(SupportRequest.id))
                .where(
                    SupportInvite.responder_id == profile.id,
                    col(SupportInvite.declined).is_(False),
                    SupportRequest.state == State.OPEN,
                )
            ).all()
            rows.extend((t, False) for t in invited)
        rows.sort(key=lambda row: row[0].id)
        return [self._responder_view(session, t, live, accepted) for t, accepted in rows]

    def accept_for(self, session: Session, profile: Responder, request_id: str) -> dict:
        self.purge(session)
        ticket = self._find(session, request_id)
        invite = session.get(SupportInvite, (request_id, profile.id))
        if invite is None or invite.declined:
            raise error(403, "Responder was not invited.")
        if ticket.state != State.OPEN:
            raise error(409, "Support request is no longer open.")
        live = self._presence(session, profile.id)
        if live is None or not self._eligible(profile, ticket):
            raise error(409, "Responder is not currently eligible.")
        # One conditional UPDATE decides a race between responders: only the first sees a row change.
        won = session.execute(
            update(SupportRequest)
            .where(col(SupportRequest.id) == request_id, col(SupportRequest.state) == State.OPEN)
            .values(state=State.ACCEPTED, accepted_by=profile.id)
        )
        if won.rowcount != 1:  # type: ignore[attr-defined]
            session.rollback()
            raise error(409, "Support request is no longer open.")
        session.commit()
        session.refresh(ticket)
        _signal(session, "request", request_id, {"type": "request.accepted"})
        for other in self._invited(session, request_id) - {profile.id}:
            _signal(session, "responder", other, {"type": "request.taken"})
        return {
            **self._responder_view(session, ticket, live, True),
            "dispatchConnected": False,
            "emergencyNumber": "115",
        }

    def decline_for(self, session: Session, responder_id: str, request_id: str) -> None:
        ticket = self._find(session, request_id)
        invite = session.get(SupportInvite, (request_id, responder_id))
        if ticket.state != State.OPEN or invite is None or invite.declined:
            return
        invite.declined = True
        session.add(invite)
        session.commit()
        _signal(session, "request", request_id, {"type": "request.invited"})

    def complete_for(self, session: Session, responder_id: str, request_id: str) -> None:
        self.purge(session)
        ticket = self._find(session, request_id)
        if ticket.accepted_by != responder_id:
            raise error(403, "Only the accepting responder can complete this request.")
        if ticket.state != State.ACCEPTED:
            raise error(409, "Request is not accepted.")
        ticket.state = State.COMPLETED
        self._clear(session, ticket)
        session.commit()
        _signal(session, "request", request_id, {"type": "request.completed"})

    # ---- responders (original bearer-token API) ------------------------------------------------
    def available(self, session: Session, authorization: str | None, a: Availability) -> dict:
        profile = self._authenticate(session, authorization)
        if not a.available:
            return self.go_unavailable(session, profile.id)
        consent = "Location consent and coordinates are required to become available."
        require(a.consent_to_location_use, consent)
        return self.go_available(session, profile, need(a.latitude, consent), need(a.longitude, consent))

    def nearby(
        self, session: Session, lat: float, lng: float, radius: int, limit: int, skill: Skill, audience: Audience
    ) -> list[NearbyResponder]:
        check_nearby(lat, lng, radius, limit)
        self.purge(session)
        now = clock.now()
        found: list[tuple[float, Responder]] = []
        rows = session.exec(
            select(Responder, Presence).join(Presence, col(Presence.responder_id) == col(Responder.id))
        ).all()
        for p, live in rows:
            if live.expires_at <= now or not reviewed(p.verified_at, now) or skill.value not in p.skills:
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
        return self.requests_for(session, self._authenticate(session, authorization))

    def accept(self, session: Session, authorization: str | None, request_id: str) -> dict:
        return self.accept_for(session, self._authenticate(session, authorization), request_id)

    def complete(self, session: Session, authorization: str | None, request_id: str) -> None:
        self.complete_for(session, self._authenticate(session, authorization).id, request_id)

    # ---- requesters ---------------------------------------------------------------------------
    def create(self, session: Session, r: CreateSupportRequest) -> dict:
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
        self.purge(session)
        candidates = self.nearby(session, lat, lng, radius, 5, skill, audience)
        if not candidates:
            raise error(409, "No verified available responders in the requested radius.")
        if _count(session, SupportRequest.id) >= MAX_REQUESTS:
            raise error(503, "Support request capacity reached.")
        rid, token = str(uuid.uuid4()), tokens.issue()
        ticket = SupportRequest(
            id=rid,
            owner_hash=tokens.hash_token(token),
            scenario_id=r.scenario_id,
            audience=audience.value,
            skill=skill.value,
            state=State.OPEN,
            expires_at=clock.now() + REQUEST_TTL,
            radius=radius,
            latitude=lat,
            longitude=lng,
            contact_phone=phone,
            situation=situation,
            description=description,
        )
        session.add(ticket)
        session.flush()
        for c in candidates:
            session.add(SupportInvite(request_id=rid, responder_id=c.responder_id))
        session.commit()
        for c in candidates:
            _signal(session, "responder", c.responder_id, {"type": "request.new"})
        return {
            "id": rid,
            "status": ticket.state,
            "requesterToken": token,
            "expiresAt": ticket.expires_at,
            "invitedCount": len(candidates),
            "delivery": "RESPONDER_PUSH" if get_settings().realtime_configured else "RESPONDER_POLLING",
            "dispatchConnected": False,
            "emergencyNumber": "115",
        }

    def state(self, session: Session, authorization: str | None, request_id: str) -> dict:
        self.purge(session)
        return self.requester_state(session, self._owned(session, authorization, request_id))

    def requester_state(self, session: Session, ticket: SupportRequest) -> dict:
        responder = session.get(Responder, ticket.accepted_by) if ticket.accepted_by else None
        return self._requester_view(session, ticket, responder)

    def cancel(self, session: Session, authorization: str | None, request_id: str) -> None:
        self.purge(session)
        ticket = self._owned(session, authorization, request_id)
        if ticket.state == State.COMPLETED:
            raise error(409, "Request is already completed.")
        notified = set(session.exec(select(SupportInvite.responder_id).where(SupportInvite.request_id == request_id)))
        if ticket.accepted_by:
            notified.add(ticket.accepted_by)
        ticket.state = State.CANCELLED
        self._clear(session, ticket)
        session.commit()
        for responder_id in notified:
            _signal(session, "responder", responder_id, {"type": "request.cancelled"})

    # ---- photos -------------------------------------------------------------------------------
    def add_photo(
        self, session: Session, authorization: str | None, request_id: str, content_type: str | None, data: bytes
    ) -> dict:
        s = get_settings()
        self.purge(session)
        ticket = self._owned(session, authorization, request_id)
        if ticket.state not in (State.OPEN, State.ACCEPTED):
            raise error(409, "Support request is no longer active.")
        require(content_type in PHOTO_TYPES, "Photos must be JPEG, PNG or WebP.")
        require(0 < len(data) <= s.support_photo_max_bytes, "Photo is empty or too large.")
        count = self._photo_count(session, request_id)
        if count >= s.support_max_photos:
            raise error(409, "Photo limit reached.")
        photo_id = str(uuid.uuid4())
        path = f"{request_id}/{photo_id}"
        get_storage().put(path, data, str(content_type))
        session.add(
            SupportPhoto(id=photo_id, request_id=request_id, position=count, content_type=str(content_type), path=path)
        )
        session.commit()
        if ticket.state == State.ACCEPTED and ticket.accepted_by:
            _signal(session, "responder", ticket.accepted_by, {"type": "request.detail"})
        return {"photoCount": count + 1}

    def photo_for(self, session: Session, responder_id: str, request_id: str, index: int) -> tuple[str, bytes]:
        """Photos are shown to the accepting responder only."""
        self.purge(session)
        ticket = self._find(session, request_id)
        if ticket.accepted_by != responder_id or ticket.state != State.ACCEPTED:
            raise error(403, "Only the accepting responder can see the photos.")
        photo = session.exec(
            select(SupportPhoto).where(SupportPhoto.request_id == request_id, SupportPhoto.position == index)
        ).first()
        if photo is None:
            raise error(404, "Photo not found.")
        return photo.content_type, get_storage().get(photo.path)


support = SupportService()
