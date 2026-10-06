"""Public chat rooms (Module 7). The page polls for new messages; app/sockets can push the same
payloads later without changing these routes.

    GET    /chat/rooms                         every room, its latest message and who was active today
    GET    /chat/rooms/<slug>/messages?after=  the last 50 messages, or only those newer than `after`
    POST   /chat/rooms/<slug>/messages         {body}; a message that mentions @TYMAi gets an answer
    DELETE /chat/messages/<id>                 remove your own message
"""
import re
from datetime import timedelta

from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db, limiter
from ..models import ChatMessage, ChatRoom, User
from ..models.base import utcnow
from ..services import content, tymai
from . import serializers as s
from .posts import member, viewer

bp = Blueprint("chat", __name__)

HISTORY = 50
ASKS_TYMAI = re.compile(r"(?<![\w@])@tymai\b", re.I)


def _room(slug):
    room = db.session.scalar(db.select(ChatRoom).where(ChatRoom.slug == slug, ChatRoom.is_active))
    if not room:
        abort(404, "We could not find that chat room.")
    return room


def _message(m):
    return {"id": m.id, "author": s.user_brief(m.author), "body": m.body, "sources": m.sources or [],
            "createdAt": m.created_at.isoformat()}


@bp.get("/chat/rooms")
def list_rooms():
    """Visitors see the rooms and how busy they are; message previews are for members."""
    user = viewer()
    since = utcnow() - timedelta(hours=24)
    rooms = db.session.scalars(db.select(ChatRoom).where(ChatRoom.is_active).order_by(ChatRoom.id))
    out = []
    # ponytail: two small queries per room; fine for a handful of rooms, group them if rooms reach dozens
    for r in rooms:
        last = db.session.scalar(db.select(ChatMessage).where(ChatMessage.room_id == r.id, ~ChatMessage.is_deleted)
                                 .order_by(ChatMessage.id.desc()).limit(1))
        active = db.session.scalar(db.select(db.func.count(db.distinct(ChatMessage.author_id))).where(
            ChatMessage.room_id == r.id, ChatMessage.created_at >= since, ~ChatMessage.is_deleted))
        out.append({
            "slug": r.slug, "name": r.name, "description": r.description,
            "country": r.community.country.slug if r.community else None,
            "activeToday": active,
            "lastAt": last.created_at.isoformat() if last else None,
            "last": _message(last) if last and user else None,
        })
    return jsonify(out)


@bp.get("/chat/rooms/<slug>/messages")
@jwt_required()
def list_messages(slug):
    room = _room(slug)
    q = db.select(ChatMessage).where(ChatMessage.room_id == room.id, ~ChatMessage.is_deleted)
    after = request.args.get("after", type=int)
    if after:
        rows = db.session.scalars(q.where(ChatMessage.id > after).order_by(ChatMessage.id).limit(HISTORY))
    else:
        rows = reversed(db.session.scalars(q.order_by(ChatMessage.id.desc()).limit(HISTORY)).all())
    return jsonify([_message(m) for m in rows])


@bp.post("/chat/rooms/<slug>/messages")
@jwt_required()
@limiter.limit("20 per minute; 300 per day")
def send_message(slug):
    user = member()
    room = _room(slug)
    body, _ = content.clean((request.get_json(silent=True) or {}).get("body", ""), 1000)
    if not body:
        abort(400, "Write a message first.")
    sent = [ChatMessage(room_id=room.id, author_id=user.id, body=body)]
    db.session.add(sent[0])
    db.session.commit()

    if ASKS_TYMAI.search(body):
        bot = db.session.scalar(db.select(User).where(User.username == "tymai"))
        question = ASKS_TYMAI.sub("", body).strip()
        if bot and question:
            text, sources = tymai.answer(user, question, brief=True)
            sent.append(ChatMessage(room_id=room.id, author_id=bot.id, body=f"@{user.username} {text}",
                                    sources=sources))
            db.session.add(sent[-1])
            db.session.commit()
    return jsonify([_message(m) for m in sent]), 201


@bp.delete("/chat/messages/<int:message_id>")
@jwt_required()
def delete_message(message_id):
    m = db.session.get(ChatMessage, message_id)
    if not m or m.is_deleted:
        abort(404, "That message is already gone.")
    if m.author_id != current_user.id and current_user.role != "admin":
        abort(403, "You can only delete your own messages.")
    m.is_deleted = True
    db.session.commit()
    return jsonify(deleted=True)
