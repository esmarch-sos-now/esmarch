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
