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


class CaseStudy(Model):
    """A student's journey on the case studies page (api/case_studies.py).

    Only the team writes these, in the admin panel: they are about real students, so nobody puts one
    up on their own behalf."""
    __tablename__ = "case_studies"

    name = db.Column(db.String(80), nullable=False)
    route = db.Column(db.String(120), nullable=False)        # "Hyderabad to Leeds"
    course = db.Column(db.String(120), nullable=False)
    quote = db.Column(db.Text, nullable=False)
    status = db.Column(enum("published", "hidden", name="case_study_status"), nullable=False,
                       default="published", server_default="published")
    sort_order = db.Column(db.Integer, nullable=False, default=0, server_default="0")


class Faq(Model):
    """A question and its answer on the FAQ page (api/faqs.py).

    The team writes most of them in the admin panel. Members can send one in with "Post your FAQ":
    that arrives without an answer and only shows on the site once the team has written one."""
    __tablename__ = "faqs"

    question = db.Column(db.String(200), nullable=False)
    answer = db.Column(db.Text)  # NULL while a member's question is waiting for the team
    status = db.Column(enum("pending", "published", "hidden", name="faq_status"), nullable=False,
                       default="pending", server_default="pending")
    sort_order = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    asked_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    answered_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    answered_at = db.Column(db.DateTime(timezone=True))

    asked_by = db.relationship("User", foreign_keys=[asked_by_id])
