"""email me about replies

An answer to your question, a reply, or an @mention can now reach your inbox as well as the bell.
On by default, because somebody who closed the tab is exactly who the email is for; off from
Profile settings.

Revision ID: c9d4b2e81f36
Revises: b8c3a5f61d27
"""
import sqlalchemy as sa
from alembic import op

revision = "c9d4b2e81f36"
down_revision = "b8c3a5f61d27"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("notify_email", sa.Boolean(), nullable=False,
                                     server_default=sa.true()))


def downgrade():
    op.drop_column("users", "notify_email")
