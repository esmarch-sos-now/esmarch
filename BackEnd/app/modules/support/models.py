from datetime import datetime
from enum import StrEnum

from sqlalchemy import ARRAY, Column, String, Text
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
    support_areas: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String(100)), nullable=False, server_default="{}")
    )
    ready_for_sos: bool = Field(default=False)
    verified_at: datetime | None = Field(default=None, sa_column=tstz())
    verification_source: str = Field(max_length=1000)
    token_hash: str = Field(max_length=64, unique=True)


class ResponderDevice(SQLModel, table=True):
    __tablename__ = "responder_devices"  # pyrefly: ignore[bad-override]

    token_hash: str = Field(primary_key=True, max_length=64)
    token: str = Field(sa_column=Column(Text, nullable=False))
    responder_id: str = Field(foreign_key="verified_responders.id", index=True, max_length=100)
