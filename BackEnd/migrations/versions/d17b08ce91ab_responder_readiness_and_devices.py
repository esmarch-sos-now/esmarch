"""Persist responder readiness and FCM device registrations."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "d17b08ce91ab"
down_revision: str | None = "c42a12ef91ad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("verified_responders", sa.Column("ready_for_sos", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.alter_column("verified_responders", "ready_for_sos", server_default=None)
    op.create_table(
        "responder_devices",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("responder_id", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(["responder_id"], ["verified_responders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index("ix_responder_devices_responder_id", "responder_devices", ["responder_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_responder_devices_responder_id", table_name="responder_devices")
    op.drop_table("responder_devices")
    op.drop_column("verified_responders", "ready_for_sos")
