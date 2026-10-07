"""Blog articles, as the website reads them. They are written in the admin panel (admin_content.py).

    GET /blogs          published articles, newest first (cards)
    GET /blogs/<slug>   one article: everything the page shows, with the text as it was written
"""
from flask import Blueprint, jsonify

from ..extensions import db
from ..models import BlogPost

bp = Blueprint("blogs", __name__)

TEAM = {"name": "TYM Team", "username": "tym.team", "role": "Editorial team",
        "bio": "The TYM editorial team writes and checks guides with the students and mentors in the community."}
COVER = "/images/chatroom.jpg"


def card(b):
    m = b.meta or {}
    stamp = b.published_at or b.created_at
    return {"slug": b.slug, "title": b.title, "excerpt": b.excerpt, "topic": m.get("topic") or "Guides",
            "image": m.get("image") or COVER, "imageAlt": m.get("imageAlt") or "", "author": m.get("author") or TEAM,
            "keywords": m.get("keywords") or [], "readMins": m.get("readMins") or 1,
            "published": stamp.date().isoformat(), "updated": (b.updated_at or stamp).date().isoformat()}


def article(b):
    m = b.meta or {}
    return {**card(b), "seoTitle": m.get("seoTitle") or b.title, "description": m.get("description") or b.excerpt,
            "takeaways": m.get("takeaways") or [], "faqs": m.get("faqs") or [], "sources": m.get("sources") or [],
            "source": b.body}


@bp.get("/blogs")
def list_blogs():
    rows = db.session.scalars(db.select(BlogPost).where(BlogPost.published_at.is_not(None))
                              .order_by(BlogPost.published_at.desc()))
    return jsonify([card(b) for b in rows])


@bp.get("/blogs/<slug>")
def get_blog(slug):
    return jsonify(article(db.first_or_404(db.select(BlogPost).where(BlogPost.slug == slug, BlogPost.published_at.is_not(None)))))
