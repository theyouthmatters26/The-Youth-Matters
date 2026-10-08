"""mentor registration form answers

The client's Study Abroad Mentor Registration Form asks more than a mentor profile shows. Those
answers are kept together on the application, for the team to read when they review it.

Revision ID: f2b6d9c4a1e8
Revises: e7a1c4d2b9f3
"""
import sqlalchemy as sa
from alembic import op

revision = "f2b6d9c4a1e8"
down_revision = "e7a1c4d2b9f3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("mentor_applications", sa.Column("details", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("mentor_applications", "details")
