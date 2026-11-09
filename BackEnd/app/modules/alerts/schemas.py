from datetime import datetime
from typing import Annotated

from pydantic import Field

from app.common.schemas import CamelModel


class AlertIn(CamelModel):
    scenario_id: Annotated[str, Field(min_length=1, pattern=r"\S")]
    latitude: Annotated[float, Field(allow_inf_nan=False)]
    longitude: Annotated[float, Field(allow_inf_nan=False)]
    note: str | None = None


class AlertOut(CamelModel):
    id: str
    scenario_id: str
    latitude: float
    longitude: float
    note: str | None
    status: str
    created_at: datetime
