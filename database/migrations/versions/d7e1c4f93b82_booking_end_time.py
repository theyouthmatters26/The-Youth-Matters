"""booking end time

A session used to be exactly one slot long, so where it ended was never worth writing down. Now a
student picks a start and an end, and a booking can run across several of the mentor's slots, so
the end has to be stored: it is what decides which slots are still free.

Existing bookings all ran for a single slot, so their end is that slot's end.

Revision ID: d7e1c4f93b82
Revises: c9d4b2e81f36
"""
import sqlalchemy as sa
from alembic import op

revision = "d7e1c4f93b82"
down_revision = "c9d4b2e81f36"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("bookings", sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("""
        UPDATE bookings SET ends_at = availability_slots.ends_at
        FROM availability_slots WHERE availability_slots.id = bookings.slot_id
    """)


def downgrade():
    op.drop_column("bookings", "ends_at")
