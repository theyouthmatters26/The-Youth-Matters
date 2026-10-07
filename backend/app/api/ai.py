"""Ask TYM AI: private one-to-one conversations with TYMAi (Module 7). A person from the team can
step in (services/handoff.py); the student sees their replies in the same conversation.

    GET    /ai/conversations                       yours, latest first
    GET    /ai/conversations/<id>                  one conversation with its messages
    GET    /ai/conversations/<id>/messages?after=  anything new since `after` (the page polls this)
    POST   /ai/messages                            {body, conversationId?}; starts one when none is given
    POST   /ai/conversations/<id>/human            ask for a person, or {cancel: true} to go back to TYMAi
    DELETE /ai/conversations/<id>
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db, limiter, member_key
from ..models import AiConversation, AiMessage
from ..models.base import utcnow
from ..services import content, handoff, tymai
from .posts import member

bp = Blueprint("ai", __name__)

HISTORY = 20  # earlier turns sent with each question


def _conversation(conversation_id):
    c = db.session.get(AiConversation, conversation_id)
    if not c or c.user_id != current_user.id:
        abort(404, "We could not find that conversation.")
    return c


def _messages(c, after=None):
    q = db.select(AiMessage).where(AiMessage.conversation_id == c.id)
    if after:
        q = q.where(AiMessage.id > after)
    return db.session.scalars(q.order_by(AiMessage.id)).all()


def _summary(c):
    """status: ai, waiting (asked for a person) or human (a person is here, named in `person`)."""
    return {"id": c.id, "title": c.title, "createdAt": c.created_at.isoformat(), "status": c.status,
            "unread": c.user_unread, "person": c.assigned_to.display_name.split()[0] if c.assigned_to else None}


@bp.get("/ai/conversations")
@jwt_required()
def list_conversations():
    rows = db.session.scalars(db.select(AiConversation).where(AiConversation.user_id == current_user.id)
                              .order_by(AiConversation.id.desc()).limit(50))
    return jsonify([_summary(c) for c in rows])


@bp.get("/ai/conversations/<int:conversation_id>")
@jwt_required()
def get_conversation(conversation_id):
    c = _conversation(conversation_id)
    if c.user_unread:
        c.user_unread = False
        db.session.commit()
    return jsonify({**_summary(c), "messages": [handoff.message_json(m) for m in _messages(c)]})


@bp.get("/ai/conversations/<int:conversation_id>/messages")
@jwt_required()
def new_messages(conversation_id):
    c = _conversation(conversation_id)
    fresh = _messages(c, request.args.get("after", type=int))
    if c.user_unread:  # they are looking at it right now
        c.user_unread = False
        db.session.commit()
    return jsonify({**_summary(c), "messages": [handoff.message_json(m) for m in fresh]})


@bp.post("/ai/messages")
@jwt_required()
@limiter.limit("30 per hour; 150 per day", key_func=member_key)
def ask():
    user = member()
    data = request.get_json(silent=True) or {}
    question, _ = content.clean(data.get("body", ""), 4000)
    if not question:
        abort(400, "Type a question first.")
    if data.get("conversationId"):
        if not isinstance(data["conversationId"], int):
            abort(400, "That conversation does not exist.")
        c = _conversation(data["conversationId"])
    else:
        title = question if len(question) <= 60 else question[:60].rsplit(" ", 1)[0] + "..."
        c = AiConversation(user_id=user.id, title=title.replace("\n", " "))
        db.session.add(c)
        db.session.flush()
    earlier = _messages(c)[-HISTORY:]

    sent = [handoff.add_message(c, "user", question)]
    if c.status == "human":
        # A person is handling this one: TYMAi stays quiet and the team hears the student wrote
        handoff.alert_team(c, "replied and is waiting for you")
        db.session.commit()
    else:
        db.session.commit()
        text, sources = tymai.answer(user, question, handoff.as_history(earlier))
        db.session.refresh(c)
        if c.status != "human":  # nobody stepped in while TYMAi was writing
            sent.append(handoff.add_message(c, "assistant", text, sources=sources))
            db.session.commit()
    return jsonify(conversation=_summary(c), messages=[handoff.message_json(m) for m in sent]), 201


@bp.post("/ai/conversations/<int:conversation_id>/human")
@jwt_required()
@limiter.limit("10 per hour")
def ask_for_a_person(conversation_id):
    member()
    c = _conversation(conversation_id)
    if (request.get_json(silent=True) or {}).get("cancel"):
        if c.status == "waiting":
            c.status, c.human_requested_at = "ai", None
    elif c.status == "ai":
        c.status, c.human_requested_at = "waiting", utcnow()
        handoff.alert_team(c, "asked to talk to a person")
    db.session.commit()
    return jsonify(_summary(c))


@bp.delete("/ai/conversations/<int:conversation_id>")
@jwt_required()
def delete_conversation(conversation_id):
    db.session.delete(_conversation(conversation_id))
    db.session.commit()
    return jsonify(deleted=True)
