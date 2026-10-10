"""chat requests, FAQs and closed accounts

Mentor chat now opens as a request the mentor accepts (mentor_threads), messages carry a kind so a
shared call link can be shown as one, the FAQ page is editable in the admin panel (faqs), and a
member who deletes their own account leaves it with status "closed".

Revision ID: d1a7c3f90b45
Revises: c8d4f2a6b3e1
"""
import sqlalchemy as sa
from alembic import op

revision = "d1a7c3f90b45"
down_revision = "c8d4f2a6b3e1"
branch_labels = None
depends_on = None

USER_STATUS = ("pending", "active", "suspended", "banned")
NOTIFICATION_KIND = ("answer", "reply", "upvote", "mention", "followed_post", "booking", "moderation", "system")


def _recheck(table, name, values):
    """Replace the CHECK constraint behind a string enum with one that allows `values`."""
    column = "status" if name.endswith("status") else "kind"
    op.drop_constraint(name, table, type_="check")
    op.create_check_constraint(name, table, sa.column(column).in_(values))


def upgrade():
    op.create_table(
        "mentor_threads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("mentor_id", sa.Integer(), sa.ForeignKey("mentor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Enum("pending", "accepted", "declined", name="mentor_thread_status",
                                    native_enum=False, create_constraint=True, length=32),
                  nullable=False, server_default="pending"),
        sa.Column("request_note", sa.String(1000), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meeting_url", sa.String(255), nullable=True),
        sa.UniqueConstraint("mentor_id", "student_id", name="uq_mentor_threads_pair"),
    )
    # Conversations that already exist were opened by a booking, so they stay open.
    op.execute("INSERT INTO mentor_threads (created_at, mentor_id, student_id, status, decided_at) "
               "SELECT MIN(created_at), mentor_id, student_id, 'accepted', MIN(created_at) "
               "FROM mentor_messages GROUP BY mentor_id, student_id")

    op.add_column("mentor_messages", sa.Column(
        "kind", sa.Enum("text", "meeting", "system", name="mentor_message_kind",
                        native_enum=False, create_constraint=True, length=32),
        nullable=False, server_default="text"))

    op.create_table(
        "faqs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("question", sa.String(200), nullable=False),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("pending", "published", "hidden", name="faq_status",
                                    native_enum=False, create_constraint=True, length=32),
                  nullable=False, server_default="pending"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("asked_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("answered_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
    )

    _recheck("users", "user_status", (*USER_STATUS, "closed"))
    _recheck("notifications", "notification_kind", (*NOTIFICATION_KIND, "message"))


def downgrade():
    _recheck("notifications", "notification_kind", NOTIFICATION_KIND)
    _recheck("users", "user_status", USER_STATUS)
    op.drop_table("faqs")
    op.drop_column("mentor_messages", "kind")
    op.drop_table("mentor_threads")
