from datetime import datetime

from pydantic import Field

from app.common.schemas import CamelModel, StrictCamelModel
from app.modules.aeds.models import AedStatus


class AedImport(StrictCamelModel):
    id: str
    name: str
    address: str
    district: str
    latitude: float | None
    longitude: float | None
    access_instructions: str
    opening_hours: str
    is24h: bool | None = Field(alias="is24h")
    status: AedStatus | None
    verified_at: datetime | None
    last_inspected_at: datetime | None
    verification_source: str


class AedOut(CamelModel):
    id: str
    name: str
    address: str
    district: str
    latitude: float
    longitude: float
    access_instructions: str
    opening_hours: str
    is24h: bool = Field(alias="is24h")
    status: AedStatus
    verified_at: datetime | None
    last_inspected_at: datetime | None
    distance_meters: int
