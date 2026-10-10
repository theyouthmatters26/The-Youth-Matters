"""chat sessions

A booking is time in the chat with a mentor. When that time is up the mentor is told once, and
ends the session when they are done.

Revision ID: f7c2d4a81b93
Revises: e4b8f1c62a07
"""
import sqlalchemy as sa
from alembic import op

revision = "f7c2d4a81b93"
down_revision = "e4b8f1c62a07"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("bookings", sa.Column("time_up_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("bookings", "ended_at")
    op.drop_column("bookings", "time_up_at")
