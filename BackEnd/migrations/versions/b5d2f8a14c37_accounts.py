"""accounts: role and lock of each Supabase user, for the admin page

Revision ID: b5d2f8a14c37
Revises: a7c3e9f12d40
Create Date: 2026-11-15 23:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b5d2f8a14c37"
down_revision: str | Sequence[str] | None = "a7c3e9f12d40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    text = sqlmodel.sql.sqltypes.AutoString
    op.create_table(
        "accounts",
        sa.Column("id", text(length=36), nullable=False),
        sa.Column("phone", text(length=16), nullable=True),
        sa.Column("email", text(length=254), nullable=True),
        sa.Column("display_name", text(length=100), nullable=True),
        sa.Column("role", text(length=10), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_accounts_phone"), "accounts", ["phone"], unique=False)
    op.create_index(op.f("ix_accounts_created_at"), "accounts", ["created_at"], unique=False)
    # Only the backend may touch roles. If this database is ever Supabase's own Postgres, row level security without
    # policies keeps its REST API (anon / authenticated keys) out of the table; the backend's owner role bypasses it.
    op.execute("ALTER TABLE accounts ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index(op.f("ix_accounts_created_at"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_phone"), table_name="accounts")
    op.drop_table("accounts")
