from ..extensions import db
from .base import Model, enum


class BlogPost(Model):
    """Editorial content written by the TYM team or mentors, filed under a subject."""
    __tablename__ = "blog_posts"

    slug = db.Column(db.String(160), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    excerpt = db.Column(db.String(300), nullable=False)
    body = db.Column(db.Text, nullable=False)  # the article as written in the admin editor (lib/article.js)
    # Everything else the article page shows: seoTitle, description, topic, keywords, image, imageAlt,
    # author {name, username, role, bio}, takeaways, faqs, sources, readMins
    meta = db.Column(db.JSON)
    updated_at = db.Column(db.DateTime(timezone=True))
    cover_key = db.Column(db.String(255))
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    published_at = db.Column(db.DateTime(timezone=True))  # NULL = draft

    subject = db.relationship("Subject")
    author = db.relationship("User")


class ContactMessage(Model):
    """What someone sent through the contact form. Kept here so nothing depends on email arriving."""
    __tablename__ = "contact_messages"

    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    topic = db.Column(db.String(60), nullable=False)
    message = db.Column(db.Text, nullable=False)
    details = db.Column(db.JSON)
    status = db.Column(enum("new", "done", name="contact_status"), nullable=False, default="new", server_default="new")
    handled_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    handled_at = db.Column(db.DateTime(timezone=True))
