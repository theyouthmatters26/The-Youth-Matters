from ..extensions import db
from .base import Model, utcnow


class Comment(Model):
    """Answers and replies. parent_id NULL = top-level answer; otherwise a nested reply."""
    __tablename__ = "comments"
    __table_args__ = (db.Index("ix_comments_post_created", "post_id", "created_at"),)

    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey("comments.id", ondelete="CASCADE"))
    depth = db.Column(db.SmallInteger, nullable=False, default=0)

    body = db.Column(db.Text, nullable=False)
    upvotes = db.Column(db.Integer, nullable=False, default=0)
    downvotes = db.Column(db.Integer, nullable=False, default=0)
    score = db.Column(db.Integer, nullable=False, default=0)
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow)  # set only when the author edits

    author = db.relationship("User")
    post = db.relationship("Post", foreign_keys=[post_id])
