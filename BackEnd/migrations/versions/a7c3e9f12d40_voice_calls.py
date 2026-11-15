"""voice calls: per-call state in Postgres instead of a long-lived WebSocket process

Revision ID: a7c3e9f12d40
Revises: f4b8d20a6c91
Create Date: 2026-11-15 21:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c3e9f12d40"
down_revision: str | Sequence[str] | None = "f4b8d20a6c91"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "voice_calls",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("ip_hash", sa.String(length=64), nullable=False),
        sa.Column("openai_session_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("handoff_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_reason", sa.String(length=20), nullable=True),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("tool_outputs", sa.JSON(), nullable=False),
        sa.Column("tool_posts", sa.Integer(), nullable=False),
        sa.Column("nudges", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_voice_calls_ip_hash"), "voice_calls", ["ip_hash"])
    op.create_index(op.f("ix_voice_calls_created_at"), "voice_calls", ["created_at"])
    op.create_index(op.f("ix_voice_calls_ended_at"), "voice_calls", ["ended_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_voice_calls_ended_at"), table_name="voice_calls")
    op.drop_index(op.f("ix_voice_calls_created_at"), table_name="voice_calls")
    op.drop_index(op.f("ix_voice_calls_ip_hash"), table_name="voice_calls")
    op.drop_table("voice_calls")
