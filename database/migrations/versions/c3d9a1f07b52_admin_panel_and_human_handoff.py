"""admin panel access and a person stepping into Ask TYM AI

Revision ID: c3d9a1f07b52
Revises: a419daf0a51a
Create Date: 2026-10-07 09:10:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c3d9a1f07b52'
down_revision = 'a419daf0a51a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('admin_access', sa.JSON(), nullable=True))

    with op.batch_alter_table('ai_conversations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(length=32), nullable=False, server_default='ai'))
        batch_op.add_column(sa.Column('assigned_to_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('human_requested_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('last_role', sa.String(length=12), nullable=True))
        batch_op.add_column(sa.Column('last_preview', sa.String(length=160), nullable=True))
        batch_op.add_column(sa.Column('user_unread', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('staff_alerted_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.create_check_constraint('ai_conversation_status', "status IN ('ai', 'waiting', 'human')")
        batch_op.create_foreign_key('fk_ai_conversations_assigned_to', 'users', ['assigned_to_id'], ['id'],
                                    ondelete='SET NULL')
        batch_op.create_index('ix_ai_conversations_inbox', ['status', 'last_message_at'], unique=False)

    with op.batch_alter_table('ai_messages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('author_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_ai_messages_author', 'users', ['author_id'], ['id'], ondelete='SET NULL')
        # A third kind of message: written by a team member
        batch_op.drop_constraint('ai_role', type_='check')
        batch_op.create_check_constraint('ai_role', "role IN ('user', 'assistant', 'human')")

    # Conversations that already exist get their inbox line from their latest message
    op.execute("""
        UPDATE ai_conversations c
        SET last_message_at = m.created_at, last_role = m.role, last_preview = left(m.content, 160)
        FROM (SELECT DISTINCT ON (conversation_id) conversation_id, created_at, role, content
              FROM ai_messages ORDER BY conversation_id, id DESC) m
        WHERE m.conversation_id = c.id
    """)


def downgrade():
    op.execute("UPDATE ai_messages SET role = 'assistant' WHERE role = 'human'")
    with op.batch_alter_table('ai_messages', schema=None) as batch_op:
        batch_op.drop_constraint('ai_role', type_='check')
        batch_op.create_check_constraint('ai_role', "role IN ('user', 'assistant')")
        batch_op.drop_constraint('fk_ai_messages_author', type_='foreignkey')
        batch_op.drop_column('author_id')

    with op.batch_alter_table('ai_conversations', schema=None) as batch_op:
        batch_op.drop_index('ix_ai_conversations_inbox')
        batch_op.drop_constraint('fk_ai_conversations_assigned_to', type_='foreignkey')
        batch_op.drop_constraint('ai_conversation_status', type_='check')
        for column in ('staff_alerted_at', 'user_unread', 'last_preview', 'last_role', 'last_message_at',
                       'human_requested_at', 'assigned_to_id', 'status'):
            batch_op.drop_column(column)

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('admin_access')
