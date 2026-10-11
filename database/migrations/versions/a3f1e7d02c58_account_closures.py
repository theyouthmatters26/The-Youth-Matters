"""account closures

Why someone left, kept for the team after the account itself is gone. The account is still erased
or emptied; this row records the closure, not the person, and nothing links back to it.

Revision ID: a3f1e7d02c58
Revises: f7c2d4a81b93
"""
import sqlalchemy as sa
from alembic import op

revision = "a3f1e7d02c58"
down_revision = "f7c2d4a81b93"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "account_closures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("username", sa.String(32), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("reason", sa.String(1000), nullable=True),
        sa.Column("kept", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_index("ix_account_closures_created_at", "account_closures", ["created_at"])


def downgrade():
    op.drop_index("ix_account_closures_created_at", table_name="account_closures")
    op.drop_table("account_closures")
