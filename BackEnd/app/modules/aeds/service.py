import json
import re
from pathlib import Path

from pydantic import TypeAdapter, ValidationError
from sqlmodel import Session, select

from app.common.checks import location, meters, need, require, reviewed, text
from app.common.checks import nearby as check_nearby
from app.core import clock
from app.core.errors import error
from app.modules.aeds.models import Aed, AedStatus
from app.modules.aeds.schemas import AedImport, AedOut
from app.modules.districts import service as districts

_adapter = TypeAdapter(list[AedImport])


def load_file(session: Session, path: str) -> None:
    p = Path(path)
    require(p.stat().st_size <= 5_000_000, "AED file exceeds 5 MB.")
    try:
        rows = _adapter.validate_python(json.loads(p.read_text(encoding="utf-8")))
    except ValidationError:
        raise error(400, "Invalid AED catalog.") from None
    import_verified(session, rows)


def import_verified(session: Session, rows: list[AedImport]) -> None:
    require(0 < len(rows) <= 10_000, "Invalid AED catalog size.")
    now = clock.now()
    ids: set[str] = set()
    entities: list[Aed] = []
    for row in rows:
        text(row.id, 100, "AED id")
        require(
            bool(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", row.id)) and row.id not in ids,
            "Duplicate or invalid AED id.",
        )
        ids.add(row.id)
        text(row.name, 200, "AED name")
        text(row.address, 500, "AED address")
        district = need(districts.canonical(row.district), "Invalid AED district.")
        latitude = need(row.latitude, "Missing AED fields.")
        longitude = need(row.longitude, "Missing AED fields.")
        is_24h = need(row.is24h, "Missing AED fields.")
        status = need(row.status, "Missing AED fields.")
        location(latitude, longitude)
        require(10.3 <= latitude <= 11.3 and 106.3 <= longitude <= 107.1, "AED is outside the initial service area.")
        text(row.access_instructions, 1000, "access instructions")
        text(row.opening_hours, 200, "opening hours")
        text(row.verification_source, 1000, "verification source")
        require(
            reviewed(row.verified_at, now) and reviewed(row.last_inspected_at, now),
            "AED verification and inspection are required.",
        )
        entities.append(
            Aed(
                id=row.id,
                name=row.name,
                address=row.address,
                district=district,
                latitude=latitude,
                longitude=longitude,
                access_instructions=row.access_instructions,
                opening_hours=row.opening_hours,
                is_24h=is_24h,
                status=status,
                verified_at=row.verified_at,
                last_inspected_at=row.last_inspected_at,
                verification_source=row.verification_source,
            )
        )
    for e in entities:  # one transaction; all-or-nothing
        session.merge(e)
    session.commit()


def operational(session: Session) -> list[Aed]:
    now = clock.now()
    rows = session.exec(select(Aed).where(Aed.status == AedStatus.OPERATIONAL)).all()
    return [a for a in rows if reviewed(a.verified_at, now) and reviewed(a.last_inspected_at, now)]


def find_nearby(session: Session, lat: float, lng: float, radius: int, limit: int) -> list[AedOut]:
    check_nearby(lat, lng, radius, limit)
    out = []
    for a in operational(session):
        d = meters(lat, lng, a.latitude, a.longitude)
        if d <= radius:
            out.append(
                AedOut(
                    id=a.id,
                    name=a.name,
                    address=a.address,
                    district=a.district,
                    latitude=a.latitude,
                    longitude=a.longitude,
                    access_instructions=a.access_instructions,
                    opening_hours=a.opening_hours,
                    is24h=a.is_24h,
                    status=a.status,
                    verified_at=a.verified_at,
                    last_inspected_at=a.last_inspected_at,
                    distance_meters=round(d),
                )
            )
    out.sort(key=lambda a: (a.distance_meters, a.id))
    return out[:limit]
