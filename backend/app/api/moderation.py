"""Reports (Module 8). Admin review of the queue arrives with the admin panel (Phase 3).

    POST /reports   {targetType: post | comment | user, targetId, reason}
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db, limiter
from ..models import Comment, Post, Report, User
from ..services import content

bp = Blueprint("moderation", __name__)
TARGETS = {"post": Post, "comment": Comment, "user": User}


@bp.post("/reports")
@jwt_required()
@limiter.limit("20 per hour")
def report():
    data = request.get_json(silent=True) or {}
    kind, target_id = data.get("targetType"), data.get("targetId")
    reason, _ = content.clean(data.get("reason"), 500)
    if kind not in TARGETS or not isinstance(target_id, int) or not db.session.get(TARGETS[kind], target_id):
        abort(400, "We could not find what you are reporting.")
    if len(reason) < 3:
        abort(400, "Tell us briefly what is wrong.")
    already = db.session.scalar(db.select(Report.id).filter_by(
        reporter_id=current_user.id, target_type=kind, target_id=target_id, status="open"))
    if not already:
        db.session.add(Report(reporter_id=current_user.id, target_type=kind, target_id=target_id, reason=reason))
        db.session.commit()
    return jsonify(ok=True)
