"""Up and down votes on posts and comments (Module 4).

    PUT /votes   {targetType: "post" | "comment", targetId, value: 1 | -1 | 0}   0 removes your vote

Counters on the post or comment change in the same transaction, with SQL arithmetic, so two
people voting at the same moment never overwrite each other.
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db, limiter
from ..models import Comment, Notification, Post, Vote
from ..services.notify import notify
from .posts import member

bp = Blueprint("votes", __name__)

TARGETS = {"post": Post, "comment": Comment}
MILESTONES = (10, 25, 50, 100, 250)


def vote_delta(old, new):
    """Change to (upvotes, downvotes) when a vote goes from old to new (each -1, 0 or 1)."""
    return int(new == 1) - int(old == 1), int(new == -1) - int(old == -1)


@bp.put("/votes")
@jwt_required()
@limiter.limit("300 per hour")
def vote():
    user = member()
    data = request.get_json(silent=True) or {}
    kind, target_id, value = data.get("targetType"), data.get("targetId"), data.get("value")
    if kind not in TARGETS or not isinstance(target_id, int) or value not in (-1, 0, 1):
        abort(400, "Send targetType (post or comment), targetId and value (1, -1 or 0).")
    model = TARGETS[kind]
    target = db.session.get(model, target_id)
    if not target or target.is_deleted:
        abort(404, "This has been removed.")

    existing = db.session.scalar(db.select(Vote).filter_by(user_id=user.id, target_type=kind, target_id=target_id)
                                 .with_for_update())
    old = existing.value if existing else 0
    if value == old:
        return jsonify(score=target.score, myVote=old)
    if value == 0:
        db.session.delete(existing)
    elif existing:
        existing.value = value
    else:
        db.session.add(Vote(user_id=user.id, target_type=kind, target_id=target_id, value=value))

    up, down = vote_delta(old, value)
    score = db.session.execute(
        db.update(model).where(model.id == target_id)
        .values(upvotes=model.upvotes + up, downvotes=model.downvotes + down, score=model.score + up - down)
        .returning(model.score)).scalar_one()

    # A little encouragement when a question or answer passes 10, 25, 50... upvotes
    if up > 0 and score in MILESTONES:
        message = f"reached {score} upvotes"
        post = target if kind == "post" else target.post
        seen = db.session.scalar(db.select(Notification.id).filter_by(
            user_id=target.author_id, kind="upvote", post_id=post.id, message=message).limit(1))
        if not seen:
            notify(target.author_id, None, "upvote", post, target if kind == "comment" else None, message=message)
    db.session.commit()
    return jsonify(score=score, myVote=value)
