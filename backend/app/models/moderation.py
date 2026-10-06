from ..extensions import db
from .base import Model, enum

TARGETS = ("post", "comment", "user", "chat_message")


class Report(Model):
    __tablename__ = "reports"

    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_type = db.Column(enum(*TARGETS, name="report_target"), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(500), nullable=False)
    status = db.Column(enum("open", "resolved", "dismissed", name="report_status"),
                       nullable=False, default="open")
    resolved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    resolved_at = db.Column(db.DateTime(timezone=True))


class Strike(Model):
    """3-strike system: 1 = warning + deletion, 2 = 24h mute, 3 = suspension pending review."""
    __tablename__ = "strikes"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    level = db.Column(db.SmallInteger, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    source = db.Column(enum("ai", "admin", name="strike_source"), nullable=False)
    content_type = db.Column(enum(*TARGETS, name="strike_content"))
    content_id = db.Column(db.Integer)


class ModerationLog(Model):
    """Audit trail for the admin moderation queue. actor_id NULL = automated (AI) action."""
    __tablename__ = "moderation_logs"

    actor_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    action = db.Column(db.String(40), nullable=False)  # censored, deleted, muted, suspended...
    target_type = db.Column(enum(*TARGETS, name="modlog_target"), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    detail = db.Column(db.JSON)
