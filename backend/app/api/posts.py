"""Questions / posts (Module 2) with Hot / Top / New sorting (Module 4).

Phase 2: POST /posts, PATCH /posts/<id>, DELETE /posts/<id>, POST /posts/<id>/save
"""
from flask import Blueprint, abort, jsonify, request

from ..extensions import db
from ..models import Category, Community, Country, Post, Subject
from ..services.ranking import hot_sql
from . import serializers as s

bp = Blueprint("posts", __name__)

PAGE_SIZE = 20
SORTS = {
    "hot": lambda: hot_sql(Post).desc(),
    "top": lambda: Post.score.desc(),
    "new": lambda: Post.created_at.desc(),
}


@bp.get("/posts")
def list_posts():
    sort = request.args.get("sort", "hot")
    if sort not in SORTS:
        abort(400, f"sort must be one of {', '.join(SORTS)}")
    page = request.args.get("page", 1, type=int)

    q = db.select(Post).join(Community).where(~Post.is_deleted)
    if slug := request.args.get("subject"):
        q = q.join(Subject).where(Subject.slug == slug)
    if slug := request.args.get("country"):
        q = q.join(Country).where(Country.slug == slug)
    if slug := request.args.get("category"):
        q = q.join(Category).where(Category.slug == slug)
    q = q.order_by(Post.is_pinned.desc(), SORTS[sort]())

    rows = db.paginate(q, page=page, per_page=PAGE_SIZE, error_out=False)
    return jsonify(items=[s.post(p) for p in rows.items], page=page, hasMore=rows.has_next)


@bp.get("/posts/<int:post_id>")
def get_post(post_id):
    p = db.get_or_404(Post, post_id)
    if p.is_deleted:
        abort(404)
    return jsonify(s.post(p, with_body=True))
