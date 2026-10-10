"""Private chat between a student and a mentor.

    GET  /mentor-chats                                    my conversations, as a student and as a mentor
    GET  /mentor-chats/<mentor_id>/<student_id>           one conversation on its own (after a refresh)
    GET  /mentor-chats/<mentor_id>/<student_id>/messages  ?after=<id> for only the new ones; marks them read
    POST /mentor-chats/<mentor_id>/<student_id>/messages  {body}
    POST /mentor-chats/<mentor_id>/<student_id>/accept    the mentor opens the conversation
    POST /mentor-chats/<mentor_id>/<student_id>/decline   the mentor turns it down
    POST /mentor-chats/<mentor_id>/<student_id>/meeting   {url}: the mentor shares the video call link

How it opens: the student pays for a session, which sends the mentor a request (MentorThread,
pending). Nobody can write until the mentor accepts it from their dashboard. After that both can
write, and the page polls for new messages the way the public chat rooms do.

Only the mentor can put a video call link in the conversation: a student's message with one is
refused, so nobody can be talked into joining a call somewhere else.
"""
import re

from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from markupsafe import escape

from ..extensions import db, limiter, member_key
from ..models import AvailabilitySlot, Booking, MentorMessage, MentorProfile, MentorThread, User
from ..models.base import utcnow
from ..services import content, handoff, mailer
from ..services.notify import notify
from . import serializers as s
from .posts import member

bp = Blueprint("mentor_chat", __name__)

HISTORY = 100
BOOKED = Booking.status.in_(("confirmed", "completed"))

# Video call links. A mentor may share one; a student's message that holds one is refused.
MEETING_LINK = re.compile(
    r"\b(?:https?://)?(?:[\w-]+\.)*(?:meet\.google\.com|zoom\.us|teams\.(?:microsoft|live)\.com|"
    r"meet\.jit\.si|whereby\.com|webex\.com|skype\.com|join\.skype\.com|discord\.gg)/\S*", re.I)
# What a mentor may share as the call link: Google Meet, or the link the booking already carries.
MEETING_HOST = re.compile(r"^https://(?:meet\.google\.com|meet\.jit\.si|[\w-]+\.zoom\.us|teams\.microsoft\.com)/\S+$", re.I)


def _message(m):
    return {"id": m.id, "authorId": m.author_id, "body": m.body, "kind": m.kind,
            "readAt": m.read_at.isoformat() if m.read_at else None, "createdAt": m.created_at.isoformat()}


def _in_thread(mentor_id, student_id):
    return db.and_(MentorMessage.mentor_id == mentor_id, MentorMessage.student_id == student_id)


def open_thread(mentor_id, student_id, note=None):
    """The conversation a paid booking opens, made on the first booking and kept after that.
    Returns (thread, is_new) so the caller can tell the mentor about a new request."""
    t = db.session.scalar(db.select(MentorThread).filter_by(mentor_id=mentor_id, student_id=student_id))
    if t:
        if t.status == "declined":  # a new booking asks again
            t.status, t.decided_at, t.request_note = "pending", None, note or t.request_note
            return t, True
        return t, False
    t = MentorThread(mentor_id=mentor_id, student_id=student_id, status="pending", request_note=note)
    db.session.add(t)
    return t, True


def _thread(mentor_id, student_id, mentor_only=False):
    """(mentor profile, thread) for a conversation the current user is one side of, or 404/403."""
    mentor = db.session.get(MentorProfile, mentor_id)
    if not mentor or current_user.id not in (student_id, mentor.user_id) or student_id == mentor.user_id:
        abort(404, "We could not find that conversation.")
    t = db.session.scalar(db.select(MentorThread).filter_by(mentor_id=mentor_id, student_id=student_id))
    if not t:
        abort(403, "You can message a mentor once you have booked a session with them.")
    if mentor_only and mentor.user_id != current_user.id:
        abort(403, "Only the mentor can do that.")
    return mentor, t


