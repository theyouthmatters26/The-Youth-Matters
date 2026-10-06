from ..extensions import db
from .base import Model, enum


class Vote(Model):
    """One vote per user per post/comment. value is +1 or -1."""
    __tablename__ = "votes"
    __table_args__ = (
        db.UniqueConstraint("user_id", "target_type", "target_id"),
        db.CheckConstraint("value IN (-1, 1)", name="ck_votes_value"),
    )

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_type = db.Column(enum("post", "comment", name="vote_target"), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    value = db.Column(db.SmallInteger, nullable=False)
