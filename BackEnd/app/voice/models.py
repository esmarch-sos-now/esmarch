from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.common.columns import tstz


class VoiceCall(SQLModel, table=True):
    """One voice call. The audio runs browser <-> OpenAI; this row is all the server remembers between requests.

    `state` (what the caller said about the victim, the open guide) and `tool_outputs` are wiped when the call ends;
    the bare row stays a little longer for the per-IP rate limit, then `reap` deletes it.
    """

    __tablename__ = "voice_calls"  # pyrefly: ignore[bad-override]

    id: str = Field(primary_key=True, max_length=32)
    token_hash: str = Field(max_length=64)
    ip_hash: str = Field(max_length=64, index=True)
    openai_session_id: str | None = Field(default=None, max_length=100)
    created_at: datetime = Field(sa_column=tstz(nullable=False, index=True))
    expires_at: datetime = Field(sa_column=tstz(nullable=False))
    last_seen_at: datetime = Field(sa_column=tstz(nullable=False))
    handoff_at: datetime | None = Field(default=None, sa_column=tstz())
    ended_at: datetime | None = Field(default=None, sa_column=tstz(index=True))
    end_reason: str | None = Field(default=None, max_length=20)
    state: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    tool_outputs: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    tool_posts: int = 0
    nudges: int = 0
