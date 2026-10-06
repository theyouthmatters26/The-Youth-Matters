"""Universal search (Module 6) across posts, users, country hubs and mentors.

    GET /search?q=          everything matching the words
    GET /search?q=&any=1    posts matching any word, for "Already asked?" suggestions
"""
import re

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Community, Country, MentorProfile, Post, User
from . import serializers as s

bp = Blueprint("search", __name__)
LIMIT = 10


@bp.get("/search")
def search():
    term = request.args.get("q", "").strip()
    if len(term) < 2:
        return jsonify(posts=[], users=[], communities=[], mentors=[])
    like = f"%{term}%"
    tsquery = db.func.websearch_to_tsquery("english", term)
    if request.args.get("any"):
        # "Already asked?" while typing: any of the meaningful words, best matches first
        words = [w for w in re.findall(r"[a-z0-9]+", term.lower()) if len(w) > 3][:10]
        tsquery = db.func.to_tsquery("english", " | ".join(words) or "''")

    posts = db.session.scalars(
        db.select(Post)
        .where(~Post.is_deleted, Post.search_vector.op("@@")(tsquery))
        .order_by(db.func.ts_rank(Post.search_vector, tsquery).desc())
        .limit(LIMIT)
    )
    users = db.session.scalars(
        db.select(User)
        .where(User.status == "active", User.username.ilike(like) | User.display_name.ilike(like))
        .limit(LIMIT)
    )
    communities = db.session.scalars(
        db.select(Community).join(Country).where(Community.is_active, Country.name.ilike(like)).limit(LIMIT)
    )
    mentors = db.session.scalars(
        db.select(MentorProfile)
        .where(MentorProfile.is_verified,
               MentorProfile.university.ilike(like) | MentorProfile.course.ilike(like))
        .limit(LIMIT)
    )
    return jsonify(
        posts=[s.post(p) for p in posts],
        users=[s.user_brief(u) for u in users],
        communities=[s.community(c) for c in communities],
        mentors=[s.mentor(m) for m in mentors],
    )
