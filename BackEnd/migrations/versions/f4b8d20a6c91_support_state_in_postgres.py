"""support presence, requests, invitations and photo metadata move from process memory to Postgres

Revision ID: f4b8d20a6c91
Revises: e3a9c71f5b20
Create Date: 2026-11-15 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4b8d20a6c91"
down_revision: str | Sequence[str] | None = "e3a9c71f5b20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "support_presence",
        sa.Column("responder_id", sa.String(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("responder_id"),
    )
    op.create_index(op.f("ix_support_presence_expires_at"), "support_presence", ["expires_at"])
    op.create_table(
        "support_requests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_hash", sa.String(length=64), nullable=False),
        sa.Column("scenario_id", sa.String(length=64), nullable=True),
        sa.Column("audience", sa.String(length=20), nullable=False),
        sa.Column("skill", sa.String(length=20), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("radius", sa.Integer(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("contact_phone", sa.String(length=30), nullable=True),
        sa.Column("situation", sa.String(length=60), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("accepted_by", sa.String(length=36), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_support_requests_state"), "support_requests", ["state"])
    op.create_index(op.f("ix_support_requests_expires_at"), "support_requests", ["expires_at"])
    op.create_table(
        "support_invites",
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("responder_id", sa.String(), nullable=False),
        sa.Column("declined", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["request_id"], ["support_requests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("request_id", "responder_id"),
    )
    op.create_table(
        "support_photos",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=20), nullable=False),
        sa.Column("path", sa.String(length=200), nullable=False),
        sa.ForeignKeyConstraint(["request_id"], ["support_requests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_support_photos_request_id"), "support_photos", ["request_id"])


def downgrade() -> None:
    op.drop_table("support_photos")
    op.drop_table("support_invites")
    op.drop_table("support_requests")
    op.drop_table("support_presence")
