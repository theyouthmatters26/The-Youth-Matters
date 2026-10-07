"""blog articles managed from the admin panel, and a contact form inbox

Revision ID: d5e8b2a6c914
Revises: c3d9a1f07b52
Create Date: 2026-10-07 11:40:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd5e8b2a6c914'
down_revision = 'c3d9a1f07b52'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('blog_posts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('meta', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        'contact_messages',
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('topic', sa.String(length=60), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('status', sa.Enum('new', 'done', name='contact_status', native_enum=False, create_constraint=True, length=32),
                  server_default='new', nullable=False),
        sa.Column('handled_by_id', sa.Integer(), nullable=True),
        sa.Column('handled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['handled_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('contact_messages')
    with op.batch_alter_table('blog_posts', schema=None) as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('meta')
