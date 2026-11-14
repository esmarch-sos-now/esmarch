"""Store responder area preferences without GPS coordinates."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c42a12ef91ad"
down_revision: str | None = "b7e2c4a91f03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "verified_responders",
        sa.Column("support_areas", sa.ARRAY(sa.String(length=100)), server_default="{}", nullable=False),
    )
    op.alter_column("verified_responders", "support_areas", server_default=None)


def downgrade() -> None:
    op.drop_column("verified_responders", "support_areas")
