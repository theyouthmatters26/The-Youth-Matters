"""email about replies is off until it is asked for

The setting was on for every new account, which meant members were emailed about answers and
mentions without ever choosing it. New accounts now start with it off and turn it on themselves in
their profile settings.

Accounts that already exist are left exactly as they are. Switching somebody's notifications off
without being asked is as much of a surprise as switching them on.

Revision ID: c3f7b9e24a18
Revises: b2e8f5a31d64
"""
import sqlalchemy as sa
from alembic import op

revision = "c3f7b9e24a18"
down_revision = "b2e8f5a31d64"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("users", "notify_email", server_default=sa.text("false"))


def downgrade():
    op.alter_column("users", "notify_email", server_default=sa.text("true"))
