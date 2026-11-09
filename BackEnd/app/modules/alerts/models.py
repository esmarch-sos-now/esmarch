import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel

from app.common.columns import tstz


class SosAlert(SQLModel, table=True):
    """Legacy SOS Bump alerts. These store the location, unlike the one-tap SOS flow."""

    __tablename__ = "sos_alert"  # pyrefly: ignore[bad-override]

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    scenario_id: str
    latitude: float
    longitude: float
    note: str | None = None
    status: str = "OPEN"
    created_at: datetime = Field(sa_column=tstz(False))
