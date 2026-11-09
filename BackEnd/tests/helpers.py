from datetime import UTC, datetime

from app.modules.facilities.models import Facility, FacilityPhone, FacilityType


def save_facility(
    session,
    fid,
    lat,
    emergency=True,
    full_time=True,
    verified=datetime(2026, 1, 1, tzinfo=UTC),
    district="Bình Thạnh",
    lng=106.70,
):
    session.add(
        Facility(
            id=fid,
            name=f"Test {fid}",
            type=FacilityType.HOSPITAL if emergency else FacilityType.CLINIC,
            address="Synthetic test address",
            district=district,
            latitude=lat,
            longitude=lng,
            has_emergency=emergency,
            verified_at=verified,
            verification_source="Test fixture only",
            phones=[FacilityPhone(phone_order=0, label="Test only", number="02800000000", is_24h=full_time)],
        )
    )
    session.commit()
    from app.modules.facilities import catalog

    catalog.invalidate()
