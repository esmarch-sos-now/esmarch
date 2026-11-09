"""Cached public facility catalogue. User coordinates never enter this cache."""

import threading
import time

from sqlmodel import Session, col, select

from app.core import clock
from app.modules.facilities.models import Facility
from app.modules.facilities.schemas import FacilityOut, PhoneOut

TTL_SECONDS = 30.0
_lock = threading.Lock()
_snapshot: list[FacilityOut] = []
_expires_at = 0.0


def facility_out(f: Facility) -> FacilityOut:
    return FacilityOut(
        id=f.id, name=f.name, type=f.type, address=f.address, district=f.district,
        latitude=f.latitude, longitude=f.longitude, has_emergency=f.has_emergency,
        phones=[PhoneOut(label=p.label, number=p.number, is24h=p.is_24h) for p in f.phones],
        verified_at=f.verified_at,
    )  # fmt: skip


def all_facilities(session: Session) -> list[FacilityOut]:
    global _snapshot, _expires_at
    with _lock:
        if _expires_at == 0.0 or time.monotonic() >= _expires_at:
            rows = session.exec(
                select(Facility)
                .where(col(Facility.verified_at).is_not(None), col(Facility.verified_at) <= clock.now())
                .order_by(Facility.id)
            ).all()
            _snapshot = [facility_out(f) for f in rows]
            _expires_at = time.monotonic() + TTL_SECONDS
        return _snapshot


def invalidate() -> None:
    global _expires_at
    with _lock:
        _expires_at = 0.0
