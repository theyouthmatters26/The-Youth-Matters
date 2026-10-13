"""the client's hourly price list

One hour ₹1,000, five hours ₹4,000, ten hours ₹7,000. The first two tiers were placeholders set
when packages were introduced, and there was no five-hour tier at all. Prices stay editable in the
admin panel under Payments: this only brings the rows up to what the client published.

Revision ID: e5a2f8b16c40
Revises: d7e1c4f93b82
"""
from alembic import op

revision = "e5a2f8b16c40"
down_revision = "d7e1c4f93b82"
branch_labels = None
depends_on = None

PRICES = {1: (100000, "1 hour", 1), 5: (400000, "5 hours", 2), 10: (700000, "10 hours", 3)}


def upgrade():
    for hours, (price, title, order) in PRICES.items():
        # The client set these, so they win over whatever is there; the team can edit them after.
        op.execute(f"""
            UPDATE counseling_packages SET price_minor = {price}, title = '{title}', sort_order = {order}
            WHERE hours = {hours}
        """)
        op.execute(f"""
            INSERT INTO counseling_packages (title, hours, price_minor, currency, is_active, sort_order)
            SELECT '{title}', {hours}, {price}, 'INR', true, {order}
            WHERE NOT EXISTS (SELECT 1 FROM counseling_packages WHERE hours = {hours})
        """)


def downgrade():
    op.execute("UPDATE counseling_packages SET price_minor = 85000 WHERE hours = 1")
    op.execute("UPDATE counseling_packages SET price_minor = 425000 WHERE hours = 10")
    op.execute("DELETE FROM counseling_packages WHERE hours = 5")
