"""course progress and graded quiz tokens

Revision ID: c8d4e2f7a913
Revises: b5d2f8a14c37
Create Date: 2026-11-15 23:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c8d4e2f7a913"
down_revision: str | Sequence[str] | None = "b5d2f8a14c37"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    text = sqlmodel.sql.sqltypes.AutoString
    op.create_table(
        "course_progress",
        sa.Column("id", text(length=100), nullable=False),
        sa.Column("user_id", text(length=36), nullable=False),
        sa.Column("course_id", text(length=60), nullable=False),
        sa.Column("lesson_id", text(length=60), nullable=False),
        sa.Column("quiz_score", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_course_progress_user_id"), "course_progress", ["user_id"], unique=False)
    op.create_table(
        "course_quiz_attempts",
        sa.Column("nonce", text(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("nonce"),
    )
    op.create_index(op.f("ix_course_quiz_attempts_expires_at"), "course_quiz_attempts", ["expires_at"], unique=False)
    # Backend-only tables: keep Supabase's REST API out if this is ever Supabase's own Postgres (see accounts).
    op.execute("ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE course_quiz_attempts ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index(op.f("ix_course_quiz_attempts_expires_at"), table_name="course_quiz_attempts")
    op.drop_table("course_quiz_attempts")
    op.drop_index(op.f("ix_course_progress_user_id"), table_name="course_progress")
    op.drop_table("course_progress")
