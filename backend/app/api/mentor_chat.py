"""Private messages between a student and a mentor they have booked.

    GET  /mentor-chats                                    my conversations, as a student and as a mentor
    GET  /mentor-chats/<mentor_id>/<student_id>/messages  ?after=<id> for only the new ones; marks them read
    POST /mentor-chats/<mentor_id>/<student_id>/messages  {body}

A conversation opens with the first booking (confirmed or completed) between the two and is only
ever seen by them. The page polls, like the public chat rooms.
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from markupsafe import escape

from ..extensions import db, limiter, member_key
from ..models import Booking, MentorMessage, MentorProfile, User
from ..models.base import utcnow
from ..services import content, handoff, mailer
from . import serializers as s
from .posts import member

bp = Blueprint("mentor_chat", __name__)

HISTORY = 100
BOOKED = Booking.status.in_(("confirmed", "completed"))


def _message(m):
    return {"id": m.id, "authorId": m.author_id, "body": m.body, "createdAt": m.created_at.isoformat()}


def _thread(mentor_id, student_id):
    """The mentor of a conversation the current user is one side of, or 404/403."""
    mentor = db.session.get(MentorProfile, mentor_id)
    if not mentor or current_user.id not in (student_id, mentor.user_id) or student_id == mentor.user_id:
        abort(404, "We could not find that conversation.")
    booked = db.session.scalar(db.select(Booking.id).where(
        Booking.mentor_id == mentor_id, Booking.student_id == student_id, BOOKED).limit(1))
    if not booked:
        abort(403, "You can message a mentor once you have booked a session with them.")
    return mentor


def _in_thread(mentor_id, student_id):
    return db.and_(MentorMessage.mentor_id == mentor_id, MentorMessage.student_id == student_id)


@bp.get("/mentor-chats")
@jwt_required()
def conversations():
    me = current_user.id
    pairs = db.session.execute(
        db.select(Booking.mentor_id, Booking.student_id, db.func.max(Booking.id))
        .join(MentorProfile, Booking.mentor_id == MentorProfile.id)
        .where(BOOKED, db.or_(Booking.student_id == me, MentorProfile.user_id == me))
        .group_by(Booking.mentor_id, Booking.student_id)).all()
    out = []
    # ponytail: three small queries per conversation; fine for a person's handful, group them if that grows
    for mentor_id, student_id, _ in pairs:
        mentor = db.session.get(MentorProfile, mentor_id)
        as_mentor = mentor.user_id == me
        other = db.session.get(User, student_id) if as_mentor else mentor.user
        last = db.session.scalar(db.select(MentorMessage).where(_in_thread(mentor_id, student_id))
                                 .order_by(MentorMessage.id.desc()).limit(1))
        unread = db.session.scalar(db.select(db.func.count(MentorMessage.id)).where(
            _in_thread(mentor_id, student_id), MentorMessage.author_id != me, MentorMessage.read_at.is_(None)))
        out.append({"mentorId": mentor_id, "studentId": student_id, "asMentor": as_mentor, "with": s.user_brief(other),
                    "last": _message(last) if last else None, "unread": unread})
    out.sort(key=lambda c: c["last"]["createdAt"] if c["last"] else "", reverse=True)
    return jsonify(out)


@bp.get("/mentor-chats/<int:mentor_id>/<int:student_id>/messages")
@jwt_required()
def messages(mentor_id, student_id):
    _thread(mentor_id, student_id)
    q = db.select(MentorMessage).where(_in_thread(mentor_id, student_id))
    after = request.args.get("after", type=int)
    if after:
        rows = db.session.scalars(q.where(MentorMessage.id > after).order_by(MentorMessage.id)).all()
    else:
        rows = db.session.scalars(q.order_by(MentorMessage.id.desc()).limit(HISTORY)).all()[::-1]
    db.session.execute(db.update(MentorMessage).where(
        _in_thread(mentor_id, student_id), MentorMessage.author_id != current_user.id, MentorMessage.read_at.is_(None))
        .values(read_at=utcnow()))
    db.session.commit()
    return jsonify([_message(m) for m in rows])


@bp.post("/mentor-chats/<int:mentor_id>/<int:student_id>/messages")
@jwt_required()
@limiter.limit("60 per hour", key_func=member_key)
def send(mentor_id, student_id):
    member()
    _thread(mentor_id, student_id)
    body, _ = content.clean((request.get_json(silent=True) or {}).get("body"), 2000)
    if not body:
        abort(400, "Write a message first.")
    mentor = db.session.get(MentorProfile, mentor_id)
    other = mentor.user if current_user.id == student_id else db.session.get(User, student_id)
    # One email when a run of messages starts, not one per message: nothing from this person is waiting unread
    waiting = db.session.scalar(db.select(MentorMessage.id).where(
        _in_thread(mentor_id, student_id), MentorMessage.author_id == current_user.id, MentorMessage.read_at.is_(None)).limit(1))
    m = MentorMessage(mentor_id=mentor_id, student_id=student_id, author_id=current_user.id, body=body)
    db.session.add(m)
    db.session.commit()
    if not waiting:
        link = f"{handoff.site_url()}/u/{other.username}?tab=Messages&with={mentor_id}-{student_id}"
        mailer.send_quietly(other.email, f"New message from {current_user.display_name}",
                            f"<p>Hi {escape(other.display_name.split()[0])},</p>"
                            f"<p>{escape(current_user.display_name)} sent you a message on The Youth Matters:</p>"
                            f"<blockquote>{escape(body)}</blockquote><p>Reply here: <a href='{link}'>{link}</a></p>")
    return jsonify([_message(m)]), 201
