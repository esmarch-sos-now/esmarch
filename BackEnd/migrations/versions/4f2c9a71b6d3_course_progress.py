"""course progress

Revision ID: 4f2c9a71b6d3
Revises: b7e2c4a91f03
Create Date: 2026-11-12 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4f2c9a71b6d3"
down_revision: str | Sequence[str] | None = "b7e2c4a91f03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "course_progress",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("user_id", sqlmodel.sql.sqltypes.AutoString(length=36), nullable=False),
        sa.Column("course_id", sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
        sa.Column("lesson_id", sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
        sa.Column("quiz_score", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_course_progress_user_id"), "course_progress", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_course_progress_user_id"), table_name="course_progress")
    op.drop_table("course_progress")
