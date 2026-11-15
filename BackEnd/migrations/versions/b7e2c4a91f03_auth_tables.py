"""auth tables: users, refresh tokens, email codes

Revision ID: b7e2c4a91f03
Revises: 9d337082abc6
Create Date: 2026-11-11 17:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7e2c4a91f03"
down_revision: str | Sequence[str] | None = "9d337082abc6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(length=36), nullable=False),
        sa.Column("email", sqlmodel.sql.sqltypes.AutoString(length=254), nullable=False),
        sa.Column("password_hash", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("display_name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(length=36), nullable=False),
        sa.Column("user_id", sqlmodel.sql.sqltypes.AutoString(length=36), nullable=False),
        sa.Column("family_id", sqlmodel.sql.sqltypes.AutoString(length=36), nullable=False),
        sa.Column("token_hash", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
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
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(length=36), nullable=False),
        sa.Column("user_id", sqlmodel.sql.sqltypes.AutoString(length=36), nullable=False),
        sa.Column("purpose", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("code_hash", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_codes_user_id"), "email_codes", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_email_codes_user_id"), table_name="email_codes")
    op.drop_table("email_codes")
    op.drop_index(op.f("ix_refresh_tokens_family_id"), table_name="refresh_tokens")
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
