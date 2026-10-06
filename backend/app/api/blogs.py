"""Blogs. Phase 3 adds create/edit from the admin panel."""
from flask import Blueprint, jsonify

from ..extensions import db
from ..models import BlogPost
from . import serializers as s

bp = Blueprint("blogs", __name__)


def _blog(b, with_body=False):
    data = {"slug": b.slug, "title": b.title, "excerpt": b.excerpt, "subject": s.subject(b.subject),
            "author": s.user_brief(b.author), "publishedAt": b.published_at.isoformat()}
    if with_body:
        data["body"] = b.body
    return data


@bp.get("/blogs")
def list_blogs():
    rows = db.session.scalars(
        db.select(BlogPost).where(BlogPost.published_at.is_not(None)).order_by(BlogPost.published_at.desc())
    )
    return jsonify([_blog(b) for b in rows])


@bp.get("/blogs/<slug>")
def get_blog(slug):
    b = db.first_or_404(db.select(BlogPost).where(BlogPost.slug == slug, BlogPost.published_at.is_not(None)))
    return jsonify(_blog(b, with_body=True))
