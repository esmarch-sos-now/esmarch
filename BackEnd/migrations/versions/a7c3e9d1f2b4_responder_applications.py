"""responders apply after the courses: application and suspension dates

Signed-in users now become responders by finishing the courses, applying and being verified by an admin. Until now
"waiting" and "suspended" were both `verified_at IS NULL`; they get their own columns. Existing rows:

- unverified rows were suspended by an admin: they keep that state (`suspended_at`);
- demo self-enrolments (verified with no check at all) lose their verification and count as not applied yet, so
  their users go through the courses like everyone else. Rows an admin reinstated keep their verification.

Revision ID: a7c3e9d1f2b4
Revises: d2b6f1a8c3e5
Create Date: 2026-11-16 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c3e9d1f2b4"
down_revision: str | Sequence[str] | None = "d2b6f1a8c3e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEMO_SOURCE = "Demo self-enrolment (SUPPORT_DEMO_SELF_ENROLL); qualification not verified"


def upgrade() -> None:
    op.add_column("verified_responders", sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("verified_responders", sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE verified_responders SET suspended_at = now() WHERE verified_at IS NULL")
    op.execute(
        sa.text("UPDATE verified_responders SET verified_at = NULL WHERE verification_source = :demo").bindparams(
            demo=DEMO_SOURCE
        )
    )
    # A demo responder is no longer verified, so it must not stay on duty or keep invitations.
    op.execute(
        "DELETE FROM support_presence WHERE responder_id IN (SELECT id FROM verified_responders "
        "WHERE verified_at IS NULL)"
    )
    op.execute(
        "DELETE FROM support_invites WHERE responder_id IN (SELECT id FROM verified_responders "
        "WHERE verified_at IS NULL)"
    )


def downgrade() -> None:
    # Demo rows stay unverified: re-verifying them would undo a deliberate security change.
    op.drop_column("verified_responders", "suspended_at")
    op.drop_column("verified_responders", "applied_at")
