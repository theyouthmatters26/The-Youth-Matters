"""case studies the team can write

The case studies page was three examples hard-coded in the website bundle, so putting a real
student's journey up meant a deploy. They move into a table the team edits in the admin panel, and
the three examples come along so the page never goes empty.

Revision ID: f1b6d3a9c472
Revises: e5a2f8b16c40
"""
import sqlalchemy as sa
from alembic import op

revision = "f1b6d3a9c472"
down_revision = "e5a2f8b16c40"
branch_labels = None
depends_on = None

EXAMPLES = [
    ("Aisha Khan", "Hyderabad to Leeds", "MSc Marketing",
     "I had my visa financials wrong by two months. One answer here saved my application."),
    ("Rohan Mehta", "Pune to Manchester", "BSc Computer Science",
     "The UK chatroom found me three flatmates before I had even booked my flight."),
    ("Meera Nair", "Kochi to Boston", "MS Information Systems",
     "A 30 minute mentor session reshaped my shortlist and my SOP."),
]


def upgrade():
    # VARCHAR + CHECK, the way every other enum in this schema is stored (models/base.py)
    status = sa.Enum("published", "hidden", name="case_study_status",
                     native_enum=False, create_constraint=True, length=32)
    table = op.create_table(
        "case_studies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("route", sa.String(120), nullable=False),
        sa.Column("course", sa.String(120), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("status", status, nullable=False, server_default="published"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.bulk_insert(table, [
        {"name": n, "route": r, "course": c, "quote": q, "status": "published", "sort_order": i}
        for i, (n, r, c, q) in enumerate(EXAMPLES, start=1)
    ])


def downgrade():
    op.drop_table("case_studies")
