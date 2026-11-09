from datetime import datetime
from enum import StrEnum

from sqlalchemy import Column, String
from sqlmodel import Field, SQLModel

from app.common.columns import tstz


class AedStatus(StrEnum):
    OPERATIONAL = "OPERATIONAL"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"
    UNKNOWN = "UNKNOWN"


class Aed(SQLModel, table=True):
    __tablename__ = "aeds"  # pyrefly: ignore[bad-override]

    id: str = Field(primary_key=True, max_length=100)
    name: str = Field(max_length=200)
    address: str = Field(max_length=500)
    district: str = Field(max_length=100)
    latitude: float
    longitude: float
    access_instructions: str = Field(max_length=1000)
    opening_hours: str = Field(max_length=200)
    is_24h: bool
    status: AedStatus = Field(sa_column=Column(String(30), nullable=False))
    verified_at: datetime | None = Field(default=None, sa_column=tstz())
    last_inspected_at: datetime | None = Field(default=None, sa_column=tstz())
    verification_source: str | None = Field(default=None, max_length=1000)
