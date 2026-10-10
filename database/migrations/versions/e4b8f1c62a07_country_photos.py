"""country photos

A country added in the admin panel brings its own photo, instead of needing a file deployed with
the website.

Revision ID: e4b8f1c62a07
Revises: d1a7c3f90b45
"""
import sqlalchemy as sa
from alembic import op

revision = "e4b8f1c62a07"
down_revision = "d1a7c3f90b45"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("countries", sa.Column("image_key", sa.String(255), nullable=True))


def downgrade():
    op.drop_column("countries", "image_key")
