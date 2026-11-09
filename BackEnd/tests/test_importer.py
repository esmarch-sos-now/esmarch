import pytest
from pydantic import ValidationError

from app.modules.facilities import importer
from app.modules.facilities.models import Facility
from app.modules.facilities.schemas import FacilityImport


def row(**kw):
    base = dict(
        id="ok-one",
        name="A",
        type="HOSPITAL",
        address="x",
        district="Quận 1",
        latitude=10.8,
        longitude=106.7,
        hasEmergency=True,
        phones=[{"label": "l", "number": "115", "is24h": False}],
        verifiedAt="2026-01-01T00:00:00Z",
        verificationSource="src",
    )
    return FacilityImport.model_validate({**base, **kw})


def test_upsert_replaces_phones_and_keeps_absent(session):
    importer.import_verified(session, [row(), row(id="ok-two")])
    importer.import_verified(
        session, [row(name="Renamed", phones=[{"label": "n", "number": "+84123456789", "is24h": True}])]
    )
    session.expire_all()
    one = session.get(Facility, "ok-one")
    assert one.name == "Renamed" and [p.number for p in one.phones] == ["+84123456789"]
    assert session.get(Facility, "ok-two") is not None


def test_invalid_row_writes_nothing(session):
    with pytest.raises(importer.ImportError_):
        importer.import_verified(session, [row(), row(id="bad-two", district="Hà Nội")])
    with pytest.raises(importer.ImportError_):
        importer.import_verified(session, [row(), row()])  # duplicate id
    assert session.get(Facility, "ok-one") is None


@pytest.mark.parametrize(
    "kw",
    [
        {"id": "Bad_ID"},
        {"latitude": 20},
        {"longitude": 100},
        {"phones": []},
        {"phones": [{"label": "l", "number": "12", "is24h": False}]},
        {"unknown": 1},
    ],
)
def test_schema_rejects(kw):
    with pytest.raises(ValidationError):
        row(**kw)


def test_seed_file_is_valid():
    rows = importer.load_file("data/seeds/facilities.json")
    assert len(rows) == 65
