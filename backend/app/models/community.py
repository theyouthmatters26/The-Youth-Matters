"""The reusable hierarchy from the agreement:  Subject -> Country -> Chat Room / Discussion -> Mentors / Content.

A Community is one country inside one subject (Study Abroad / UK, later Career / UK ...).
Posts, chat rooms and mentors hang off it, so a new subject needs rows, not code.
"""
from ..extensions import db
from .base import Model


class Subject(Model):
    """Top level: Study Abroad (phase 1), Career, Education, Entrepreneurship, Life & Experiences."""
    __tablename__ = "subjects"

    slug = db.Column(db.String(40), unique=True, nullable=False)
    name = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(300))
    is_active = db.Column(db.Boolean, nullable=False, default=False)  # inactive = "coming soon"
    sort_order = db.Column(db.Integer, nullable=False, default=0)


class Country(Model):
    __tablename__ = "countries"

    slug = db.Column(db.String(40), unique=True, nullable=False)
    name = db.Column(db.String(80), nullable=False)
    iso_code = db.Column(db.String(2), unique=True, nullable=False)


class Community(Model):
    """One country inside one subject, e.g. /study-abroad/uk."""
    __tablename__ = "communities"
    __table_args__ = (db.UniqueConstraint("subject_id", "country_id"),)

    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    country_id = db.Column(db.Integer, db.ForeignKey("countries.id"), nullable=False)
    description = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)

    subject = db.relationship("Subject")
    country = db.relationship("Country")


class Category(Model):
    """Cross-community topic: Visas, Scholarships, Accommodation, SOPs..."""
    __tablename__ = "categories"

    slug = db.Column(db.String(40), unique=True, nullable=False)
    name = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(300))


class Follow(Model):
    """Joined communities and followed mentors. Exactly one target per row."""
    __tablename__ = "follows"
    __table_args__ = (
        db.UniqueConstraint("user_id", "community_id"),
        db.UniqueConstraint("user_id", "mentor_id"),
        db.CheckConstraint("(community_id IS NULL) <> (mentor_id IS NULL)", name="ck_follows_one_target"),
    )

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    community_id = db.Column(db.Integer, db.ForeignKey("communities.id", ondelete="CASCADE"))
    mentor_id = db.Column(db.Integer, db.ForeignKey("mentor_profiles.id", ondelete="CASCADE"))
