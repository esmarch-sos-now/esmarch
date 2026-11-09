from datetime import datetime

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.common.columns import tstz


class GuideRecord(SQLModel, table=True):
    """Reviewed guide content (one row per scenario/locale/audience). Steps and media are JSONB."""

    __tablename__ = "guides"  # pyrefly: ignore[bad-override]

    id: str = Field(primary_key=True, max_length=60)  # "<scenario>:<locale>:<audience>"
    scenario_id: str = Field(max_length=30, index=True)
    locale: str = Field(max_length=5)
    audience: str = Field(max_length=10)
    title: str = Field(max_length=200)
    steps: list = Field(sa_column=Column(JSONB, nullable=False))
    reviewed_at: datetime | None = Field(default=None, sa_column=tstz())
    reviewed_by: str = Field(max_length=200)
    sources: list = Field(sa_column=Column(JSONB, nullable=False))
