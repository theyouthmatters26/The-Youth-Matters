from ..extensions import db
from .base import Model, enum

KINDS = ("answer", "reply", "upvote", "mention", "followed_post", "booking", "moderation", "system")


class Notification(Model):
    __tablename__ = "notifications"
    __table_args__ = (db.Index("ix_notifications_user_unread", "user_id", "is_read"),)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    kind = db.Column(enum(*KINDS, name="notification_kind"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"))
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id", ondelete="CASCADE"))
    message = db.Column(db.String(255))
    is_read = db.Column(db.Boolean, nullable=False, default=False)

    actor = db.relationship("User", foreign_keys=[actor_id])
    post = db.relationship("Post")
