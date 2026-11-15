"""support finder: readiness without GPS, incident area and scene video

Revision ID: d2b6f1a8c3e5
Revises: c8d4e2f7a913
Create Date: 2026-11-16 01:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2b6f1a8c3e5"
down_revision: str | Sequence[str] | None = "c8d4e2f7a913"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("support_presence", "latitude", existing_type=sa.Float(), nullable=True)
    op.alter_column("support_presence", "longitude", existing_type=sa.Float(), nullable=True)
    op.add_column("support_requests", sa.Column("area", sa.String(length=100), nullable=True))
    op.add_column("support_requests", sa.Column("video_type", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("support_requests", "video_type")
    op.drop_column("support_requests", "area")
    op.execute("DELETE FROM support_presence WHERE latitude IS NULL OR longitude IS NULL")
    op.alter_column("support_presence", "longitude", existing_type=sa.Float(), nullable=False)
    op.alter_column("support_presence", "latitude", existing_type=sa.Float(), nullable=False)
