"""Facility importer: validate the whole file first, then upsert by id in one transaction."""

import json
from pathlib import Path

from pydantic import TypeAdapter, ValidationError
from sqlmodel import Session

from app.modules.districts import service as districts
from app.modules.facilities import catalog
from app.modules.facilities.models import Facility, FacilityPhone
from app.modules.facilities.schemas import FacilityImport

MAX_BYTES = 5_000_000
MAX_ROWS = 10_000
_adapter = TypeAdapter(list[FacilityImport])


class ImportError_(ValueError):
    pass


def load_file(path: str) -> list[FacilityImport]:
    p = Path(path)
    if p.stat().st_size > MAX_BYTES:
        raise ImportError_("Facility import exceeds 5 MB.")
    try:
        return _adapter.validate_python(json.loads(p.read_text(encoding="utf-8")))
    except ValidationError as exc:  # report only locations, never values
        fields = sorted({".".join(str(x) for x in e["loc"]) for e in exc.errors()})
        raise ImportError_(f"Facility import has invalid fields: {', '.join(fields)}") from None


def import_verified(session: Session, rows: list[FacilityImport]) -> None:
    if not rows or len(rows) > MAX_ROWS:
        raise ImportError_("Facility import must contain 1 to 10000 records.")
    seen: set[str] = set()
    prepared: list[tuple[FacilityImport, str]] = []
    for index, row in enumerate(rows, start=1):
        if row.id in seen:
            raise ImportError_(f"Facility import row {index}: duplicate facility id")
        seen.add(row.id)
        supplied = row.district.strip()
        if supplied.startswith(("Phường ", "Xã ")):
            district = supplied
        else:
            district = districts.canonical(supplied)
            if district is None:
                raise ImportError_(f"Facility import row {index}: district is outside the supported catalog")
        prepared.append((row, district))

    for row, district in prepared:  # single transaction; commit once at the end
        entity = session.get(Facility, row.id)
        if entity is None:
            entity = Facility(
                id=row.id, name="", type=row.type, address="", district="", latitude=0, longitude=0, has_emergency=False
            )
            session.add(entity)
        entity.name, entity.type, entity.address = row.name.strip(), row.type, row.address.strip()
        entity.district, entity.latitude, entity.longitude = district, row.latitude, row.longitude
        entity.has_emergency, entity.verified_at = row.has_emergency, row.verified_at
        entity.verification_source = row.verification_source.strip()
        entity.phones = [
            FacilityPhone(phone_order=i, label=p.label.strip(), number=p.number, is_24h=p.is24h)
            for i, p in enumerate(row.phones)
        ]
    session.commit()
    catalog.invalidate()
