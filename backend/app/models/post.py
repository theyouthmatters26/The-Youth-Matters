from sqlalchemy.dialects.postgresql import TSVECTOR

from ..extensions import db
from .base import Model, utcnow


class Post(Model):
    __tablename__ = "posts"
    __table_args__ = (
        db.Index("ix_posts_community_created", "community_id", "created_at"),
        db.Index("ix_posts_score", "score"),
        db.Index("ix_posts_search", "search_vector", postgresql_using="gin"),
    )

    author_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    community_id = db.Column(db.Integer, db.ForeignKey("communities.id"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"))

    title = db.Column(db.String(300), nullable=False)
    body = db.Column(db.Text, nullable=False, default="")  # sanitised HTML

    # Denormalised counters, updated in the same transaction as the vote/comment.
    upvotes = db.Column(db.Integer, nullable=False, default=0)
    downvotes = db.Column(db.Integer, nullable=False, default=0)
    score = db.Column(db.Integer, nullable=False, default=0)
    comment_count = db.Column(db.Integer, nullable=False, default=0)

    is_pinned = db.Column(db.Boolean, nullable=False, default=False)
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)
    ai_answered_at = db.Column(db.DateTime(timezone=True))  # TYMAi 6-hour fallback marker
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    search_vector = db.Column(
        TSVECTOR,
        db.Computed("to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))",
                    persisted=True),
    )

    author = db.relationship("User")
    community = db.relationship("Community")
    category = db.relationship("Category")
    images = db.relationship("PostImage", order_by="PostImage.position",
                             cascade="all, delete-orphan")


class PostImage(Model):
    __tablename__ = "post_images"

    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    storage_key = db.Column(db.String(255), nullable=False)
    position = db.Column(db.SmallInteger, nullable=False, default=0)


class SavedPost(Model):
    __tablename__ = "saved_posts"
    __table_args__ = (db.UniqueConstraint("user_id", "post_id"),)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
