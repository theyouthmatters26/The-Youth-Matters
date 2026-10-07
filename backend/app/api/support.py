"""The support inbox: Ask TYM AI conversations, and a person from the team stepping into them.

    GET  /admin/support/conversations?filter=open|all&q=&page=     open = asked for a person, or with one
    GET  /admin/support/conversations/<id>                 the thread and who the student is
    GET  /admin/support/conversations/<id>/messages?after= new messages since `after` (the page polls)
    POST /admin/support/conversations/<id>/messages        {body}: reply as yourself; TYMAi goes quiet
    POST /admin/support/conversations/<id>/status          {status: human | ai}: step in, or hand back
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import AiConversation, AiMessage, Comment, Post, User
from ..services import content, handoff
from . import serializers as s
from .admin import count, paged, team_member, waiting_for_a_person

bp = Blueprint("support", __name__)


def _conversation(conversation_id):
    c = db.session.get(AiConversation, conversation_id)
    if not c:
        abort(404, "That conversation no longer exists. The student may have deleted it.")
    return c


def _row(c):
    return {"id": c.id, "title": c.title, "status": c.status, "student": {**s.user_brief(c.user), "email": c.user.email},
            "preview": c.last_preview, "lastRole": c.last_role,
            "lastAt": (c.last_message_at or c.created_at).isoformat(),
            "assignedTo": c.assigned_to.display_name if c.assigned_to else None,
            "needsReply": c.status == "waiting" or (c.status == "human" and c.last_role == "user")}


def _since(c, after):
    q = db.select(AiMessage).where(AiMessage.conversation_id == c.id)
    if after:
        q = q.where(AiMessage.id > after)
    return [handoff.message_json(m) for m in db.session.scalars(q.order_by(AiMessage.id))]


@bp.get("/admin/support/conversations")
@jwt_required()
def inbox():
    team_member("support")
    q = db.select(AiConversation).where(AiConversation.last_message_at.isnot(None))
    if request.args.get("filter", "open") == "open":
        q = q.where(AiConversation.status.in_(("waiting", "human")))
    term = request.args.get("q", "").strip()
    if term:
        like = f"%{term}%"
        q = q.join(User, AiConversation.user_id == User.id).where(
            AiConversation.title.ilike(like) | User.display_name.ilike(like) | User.email.ilike(like))
    # Whoever is waiting for a reply comes first
    return jsonify(**paged(q.order_by(waiting_for_a_person().desc(), AiConversation.last_message_at.desc()), _row),
                   waiting=count(waiting_for_a_person()))


@bp.get("/admin/support/conversations/<int:conversation_id>")
@jwt_required()
def conversation(conversation_id):
    team_member("support")
    c = _conversation(conversation_id)
    u = c.user
    return jsonify({
        **_row(c), "messages": _since(c, None),
        "about": {"username": u.username, "status": u.status, "joinedAt": u.created_at.isoformat(),
                  "country": u.target_country.name if u.target_country else None, "studyLevel": u.study_level,
                  "university": u.university, "course": u.course, "intake": u.intake,
                  "questions": count(Post.author_id == u.id, ~Post.is_deleted),
                  "answers": count(Comment.author_id == u.id, ~Comment.is_deleted)},
    })


@bp.get("/admin/support/conversations/<int:conversation_id>/messages")
@jwt_required()
def new_messages(conversation_id):
    team_member("support")
    c = _conversation(conversation_id)
    row = _row(c)
    return jsonify(status=row["status"], assignedTo=row["assignedTo"], needsReply=row["needsReply"],
                   messages=_since(c, request.args.get("after", type=int)))


@bp.post("/admin/support/conversations/<int:conversation_id>/messages")
@jwt_required()
def reply(conversation_id):
    me = team_member("support")
    c = _conversation(conversation_id)
    text, _ = content.clean((request.get_json(silent=True) or {}).get("body", ""), 4000)
    if not text:
        abort(400, "Write a reply first.")
    handoff.tell_student(c, me, text)  # before the message is added: it looks at when a person last wrote
    m = handoff.add_message(c, "human", text, author=me)
    c.status, c.assigned_to_id = "human", me.id
    db.session.commit()
    return jsonify(conversation=_row(c), message=handoff.message_json(m)), 201


@bp.post("/admin/support/conversations/<int:conversation_id>/status")
@jwt_required()
def set_status(conversation_id):
    """human: step in without writing yet (TYMAi stops answering). ai: hand the student back to TYMAi."""
    me = team_member("support")
    c = _conversation(conversation_id)
    status = (request.get_json(silent=True) or {}).get("status")
    if status == "human":
        c.status, c.assigned_to_id = "human", me.id
    elif status == "ai":
        c.status, c.assigned_to_id, c.human_requested_at = "ai", None, None
    else:
        abort(400, "Choose human or ai.")
    db.session.commit()
    return jsonify(_row(c))
