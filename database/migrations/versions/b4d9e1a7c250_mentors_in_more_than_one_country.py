"""mentors in more than one country

A mentor who studied in the UK may also be able to advise on the USA. Until now a profile sat in
exactly one country community, so the directory could only show them under one. The new table
holds every country a mentor is listed in, including the home one on the profile itself.

Revision ID: b4d9e1a7c250
Revises: c3f7b9e24a18
"""
import sqlalchemy as sa
from alembic import op

revision = "b4d9e1a7c250"
down_revision = "c3f7b9e24a18"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mentor_countries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("mentor_id", sa.Integer(), nullable=False),
        sa.Column("community_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["mentor_id"], ["mentor_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"]),
        sa.UniqueConstraint("mentor_id", "community_id"),
    )
    # Every mentor who already exists keeps the country they are in today
    op.execute("INSERT INTO mentor_countries (created_at, mentor_id, community_id) "
               "SELECT CURRENT_TIMESTAMP, id, community_id FROM mentor_profiles")
    op.add_column("mentor_applications", sa.Column("country_slugs", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("mentor_applications", "country_slugs")
    op.drop_table("mentor_countries")
