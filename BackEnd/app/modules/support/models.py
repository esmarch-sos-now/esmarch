from datetime import datetime
from enum import StrEnum

from sqlalchemy import ARRAY, Column, String
from sqlmodel import Field, SQLModel

from app.common.columns import tstz


class Skill(StrEnum):
    FIRST_AID = "FIRST_AID"
    CPR = "CPR"
    AED = "AED"
    PEDIATRIC = "PEDIATRIC"


class Responder(SQLModel, table=True):
    __tablename__ = "verified_responders"  # pyrefly: ignore[bad-override]

    id: str = Field(primary_key=True)
    display_name: str = Field(max_length=100)
    contact_phone: str = Field(max_length=30)
    skills: list[str] = Field(sa_column=Column(ARRAY(String(20)), nullable=False))
    verified_at: datetime | None = Field(default=None, sa_column=tstz())
    verification_source: str = Field(max_length=1000)
    token_hash: str = Field(max_length=64, unique=True)


class Presence(SQLModel, table=True):
    """A responder who is available now. Expires by itself (`expires_at`); coordinates never outlive it.

    Readiness needs no GPS: coordinates stay None while waiting, unless the legacy radius API sends them, and are set
    by live updates only while helping (they are wiped again when that request ends)."""

    __tablename__ = "support_presence"  # pyrefly: ignore[bad-override]

    responder_id: str = Field(primary_key=True)
    latitude: float | None = None
    longitude: float | None = None
    expires_at: datetime = Field(sa_column=tstz(nullable=False, index=True))


class SupportRequest(SQLModel, table=True):
    """A request for help. Location, phone number, description and photos are wiped when it ends (see `clear`)."""

    __tablename__ = "support_requests"  # pyrefly: ignore[bad-override]

    id: str = Field(primary_key=True)
    owner_hash: str = Field(max_length=64)
    scenario_id: str | None = Field(default=None, max_length=64)
    audience: str = Field(max_length=20)
    skill: str = Field(max_length=20)
    state: str = Field(max_length=20, index=True)
    expires_at: datetime = Field(sa_column=tstz(nullable=False, index=True))
    radius: int = 0
    latitude: float | None = None
    longitude: float | None = None
    contact_phone: str | None = Field(default=None, max_length=30)
    situation: str | None = Field(default=None, max_length=60)
    description: str | None = Field(default=None, max_length=500)
    accepted_by: str | None = Field(default=None, max_length=36)
    # Approximate incident area (district label): shown to invited responders instead of a distance.
    area: str | None = Field(default=None, max_length=100)
    # Content type of the scene video stored at "<id>/video"; None = no (confirmed) video.
    video_type: str | None = Field(default=None, max_length=20)


class SupportInvite(SQLModel, table=True):
    __tablename__ = "support_invites"  # pyrefly: ignore[bad-override]

    request_id: str = Field(primary_key=True, foreign_key="support_requests.id", ondelete="CASCADE")
    responder_id: str = Field(primary_key=True)
    declined: bool = False


class SupportPhoto(SQLModel, table=True):
    """Metadata only: the image itself sits in private object storage under `path`."""

    __tablename__ = "support_photos"  # pyrefly: ignore[bad-override]

    id: str = Field(primary_key=True)
    request_id: str = Field(foreign_key="support_requests.id", ondelete="CASCADE", index=True)
    position: int
    content_type: str = Field(max_length=20)
    path: str = Field(max_length=200)
