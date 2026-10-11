"""cashfree payments

The payment gateway is Cashfree now, so the columns that hold its ids are named for the job rather
than for a provider: another switch will not need another migration. The ids already in them stay
where they are, so old Razorpay payments keep their receipts.

Revision ID: b8c3a5f61d27
Revises: a3f1e7d02c58
"""
from alembic import op

revision = "b8c3a5f61d27"
down_revision = "a3f1e7d02c58"
branch_labels = None
depends_on = None

RENAMES = [("razorpay_order_id", "gateway_order_id"),
           ("razorpay_payment_id", "gateway_payment_id"),
           ("razorpay_refund_id", "gateway_refund_id")]


def upgrade():
    for old, new in RENAMES:
        op.alter_column("payments", old, new_column_name=new)


def downgrade():
    for old, new in RENAMES:
        op.alter_column("payments", new, new_column_name=old)
