"""Answers and threaded replies (Module 3).

Returned flat, ordered by created_at; the client nests them by parentId.
Phase 2: POST /posts/<id>/comments, PATCH /comments/<id>, DELETE /comments/<id>
"""
from flask import Blueprint, jsonify

from ..extensions import db
from ..models import Comment
from . import serializers as s

bp = Blueprint("comments", __name__)


@bp.get("/posts/<int:post_id>/comments")
def list_comments(post_id):
    rows = db.session.scalars(
        db.select(Comment).filter_by(post_id=post_id).order_by(Comment.created_at)
    )
    return jsonify([s.comment(c) for c in rows])
