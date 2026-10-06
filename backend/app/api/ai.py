"""Ask TYM AI: private one-to-one conversations with TYMAi (Module 7).

    GET    /ai/conversations          yours, latest first
    GET    /ai/conversations/<id>     one conversation with its messages
    POST   /ai/messages               {body, conversationId?}; starts a conversation when none is given
    DELETE /ai/conversations/<id>
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db, limiter
from ..models import AiConversation, AiMessage
from ..services import content, tymai
from .posts import member

bp = Blueprint("ai", __name__)

HISTORY = 20  # earlier turns sent with each question


def _conversation(conversation_id):
    c = db.session.get(AiConversation, conversation_id)
    if not c or c.user_id != current_user.id:
        abort(404, "We could not find that conversation.")
    return c


def _messages(c):
    return db.session.scalars(db.select(AiMessage).where(AiMessage.conversation_id == c.id).order_by(AiMessage.id)).all()


def _message(m):
    return {"id": m.id, "role": m.role, "content": m.content, "sources": m.sources or [],
            "createdAt": m.created_at.isoformat()}


def _summary(c):
    return {"id": c.id, "title": c.title, "createdAt": c.created_at.isoformat()}


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
    return jsonify({**_summary(c), "messages": [_message(m) for m in _messages(c)]})


@bp.post("/ai/messages")
@jwt_required()
@limiter.limit("20 per hour; 100 per day")
def ask():
    user = member()
    data = request.get_json(silent=True) or {}
    question, _ = content.clean(data.get("body", ""), 4000)
    if not question:
        abort(400, "Type a question first.")
    if data.get("conversationId"):
        c = _conversation(data["conversationId"])
    else:
        title = question if len(question) <= 60 else question[:60].rsplit(" ", 1)[0] + "..."
        c = AiConversation(user_id=user.id, title=title.replace("\n", " "))
        db.session.add(c)
        db.session.flush()
    history = [{"role": m.role, "content": m.content} for m in _messages(c)[-HISTORY:]]

    mine = AiMessage(conversation_id=c.id, role="user", content=question)
    db.session.add(mine)
    db.session.commit()
    text, sources = tymai.answer(user, question, history)
    reply = AiMessage(conversation_id=c.id, role="assistant", content=text, sources=sources)
    db.session.add(reply)
    db.session.commit()
    return jsonify(conversation=_summary(c), messages=[_message(mine), _message(reply)]), 201


@bp.delete("/ai/conversations/<int:conversation_id>")
@jwt_required()
def delete_conversation(conversation_id):
    db.session.delete(_conversation(conversation_id))
    db.session.commit()
    return jsonify(deleted=True)
