"""Answers and threaded replies (Module 3).

    GET    /posts/<id>/comments      flat, oldest first; the client nests them by parentId
    POST   /posts/<id>/comments      {body, parentId?}
    PATCH  /comments/<id>            the author edits
    DELETE /comments/<id>            the author (or an admin) removes it; replies stay, shown under "[removed]"
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db, limiter
from ..models import Comment, Post, Vote
from ..models.base import utcnow
from ..services import content, staff
from ..services.notify import notify, notify_mentions
from . import serializers as s
from .posts import _post, member, viewer

bp = Blueprint("comments", __name__)

MAX_DEPTH = 8  # deeper replies stay at this indent so threads remain readable on phones


def _comment(comment_id):
    c = db.session.get(Comment, comment_id)
    if not c or c.is_deleted:
        abort(404, "This comment has been removed.")
    return c


@bp.get("/posts/<int:post_id>/comments")
def list_comments(post_id):
    user = viewer()
    _post(post_id)
    rows = db.session.scalars(db.select(Comment).filter_by(post_id=post_id).order_by(Comment.created_at)).all()
    votes = {}
    if user and rows:
        votes = dict(db.session.execute(db.select(Vote.target_id, Vote.value).where(
            Vote.user_id == user.id, Vote.target_type == "comment",
            Vote.target_id.in_([c.id for c in rows]))).all())
    return jsonify([s.comment(c, votes.get(c.id, 0)) for c in rows])


@bp.post("/posts/<int:post_id>/comments")
@jwt_required()
@limiter.limit("30 per hour")
def create_comment(post_id):
    user = member()
    post = _post(post_id)
    data = request.get_json(silent=True) or {}
    body, censored = content.clean(data.get("body"), 5000)
    if len(body) < 2:
        abort(400, "Write your answer first.")
    parent = None
    if data.get("parentId"):
        parent = db.session.get(Comment, data["parentId"]) if isinstance(data["parentId"], int) else None
        if not parent or parent.post_id != post.id:
            abort(400, "You are replying to something that is not in this thread.")

    c = Comment(post=post, author=user, parent_id=parent.id if parent else None,
                depth=min(parent.depth + 1, MAX_DEPTH) if parent else 0, body=body, score=1, upvotes=1)
    db.session.add(c)
    db.session.flush()
    db.session.add(Vote(user_id=user.id, target_type="comment", target_id=c.id, value=1))
    db.session.execute(db.update(Post).where(Post.id == post.id).values(comment_count=Post.comment_count + 1))

    told = {user.id}
    if parent:
        notify(parent.author_id, user, "reply", post, c)
        told.add(parent.author_id)
    else:
        notify(post.author_id, user, "answer", post, c)
        told.add(post.author_id)
    notify_mentions(content.mentions(body), user, post, c, already=told)
    db.session.commit()
    return jsonify(comment=s.comment(c, 1), censored=censored), 201


@bp.patch("/comments/<int:comment_id>")
@jwt_required()
@limiter.limit("30 per hour")
def edit_comment(comment_id):
    user = member()
    c = _comment(comment_id)
    if c.author_id != user.id:
        abort(403, "You can only edit your own answers.")
    body, _ = content.clean((request.get_json(silent=True) or {}).get("body"), 5000)
    if len(body) < 2:
        abort(400, "Your answer cannot be empty.")
    c.body, c.updated_at = body, utcnow()
    db.session.commit()
    return jsonify(comment=s.comment(c))


@bp.delete("/comments/<int:comment_id>")
@jwt_required()
def delete_comment(comment_id):
    user = current_user
    c = _comment(comment_id)
    if c.author_id != user.id:
        staff.moderating(user, "removed", "comment", c.id, c.author, "You can only delete your own answers.")
    # Claim the removal in one statement, so two deletes at once take one off the count, not two
    removed = db.session.execute(db.update(Comment).where(Comment.id == c.id, ~Comment.is_deleted).values(is_deleted=True))
    if removed.rowcount:
        db.session.execute(db.update(Post).where(Post.id == c.post_id)
                           .values(comment_count=db.func.greatest(Post.comment_count - 1, 0)))
    if c.post.helpful_comment_id == c.id:
        c.post.helpful_comment_id = None
    db.session.commit()
    return "", 204