def _session(mentor_id, student_id):
    """The session these two are in, or the next one they have. Going past here is what notices a
    session has run over, so the mentor is told without anything running on a timer."""
    from .bookings import time_is_up  # here, not at the top: bookings opens the conversation

    now = utcnow()
    b = db.session.scalar(
        db.select(Booking).join(AvailabilitySlot, Booking.slot_id == AvailabilitySlot.id)
        .where(Booking.mentor_id == mentor_id, Booking.student_id == student_id,
               Booking.status == "confirmed")
        .order_by(AvailabilitySlot.starts_at).limit(1))
    if not b:
        return None
    if time_is_up(b):
        db.session.commit()
    return {"id": b.id, "state": s.session_state(b, now), "startsAt": b.slot.starts_at.isoformat(),
            "endsAt": b.slot.ends_at.isoformat(), "minutes": b.minutes_deducted or b.mentor.session_minutes}


def _conversation(t, mentor, me, other, last=None, unread=0):
    as_mentor = mentor.user_id == me
    return {"mentorId": t.mentor_id, "studentId": t.student_id, "asMentor": as_mentor,
            "with": s.user_brief(other), "status": t.status, "requestNote": t.request_note,
            "meetingUrl": t.meeting_url, "canWrite": t.status == "accepted",
            "canShareMeeting": as_mentor and t.status == "accepted",
            "session": _session(t.mentor_id, t.student_id) if t.status == "accepted" else None,
            "last": _message(last) if last else None, "unread": unread}


def _other(mentor, student_id, as_mentor):
    return db.session.get(User, student_id) if as_mentor else mentor.user


@bp.get("/mentor-chats")
@jwt_required()
def conversations():
    me = current_user.id
    threads = db.session.scalars(
        db.select(MentorThread).join(MentorProfile, MentorThread.mentor_id == MentorProfile.id)
        .where(db.or_(MentorThread.student_id == me, MentorProfile.user_id == me))).all()
    out = []
    # ponytail: two small queries per conversation; fine for a person's handful, group them if that grows
    for t in threads:
        mentor = t.mentor
        last = db.session.scalar(db.select(MentorMessage).where(_in_thread(t.mentor_id, t.student_id))
                                 .order_by(MentorMessage.id.desc()).limit(1))
        unread = db.session.scalar(db.select(db.func.count(MentorMessage.id)).where(
            _in_thread(t.mentor_id, t.student_id), MentorMessage.author_id != me, MentorMessage.read_at.is_(None)))
        out.append(_conversation(t, mentor, me, _other(mentor, t.student_id, mentor.user_id == me), last, unread))
    # Requests waiting on the mentor come first, then whoever wrote most recently
    out.sort(key=lambda c: (c["asMentor"] and c["status"] == "pending",
                            c["last"]["createdAt"] if c["last"] else ""), reverse=True)
    return jsonify(out)


@bp.get("/mentor-chats/<int:mentor_id>/<int:student_id>")
@jwt_required()
def conversation(mentor_id, student_id):
    mentor, t = _thread(mentor_id, student_id)
    me = current_user.id
    return jsonify(_conversation(t, mentor, me, _other(mentor, student_id, mentor.user_id == me)))


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


def _tell(other, subject, html):
    mailer.send_quietly(other.email, subject,
                        f"<p>Hi {escape(other.display_name.split()[0])},</p>{html}")


def _chat_link(mentor_id, student_id, username):
    return f"{handoff.site_url()}/u/{username}?tab=Messages&with={mentor_id}-{student_id}"


