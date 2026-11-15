"""users: role (USER or ADMIN) for the admin page

Revision ID: d8a3e5f1c2b6
Revises: c4f1a8d2e7b9
Create Date: 2026-11-13 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8a3e5f1c2b6"
down_revision: str | Sequence[str] | None = "c4f1a8d2e7b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sqlmodel.sql.sqltypes.AutoString(length=10), nullable=False, server_default="USER"),
    )


def downgrade() -> None:
    op.drop_column("users", "role")
