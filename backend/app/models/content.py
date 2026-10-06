from ..extensions import db
from .base import Model


class BlogPost(Model):
    """Editorial content written by the TYM team or mentors, filed under a subject."""
    __tablename__ = "blog_posts"

    slug = db.Column(db.String(160), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    excerpt = db.Column(db.String(300), nullable=False)
    body = db.Column(db.Text, nullable=False)  # sanitised HTML
    cover_key = db.Column(db.String(255))
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    published_at = db.Column(db.DateTime(timezone=True))  # NULL = draft

    subject = db.relationship("Subject")
    author = db.relationship("User")
