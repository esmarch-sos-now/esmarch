from datetime import datetime
from typing import Annotated

from pydantic import Field

from app.common.schemas import CamelModel, StrictCamelModel
from app.modules.facilities.models import FacilityType


class PhoneOut(CamelModel):
    label: str
    number: str
    is24h: bool = Field(alias="is24h")


class FacilityOut(CamelModel):
    id: str
    name: str
    type: FacilityType
    address: str
    district: str
    latitude: float
    longitude: float
    distance_meters: int | None = None
    distance_method: str | None = None
    has_emergency: bool
    phones: list[PhoneOut]
    verified_at: datetime | None

    @property
    def emergency_priority(self) -> int:
        if not self.has_emergency:
            return 2
        return 0 if any(p.is24h for p in self.phones) else 1


class FacilityPhoneImport(StrictCamelModel):
    label: Annotated[str, Field(min_length=1, max_length=100, pattern=r"\S")]
    number: Annotated[str, Field(pattern=r"^(?:115|\+?[0-9]{8,15})$")]
    is24h: bool = Field(alias="is24h")


class FacilityImport(StrictCamelModel):
    id: Annotated[str, Field(max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    name: Annotated[str, Field(min_length=1, max_length=200, pattern=r"\S")]
    type: FacilityType
    address: Annotated[str, Field(max_length=500)]
    district: Annotated[str, Field(min_length=1, max_length=100, pattern=r"\S")]
    latitude: Annotated[float, Field(ge=10.3, le=11.3, allow_inf_nan=False)]
    longitude: Annotated[float, Field(ge=106.3, le=107.4, allow_inf_nan=False)]
    has_emergency: bool
    phones: Annotated[list[FacilityPhoneImport], Field(min_length=1, max_length=10)]
    verified_at: datetime
    verification_source: Annotated[str, Field(min_length=1, max_length=1000, pattern=r"\S")]
