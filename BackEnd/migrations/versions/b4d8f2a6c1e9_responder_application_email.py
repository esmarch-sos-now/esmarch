"""responder applications: result email, when it was sent, when the user saw the approval

Revision ID: b4d8f2a6c1e9
Revises: a7c3e9d1f2b4
Create Date: 2026-11-16 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b4d8f2a6c1e9"
down_revision: str | Sequence[str] | None = "a7c3e9d1f2b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("verified_responders", sa.Column("notify_email", sa.String(length=254), nullable=True))
    op.add_column("verified_responders", sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("verified_responders", sa.Column("welcomed_at", sa.DateTime(timezone=True), nullable=True))
    # Responders verified before this change have nothing new to be welcomed to.
    op.execute("UPDATE verified_responders SET welcomed_at = now() WHERE verified_at IS NOT NULL")


def downgrade() -> None:
    op.drop_column("verified_responders", "welcomed_at")
    op.drop_column("verified_responders", "notified_at")
    op.drop_column("verified_responders", "notify_email")
