"""course lesson watch progress

Revision ID: e6c2a9f4b1d8
Revises: b4d8f2a6c1e9
Create Date: 2026-11-17 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e6c2a9f4b1d8"
down_revision: str | Sequence[str] | None = "b4d8f2a6c1e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    text = sqlmodel.sql.sqltypes.AutoString
    op.create_table(
        "course_lesson_watch",
        sa.Column("id", text(length=100), nullable=False),
        sa.Column("user_id", text(length=36), nullable=False),
        sa.Column("lesson_id", text(length=60), nullable=False),
        sa.Column("seconds", sa.Float(), nullable=False),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("watched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_quizzes", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_course_lesson_watch_user_id"), "course_lesson_watch", ["user_id"], unique=False)
    # Backend-only table: keep Supabase's REST API out (see accounts).
    op.execute("ALTER TABLE course_lesson_watch ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index(op.f("ix_course_lesson_watch_user_id"), table_name="course_lesson_watch")
    op.drop_table("course_lesson_watch")
