"""sign out everywhere when a password changes, and indexes for the busiest lookups

Revision ID: e7a1c4d2b9f3
Revises: d5e8b2a6c914
Create Date: 2026-10-07 12:30:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e7a1c4d2b9f3'
down_revision = 'd5e8b2a6c914'
branch_labels = None
depends_on = None


def upgrade():
    # Sign-ins older than this stop working: set whenever the password changes
    op.add_column('users', sa.Column('tokens_valid_after', sa.DateTime(timezone=True), nullable=True))
    # An open Ask TYM AI tab reads its conversation every few seconds; profiles list a person's posts and answers
    op.create_index('ix_ai_messages_conversation_id', 'ai_messages', ['conversation_id'])
    op.create_index('ix_posts_author_id', 'posts', ['author_id'])
    op.create_index('ix_comments_author_id', 'comments', ['author_id'])


def downgrade():
    op.drop_index('ix_comments_author_id', table_name='comments')
    op.drop_index('ix_posts_author_id', table_name='posts')
    op.drop_index('ix_ai_messages_conversation_id', table_name='ai_messages')
    op.drop_column('users', 'tokens_valid_after')
