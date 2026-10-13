"""session requests the team arranges by hand

Until the payment gateway is live, a student asks for a session through the booking form instead of
paying for one. The request is kept here: the team assigns a mentor, agrees a time and payment with
the student, and confirms it, which opens the chat between the two of them.

Revision ID: a9c4e2f7b531
Revises: f1b6d3a9c472
"""
import sqlalchemy as sa
from alembic import op

revision = "a9c4e2f7b531"
down_revision = "f1b6d3a9c472"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "session_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, index=True),
        sa.Column("whatsapp", sa.String(30)),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("wanted_mentor_id", sa.Integer(), sa.ForeignKey("mentor_profiles.id", ondelete="SET NULL")),
        sa.Column("mentor_id", sa.Integer(), sa.ForeignKey("mentor_profiles.id", ondelete="SET NULL")),
        sa.Column("package_id", sa.Integer(), sa.ForeignKey("counseling_packages.id", ondelete="SET NULL")),
        # VARCHAR + CHECK, the way every other enum in this schema is stored (models/base.py)
        sa.Column("status", sa.Enum("new", "assigned", "confirmed", "cancelled",
                                    name="session_request_status", native_enum=False,
                                    create_constraint=True, length=32),
                  nullable=False, server_default="new"),
        sa.Column("message", sa.Text()),
        sa.Column("answers", sa.JSON()),
        sa.Column("note", sa.String(500)),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("handled_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
    )


def downgrade():
    op.drop_table("session_requests")
