import math

from sqlmodel import Session

from app.common.checks import meters
from app.core.errors import error
from app.modules.districts import service as districts
from app.modules.facilities import catalog
from app.modules.facilities.schemas import FacilityOut


def by_district(session: Session, district: str) -> list[FacilityOut]:
    canonical = districts.canonical(district)
    if canonical is None:
        raise error(400, "Choose a district from /api/districts.")
    rows = [f for f in catalog.all_facilities(session) if f.district == canonical]
    return sorted(rows, key=lambda f: (f.emergency_priority, f.name, f.id))


def nearby(session: Session, lat: float, lng: float, radius: int, limit: int) -> list[FacilityOut]:
    if not (
        math.isfinite(lat)
        and math.isfinite(lng)
        and -90 <= lat <= 90
        and -180 <= lng <= 180
        and 1 <= radius <= 50_000
        and 1 <= limit <= 50
    ):
        raise error(400, "Invalid search parameters: lat [-90,90], lng [-180,180], radius [1,50000], limit [1,50].")
    facilities = catalog.all_facilities(session)
    if not facilities:
        return []
    located = [
        f.model_copy(
            update={
                "distance_meters": round(meters(lat, lng, f.latitude, f.longitude)),
                "distance_method": "STRAIGHT_LINE",
            }
        )
        for f in facilities
    ]

    target = min(3, limit, len(located))
    search = float(radius)
    while True:
        matches = [f for f in located if (f.distance_meters or 0) <= search]
        search *= 2
        if len(matches) >= target:
            break
    matches.sort(key=lambda f: (f.distance_meters or 0, f.emergency_priority, f.id))
    return matches[:limit]
