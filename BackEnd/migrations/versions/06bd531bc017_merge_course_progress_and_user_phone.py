"""merge course progress and user phone

Revision ID: 06bd531bc017
Revises: 4f2c9a71b6d3, c4f1a8d2e7b9
Create Date: 2026-11-14 10:08:33.215052

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "06bd531bc017"
down_revision: str | Sequence[str] | None = ("4f2c9a71b6d3", "c4f1a8d2e7b9")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Join the course-progress and user-phone branches; no schema change."""


def downgrade() -> None:
    """Split the branches again; no schema change."""
