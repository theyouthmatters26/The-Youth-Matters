from ..extensions import db
from .base import Model, enum


class ChatRoom(Model):
    """Free public room. Belongs to a subject, optionally narrowed to one community (country)."""
    __tablename__ = "chat_rooms"

    slug = db.Column(db.String(40), unique=True, nullable=False)
    name = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(255))
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    community_id = db.Column(db.Integer, db.ForeignKey("communities.id"))
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    subject = db.relationship("Subject")
    community = db.relationship("Community")


class ChatMessage(Model):
    __tablename__ = "chat_messages"
    __table_args__ = (db.Index("ix_chat_messages_room_created", "room_id", "created_at"),)

    room_id = db.Column(db.Integer, db.ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body = db.Column(db.String(2000), nullable=False)
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)


class AiConversation(Model):
    """Private 1-on-1 thread in the AI Counsellor Lounge."""
    __tablename__ = "ai_conversations"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(120), nullable=False, default="New conversation")


class AiMessage(Model):
    __tablename__ = "ai_messages"

    conversation_id = db.Column(db.Integer, db.ForeignKey("ai_conversations.id", ondelete="CASCADE"),
                                nullable=False)
    role = db.Column(enum("user", "assistant", name="ai_role"), nullable=False)
    content = db.Column(db.Text, nullable=False)
