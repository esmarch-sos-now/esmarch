"""drop local auth tables: accounts moved to Supabase Auth

Revision ID: e3a9c71f5b20
Revises: b7e2c4a91f03
Create Date: 2026-11-15 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e3a9c71f5b20"
down_revision: str | Sequence[str] | None = "b7e2c4a91f03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_email_codes_user_id"), table_name="email_codes")
    op.drop_table("email_codes")
    op.drop_index(op.f("ix_refresh_tokens_family_id"), table_name="refresh_tokens")
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_table("users")


def downgrade() -> None:
    # Recreates the empty tables of b7e2c4a91f03; the dropped accounts themselves cannot come back.
    text = sqlmodel.sql.sqltypes.AutoString
    op.create_table(
        "users",
        sa.Column("id", text(length=36), nullable=False),
        sa.Column("email", text(length=254), nullable=False),
        sa.Column("password_hash", text(length=255), nullable=False),
        sa.Column("display_name", text(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", text(length=36), nullable=False),
        sa.Column("user_id", text(length=36), nullable=False),
        sa.Column("family_id", text(length=36), nullable=False),
        sa.Column("token_hash", text(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False)
    op.create_index(op.f("ix_refresh_tokens_family_id"), "refresh_tokens", ["family_id"], unique=False)
    op.create_table(
        "email_codes",
        sa.Column("id", text(length=36), nullable=False),
        sa.Column("user_id", text(length=36), nullable=False),
        sa.Column("purpose", text(length=20), nullable=False),
        sa.Column("code_hash", text(length=64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_codes_user_id"), "email_codes", ["user_id"], unique=False)
