"""when an arranged session runs, and when it ended

A session the team arranges by hand had only a free text note saying when it was. Both people need
a countdown in their chat, and the mentor needs to be able to close the session, so the time it
starts, how long it runs and when it was ended are written down properly.

Revision ID: b2e8f5a31d64
Revises: a9c4e2f7b531
"""
import sqlalchemy as sa
from alembic import op

revision = "b2e8f5a31d64"
down_revision = "a9c4e2f7b531"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("session_requests", sa.Column("starts_at", sa.DateTime(timezone=True)))
    op.add_column("session_requests", sa.Column("minutes", sa.SmallInteger()))
    op.add_column("session_requests", sa.Column("ended_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_column("session_requests", "ended_at")
    op.drop_column("session_requests", "minutes")
    op.drop_column("session_requests", "starts_at")