@bp.post("/mentor-chats/<int:mentor_id>/<int:student_id>/messages")
@jwt_required()
@limiter.limit("60 per hour", key_func=member_key)
def send(mentor_id, student_id):
    member()
    mentor, t = _thread(mentor_id, student_id)
    if t.status == "pending":
        abort(409, "This mentor has not opened the conversation yet." if current_user.id == student_id
                   else "Accept the request first, then you can reply.")
    if t.status == "declined":
        abort(409, "This conversation is closed.")
    body, _ = content.clean((request.get_json(silent=True) or {}).get("body"), 2000)
    if not body:
        abort(400, "Write a message first.")

    as_mentor = mentor.user_id == current_user.id
    link = MEETING_LINK.search(body)
    if link and not as_mentor:
        abort(400, "Only your mentor can share a video call link here. Ask them to send it in this chat, "
                   "and never join a call from anywhere else.")
    kind = "meeting" if link else "text"
    other = _other(mentor, student_id, as_mentor)
    # One email when a run of messages starts, not one per message: nothing from this person is waiting unread
    waiting = db.session.scalar(db.select(MentorMessage.id).where(
        _in_thread(mentor_id, student_id), MentorMessage.author_id == current_user.id,
        MentorMessage.read_at.is_(None)).limit(1))
    m = MentorMessage(mentor_id=mentor_id, student_id=student_id, author_id=current_user.id, body=body, kind=kind)
    db.session.add(m)
    if kind == "meeting":
        t.meeting_url = link.group(0) if link.group(0).startswith("http") else f"https://{link.group(0)}"
    if not waiting:  # one notification and one email when a run of messages starts, not one each
        notify(other.id, current_user, "message", message=f"sent you a message: {body[:120]}")
    db.session.commit()
    if not waiting:
        url = _chat_link(mentor_id, student_id, other.username)
        _tell(other, f"New message from {current_user.display_name}",
              f"<p>{escape(current_user.display_name)} sent you a message on The Youth Matters:</p>"
              f"<blockquote>{escape(body)}</blockquote><p>Reply here: <a href='{url}'>{url}</a></p>")
    return jsonify([_message(m)]), 201


@bp.post("/mentor-chats/<int:mentor_id>/<int:student_id>/<any(accept, decline):decision>")
@jwt_required()
@limiter.limit("60 per hour", key_func=member_key)
def decide(mentor_id, student_id, decision):
    """The mentor opens the conversation, or turns it down. Only they can."""
    member()
    mentor, t = _thread(mentor_id, student_id, mentor_only=True)
    if t.status != "pending":
        abort(409, "You have already answered this request.")
    t.status = "accepted" if decision == "accept" else "declined"
    t.decided_at = utcnow()
    student = db.session.get(User, student_id)
    if decision == "accept":
        db.session.add(MentorMessage(
            mentor_id=mentor_id, student_id=student_id, author_id=current_user.id, kind="system",
            body=f"{current_user.display_name} accepted the chat request. You can message each other now."))
    notify(student_id, current_user, "message",
           message="opened your chat" if decision == "accept" else "could not take your chat request")
    db.session.commit()
    url = _chat_link(mentor_id, student_id, student.username)
    _tell(student, f"{current_user.display_name} {'opened your chat' if decision == 'accept' else 'could not open a chat'}",
          f"<p>{escape(current_user.display_name)} accepted your chat request. Message them here: "
          f"<a href='{url}'>{url}</a></p>" if decision == "accept" else
          "<p>Your mentor could not open a chat before your session. You will still meet on the video call "
          "at the time you booked.</p>")
    return jsonify(_conversation(t, mentor, current_user.id, student))


@bp.post("/mentor-chats/<int:mentor_id>/<int:student_id>/meeting")
@jwt_required()
@limiter.limit("30 per hour", key_func=member_key)
def share_meeting(mentor_id, student_id):
    """The mentor shares the video call link. Students never send links, so the one in the chat is theirs."""
    member()
    mentor, t = _thread(mentor_id, student_id, mentor_only=True)
    if t.status != "accepted":
        abort(409, "Accept the request first, then you can share the call link.")
    url = str((request.get_json(silent=True) or {}).get("url") or "").strip()[:255]
    if not MEETING_HOST.match(url):
        abort(400, "Paste a Google Meet, Zoom or Teams link, starting with https://.")
    t.meeting_url = url
    m = MentorMessage(mentor_id=mentor_id, student_id=student_id, author_id=current_user.id,
                      kind="meeting", body=url)
    db.session.add(m)
    student = db.session.get(User, student_id)
    notify(student_id, current_user, "message", message="shared the video call link with you")
    db.session.commit()
    _tell(student, f"{current_user.display_name} shared your call link",
          f"<p>Your mentor shared the link for your session: <a href='{escape(url)}'>{escape(url)}</a></p>")
    return jsonify(_message(m)), 201
