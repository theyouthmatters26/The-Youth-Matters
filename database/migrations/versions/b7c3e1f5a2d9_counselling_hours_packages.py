"""counselling hours packages

Mentors stop having a price of their own. Students buy fixed packages of counselling hours and
spend them on sessions with any mentor: the balance lives on the member, in minutes.

Revision ID: b7c3e1f5a2d9
Revises: f2b6d9c4a1e8
"""
import sqlalchemy as sa
from alembic import op

revision = "b7c3e1f5a2d9"
down_revision = "f2b6d9c4a1e8"
branch_labels = None
depends_on = None

KINDS = "kind IN ('session', 'subscription'%s)"


def upgrade():
    packages = op.create_table(
        "counseling_packages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("hours", sa.SmallInteger(), nullable=False),
        sa.Column("price_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    # The client's two tiers ($10 for 1 hour, $50 for 10 hours) in rupees at about ₹85 to the dollar.
    # Prices are changed in the admin panel, under Payments.
    op.bulk_insert(packages, [
        {"title": "1 hour", "hours": 1, "price_minor": 85000, "currency": "INR", "is_active": True, "sort_order": 1},
        {"title": "10 hours", "hours": 10, "price_minor": 425000, "currency": "INR", "is_active": True, "sort_order": 2},
    ])

    op.add_column("users", sa.Column("counseling_minutes", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("bookings", sa.Column("minutes_deducted", sa.SmallInteger(), nullable=True))
    op.add_column("payments", sa.Column("package_id", sa.Integer(), sa.ForeignKey("counseling_packages.id"), nullable=True))
    op.add_column("payments", sa.Column("minutes", sa.Integer(), nullable=True))
    op.drop_constraint("payment_kind", "payments", type_="check")
    op.create_check_constraint("payment_kind", "payments", KINDS % ", 'package'")

    op.drop_column("mentor_profiles", "price_minor")
    op.drop_column("mentor_profiles", "currency")
    op.drop_column("mentor_applications", "price_minor")


def downgrade():
    # Prices are gone: mentors come back at a placeholder for the team to set again
    op.add_column("mentor_applications", sa.Column("price_minor", sa.Integer(), nullable=False, server_default="129900"))
    op.add_column("mentor_profiles", sa.Column("currency", sa.String(3), nullable=False, server_default="INR"))
    op.add_column("mentor_profiles", sa.Column("price_minor", sa.Integer(), nullable=False, server_default="129900"))
    op.execute("DELETE FROM payments WHERE kind = 'package'")
    op.drop_constraint("payment_kind", "payments", type_="check")
    op.create_check_constraint("payment_kind", "payments", KINDS % "")
    op.drop_column("payments", "minutes")
    op.drop_column("payments", "package_id")
    op.drop_column("bookings", "minutes_deducted")
    op.drop_column("users", "counseling_minutes")
    op.drop_table("counseling_packages")
