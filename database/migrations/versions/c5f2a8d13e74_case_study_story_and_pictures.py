"""case study story and pictures

A journey on /case-studies can carry a few photographs and a longer read, shown when a student
opens one. Both are optional: the case studies already on the page keep working without them.

Revision ID: c5f2a8d13e74
Revises: b4d9e1a7c250
"""
import sqlalchemy as sa
from alembic import op

revision = "c5f2a8d13e74"
down_revision = "b4d9e1a7c250"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("case_studies", sa.Column("story", sa.Text(), nullable=True))
    op.add_column("case_studies", sa.Column("images", sa.JSON(), nullable=False, server_default="[]"))


def downgrade():
    op.drop_column("case_studies", "images")
    op.drop_column("case_studies", "story")
