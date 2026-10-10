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
    sources = db.Column(db.JSON)  # TYMAi replies: [{"postId", "title"}] community questions it drew on
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)

    author = db.relationship("User")


class AiConversation(Model):
    """Private 1-on-1 thread in Ask TYM AI. A person from the team can step in (services/handoff.py):
    ai = TYMAi answers; waiting = the student asked for a person, TYMAi keeps answering meanwhile;
    human = a team member is handling it and TYMAi is paused."""
    __tablename__ = "ai_conversations"
    __table_args__ = (db.Index("ix_ai_conversations_inbox", "status", "last_message_at"),)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(120), nullable=False, default="New conversation")
    status = db.Column(enum("ai", "waiting", "human", name="ai_conversation_status"), nullable=False,
                       default="ai", server_default="ai")
    assigned_to_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    human_requested_at = db.Column(db.DateTime(timezone=True))
    # Kept on the conversation so the team inbox is one query
    last_message_at = db.Column(db.DateTime(timezone=True))
    last_role = db.Column(db.String(12))
    last_preview = db.Column(db.String(160))
    user_unread = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    staff_alerted_at = db.Column(db.DateTime(timezone=True))  # last "a student is waiting" email

    user = db.relationship("User", foreign_keys=[user_id])
    assigned_to = db.relationship("User", foreign_keys=[assigned_to_id])


class AiMessage(Model):
    __tablename__ = "ai_messages"

    conversation_id = db.Column(db.Integer, db.ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True,
                                nullable=False)
    role = db.Column(enum("user", "assistant", "human", name="ai_role"), nullable=False)  # human = team member
    author_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))  # who, for human
    content = db.Column(db.Text, nullable=False)
    sources = db.Column(db.JSON)  # [{"postId", "title"}] community questions the answer drew on

    author = db.relationship("User")


class MentorThread(Model):
    """One student and one mentor talking privately (api/mentor_chat.py).

    It opens when the student pays for a session with that mentor, and waits: nothing can be
    written until the mentor accepts the request from their dashboard. Declining closes it."""
    __tablename__ = "mentor_threads"
    __table_args__ = (db.UniqueConstraint("mentor_id", "student_id"),)

    mentor_id = db.Column(db.Integer, db.ForeignKey("mentor_profiles.id", ondelete="CASCADE"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = db.Column(enum("pending", "accepted", "declined", name="mentor_thread_status"),
                       nullable=False, default="pending", server_default="pending")
    request_note = db.Column(db.String(1000))  # what the student asked to cover, from the booking
    decided_at = db.Column(db.DateTime(timezone=True))
    # The video call link the mentor shared last. Only a mentor can set one: students never send links.
    meeting_url = db.Column(db.String(255))

    mentor = db.relationship("MentorProfile")
    student = db.relationship("User")


class MentorMessage(Model):
    """A private message inside a MentorThread. The pair (mentor_id, student_id) is the thread."""
    __tablename__ = "mentor_messages"
    __table_args__ = (db.Index("ix_mentor_messages_thread", "mentor_id", "student_id", "id"),)

    mentor_id = db.Column(db.Integer, db.ForeignKey("mentor_profiles.id", ondelete="CASCADE"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body = db.Column(db.String(2000), nullable=False)
    # text = typed; meeting = a call link the mentor shared; system = written by the site itself
    kind = db.Column(enum("text", "meeting", "system", name="mentor_message_kind"),
                     nullable=False, default="text", server_default="text")
    read_at = db.Column(db.DateTime(timezone=True))  # when the other person saw it
