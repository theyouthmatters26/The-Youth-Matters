"""In-app notification centre (Module 9).

    GET  /notifications?page=          newest first, with the unread count
    GET  /notifications/unread         just the count, for the bell in the header
    POST /notifications/read           {ids: [...]} or nothing to mark everything read
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db
from ..models import Notification
from . import serializers as s

bp = Blueprint("notifications", __name__)


def _unread():
    return db.session.scalar(db.select(db.func.count(Notification.id))
                             .filter_by(user_id=current_user.id, is_read=False))


@bp.get("/notifications")
@jwt_required()
def list_notifications():
    page = max(request.args.get("page", 1, type=int), 1)
    q = db.select(Notification).filter_by(user_id=current_user.id).order_by(Notification.created_at.desc())
    rows = db.paginate(q, page=page, per_page=30, error_out=False)
    return jsonify(items=[s.notification(n) for n in rows.items], unread=_unread(), page=page, hasMore=rows.has_next)


@bp.get("/notifications/unread")
@jwt_required()
def unread_count():
    return jsonify(unread=_unread())


@bp.post("/notifications/read")
@jwt_required()
def mark_read():
    ids = (request.get_json(silent=True) or {}).get("ids")
    q = db.update(Notification).where(Notification.user_id == current_user.id, ~Notification.is_read)
    if isinstance(ids, list):
        q = q.where(Notification.id.in_([i for i in ids if isinstance(i, int)]))
    db.session.execute(q.values(is_read=True))
    db.session.commit()
    return jsonify(unread=_unread())
