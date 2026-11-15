"""users: phone number (verified by an SMS code); email becomes optional

Revision ID: c4f1a8d2e7b9
Revises: b7e2c4a91f03
Create Date: 2026-11-13 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4f1a8d2e7b9"
down_revision: str | Sequence[str] | None = "b7e2c4a91f03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sqlmodel.sql.sqltypes.AutoString(length=16), nullable=True))
    op.add_column("users", sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("users_phone_key", "users", ["phone"])
    op.alter_column("users", "email", existing_type=sqlmodel.sql.sqltypes.AutoString(length=254), nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM users WHERE email IS NULL")
    op.alter_column("users", "email", existing_type=sqlmodel.sql.sqltypes.AutoString(length=254), nullable=False)
    op.drop_constraint("users_phone_key", "users", type_="unique")
    op.drop_column("users", "phone_verified_at")
    op.drop_column("users", "phone")
