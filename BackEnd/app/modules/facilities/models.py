from datetime import datetime
from enum import StrEnum

from sqlalchemy import Column, Index, String
from sqlmodel import Field, Relationship, SQLModel

from app.common.columns import tstz


class FacilityType(StrEnum):
    HOSPITAL = "HOSPITAL"
    CLINIC = "CLINIC"
    MEDICAL_STATION = "MEDICAL_STATION"


class Facility(SQLModel, table=True):
    __tablename__ = "facilities"  # pyrefly: ignore[bad-override]
    __table_args__ = (Index("idx_facilities_district", "district"),)

    id: str = Field(primary_key=True, max_length=100)
    name: str = Field(max_length=200)
    type: FacilityType = Field(sa_column=Column(String(30), nullable=False))
    address: str = Field(max_length=500)
    district: str = Field(max_length=100)
    latitude: float
    longitude: float
    has_emergency: bool
    verified_at: datetime | None = Field(default=None, sa_column=tstz())
    verification_source: str | None = Field(default=None, max_length=1000)

    phones: list[FacilityPhone] = Relationship(
        back_populates="facility",
        sa_relationship_kwargs={
            "order_by": "FacilityPhone.phone_order",
            "cascade": "all, delete-orphan",
            "lazy": "selectin",
        },
    )


class FacilityPhone(SQLModel, table=True):
    __tablename__ = "facility_phones"  # pyrefly: ignore[bad-override]

    id: int | None = Field(default=None, primary_key=True)
    facility_id: str = Field(foreign_key="facilities.id", max_length=100, index=True)
    phone_order: int
    label: str = Field(max_length=100)
    number: str = Field(max_length=30)
    is_24h: bool

    facility: Facility = Relationship(back_populates="phones")
