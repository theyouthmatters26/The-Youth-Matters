"""mentor messages

Private messages between a student and a mentor they have booked.

Revision ID: c8d4f2a6b3e1
Revises: b7c3e1f5a2d9
"""
import sqlalchemy as sa
from alembic import op

revision = "c8d4f2a6b3e1"
down_revision = "b7c3e1f5a2d9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mentor_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("mentor_id", sa.Integer(), sa.ForeignKey("mentor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.String(2000), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_mentor_messages_thread", "mentor_messages", ["mentor_id", "student_id", "id"])


def downgrade():
    op.drop_index("ix_mentor_messages_thread", table_name="mentor_messages")
    op.drop_table("mentor_messages")
