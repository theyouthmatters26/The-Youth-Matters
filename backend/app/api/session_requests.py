"""Session requests: booking a mentor while payment is still arranged by hand.

    POST  /session-requests                 the booking form. Open to anyone, account or not.
    GET   /admin/session-requests?status=   the team's queue            (area "bookings")
    POST  /admin/session-requests           the team books one themselves, for a student who
                                            asked by WhatsApp or email instead of using the form
    PATCH /admin/session-requests/<id>      {mentorId, startsAt, minutes, note, status, end}
    POST  /session-requests/<id>/end        the mentor closes their own session

The flow the team asked for, in one place:

    student sends the form  ->  we email them, the team, and the mentor they asked for
    team assigns a mentor   ->  that mentor is told a student is waiting
    team confirms           ->  both sides are emailed and the chat between them opens

Confirming is what opens the chat (api/mentor_chat.py), because that is where the session happens.
A request from someone with no account keeps working, except for the chat: there is nobody to open
it with, so they are asked to sign up with the same email address.
"""
from datetime import datetime, timedelta, timezone

from flask import Blueprint, abort, current_app, jsonify, request
from flask_jwt_extended import current_user, jwt_required, verify_jwt_in_request
from markupsafe import escape

from ..extensions import db, limiter
from ..models import CounselingPackage, MentorMessage, MentorProfile, SessionRequest, User
from ..models.base import utcnow
from ..services import mailer
from ..services.notify import notify
from .admin import paged, team_member
from .auth import EMAIL
from .mentor_chat import open_thread

MINUTES = (30, 45, 60, 90, 120, 180, 240)

bp = Blueprint("session_requests", __name__)

MAX_ANSWERS = 30
ANSWER_LEN = 500
STATUSES = ("new", "assigned", "confirmed", "cancelled")
OPEN = ("new", "assigned")


def _text(value, limit):
    return str(value or "").replace("\r\n", "\n").strip()[:limit]


def _site():
    return current_app.config.get("SITE_URL") or ""


def _mentor_name(m):
    return m.user.display_name if m and m.user else "a TYM mentor"


def _said(row):
    """When the session runs, written the way a person reads it. Both emails carry the same line."""
    if not row.starts_at:
        return ""
    at = row.starts_at
    # The day number is written out rather than formatted, because "%-d" is not portable to Windows
    when = f"{at:%A} {at.day} {at:%B} at {at:%H:%M} UTC"
    return _para("When", f"{when} ({row.minutes or 60} minutes)")


def _para(label, value):
    return f"<p><b>{label}:</b> {escape(value)}</p>" if value else ""


def _rows(answers):
    return "".join(_para(escape(str(k))[:60], str(v)[:ANSWER_LEN]) for k, v in (answers or {}).items() if v)


def _signed_in():
    """The member sending the form, when they happen to be logged in. Never required."""
    try:
        verify_jwt_in_request(optional=True)
        return current_user if current_user and current_user.status == "active" else None
    except Exception:  # noqa: BLE001  a stale or broken token is simply "not logged in"
        return None


def _account(email):
    return db.session.scalar(db.select(User).where(db.func.lower(User.email) == email.lower()))


def _when(value):
    """An ISO date and time from the admin form, kept as UTC. Empty means no time agreed yet."""
    if not value:
        return None
    try:
        when = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        abort(400, "That is not a date and time we understand.")
    return when if when.tzinfo else when.replace(tzinfo=timezone.utc)


def _numbered(data, key):
    value = data.get(key)
    return value if isinstance(value, int) else None


def _public(r):
    return {"id": r.id, "status": r.status, "mentor": _mentor_name(r.mentor) if r.mentor_id else None}


def _admin(r):
    return {
        "id": r.id, "name": r.name, "email": r.email, "whatsapp": r.whatsapp,
        "status": r.status, "message": r.message, "answers": r.answers or {},
        "note": r.note, "at": r.created_at.isoformat(),
        "confirmedAt": r.confirmed_at.isoformat() if r.confirmed_at else None,
        "hasAccount": r.student_id is not None,
        "startsAt": r.starts_at.isoformat() if r.starts_at else None,
        "minutes": r.minutes,
        "endedAt": r.ended_at.isoformat() if r.ended_at else None,
        "package": r.package.title if r.package_id else None,
        "hours": r.package.hours if r.package_id else None,
        "wantedMentor": {"id": r.wanted_mentor_id, "name": _mentor_name(r.wanted_mentor)} if r.wanted_mentor_id else None,
        "mentor": {"id": r.mentor_id, "name": _mentor_name(r.mentor)} if r.mentor_id else None,
    }


# ---------------------------------------------------------------- the booking form


@bp.post("/session-requests")
@limiter.limit("5 per hour")
def ask():
    data = request.get_json(silent=True) or {}
    name, email = _text(data.get("name"), 80), _text(data.get("email"), 255)
    if not 2 <= len(name) <= 80:
        abort(400, "Enter your name.")
    if not EMAIL.match(email):
        abort(400, "Enter a valid email address so we can reply.")

    wanted = db.session.get(MentorProfile, _numbered(data, "mentorId") or 0)
    if wanted and not wanted.is_verified:
        wanted = None  # a mentor who is no longer in the directory cannot be asked for
    package = db.session.get(CounselingPackage, _numbered(data, "packageId") or 0)
    answers = data.get("answers") if isinstance(data.get("answers"), dict) else {}

    me = _signed_in()
    # Tied to an account by email even when the form was filled in logged out: that is the account
    # the chat opens on once the team confirms it.
    student = me if me and me.email.lower() == email.lower() else \
        _account(email)

    row = SessionRequest(
        name=name, email=email.lower(), whatsapp=_text(data.get("whatsapp"), 30),
        student_id=student.id if student else None,
        wanted_mentor_id=wanted.id if wanted else None,
        package_id=package.id if package else None,
        message=_text(data.get("message"), 4000) or None,
        answers={str(k)[:60]: str(v)[:ANSWER_LEN] for k, v in list(answers.items())[:MAX_ANSWERS] if v} or None,
    )
    db.session.add(row)
    db.session.commit()

    _tell_everyone(row, wanted)
    return jsonify(_public(row)), 201


def _tell_everyone(row, wanted):
    """The three emails a new request sends: the team's, the student's, and the mentor's."""
    mailer.send_quietly(
        current_app.config["CONTACT_EMAIL"], f"[Session request] {row.name}",
        f"<p>From {escape(row.name)} &lt;{escape(row.email)}&gt;</p>"
        + _para("Asked for", _mentor_name(wanted) if wanted else None)
        + _para("Plan", row.package.title if row.package_id else None)
        + _rows(row.answers)
        + f"<p>{escape(row.message or '')}</p>"
        + f"<p><a href='{_site()}/admin/sessions'>Open it in the admin panel</a></p>",
        reply_to=row.email)

    first = escape(row.name.split()[0])
    with_who = f" with {escape(_mentor_name(wanted))}" if wanted else ""
    mailer.send_quietly(
        row.email, "We have your session request",
        f"<p>Thanks {first}, we have your request for a mentorship session{with_who}.</p>"
        "<p>Our team is arranging it now. We will email you and message you on WhatsApp with your "
        "mentor, a confirmed time and how to pay, usually within a day.</p>"
        "<p>Your session is not booked until that confirmation reaches you.</p>",
        reply_to=current_app.config["CONTACT_EMAIL"])

    if wanted:
        _tell_the_mentor(row, wanted, asked_for=True)


def _tell_the_mentor(row, mentor, asked_for=False):
    """A student is waiting for this mentor: sent when they are asked for, and when assigned."""
    if not (mentor and mentor.user):
        return
    who = escape(mentor.user.display_name.split()[0]) if mentor.user.display_name else "there"
    line = ("A student has asked to book a session with you." if asked_for
            else "Our team has matched you with a student who asked for a session.")
    notify(mentor.user_id, None, "booking",
           message=f"{row.name} asked for a session with you. Our team is arranging it.")
    mailer.send_quietly(
        mentor.user.email, "A student has asked for a session with you",
        f"<p>Hi {who},</p><p>{line}</p>"
        + _para("Student", row.name)
        + _para("They want to cover", row.message)
        + "<p>Our team is agreeing a time and payment with them. You will hear from us again when "
          "it is confirmed, and your chat with them opens at the same time.</p>"
        + f"<p><a href='{_site()}/my/sessions'>Open your TYM dashboard</a></p>",
        reply_to=current_app.config["CONTACT_EMAIL"])


# ---------------------------------------------------------------- the team's queue


@bp.get("/admin/session-requests")
@jwt_required()
def queue():
    team_member("bookings")
    status = request.args.get("status", "open")
    rows = db.select(SessionRequest).order_by(SessionRequest.id.desc())
    if status in STATUSES:
        rows = rows.where(SessionRequest.status == status)
    else:
        rows = rows.where(SessionRequest.status.in_(OPEN))
    waiting = db.select(db.func.count(SessionRequest.id)).where(SessionRequest.status.in_(OPEN))
    return jsonify(**paged(rows, _admin), waiting=db.session.scalar(waiting))


@bp.post("/admin/session-requests")
@jwt_required()
def book_for_them():
    """A session the team arranged off the site, for somebody who asked by WhatsApp or email.

    Same ending as the form: giving it a mentor books it, so it is created confirmed and both
    sides are told at once."""
    me = team_member("bookings")
    data = request.get_json(silent=True) or {}
    name, email = _text(data.get("name"), 80), _text(data.get("email"), 255)
    if not 2 <= len(name) <= 80:
        abort(400, "Enter the student's name.")
    if not EMAIL.match(email):
        abort(400, "Enter the student's email address.")
    mentor = db.session.get(MentorProfile, _numbered(data, "mentorId") or 0)         or abort(400, "Choose the mentor taking this session.")
    if not mentor.is_verified:
        abort(400, "That mentor is not in the directory yet.")

    student = _account(email)
    row = SessionRequest(
        name=name, email=email.lower(), whatsapp=_text(data.get("whatsapp"), 30),
        student_id=student.id if student else None, mentor_id=mentor.id,
        package_id=_numbered(data, "packageId"),
        message=_text(data.get("message"), 4000) or None,
        note=_text(data.get("note"), 500) or None,
        starts_at=_when(data.get("startsAt")),
        minutes=_numbered(data, "minutes") if _numbered(data, "minutes") in MINUTES else 60,
        answers={"Arranged by": me.display_name, "Came from": "Off the site"},
        status="confirmed", confirmed_at=utcnow(), handled_by_id=me.id)
    db.session.add(row)
    db.session.flush()
    _confirm(row)
    db.session.commit()
    return jsonify(_admin(row)), 201


@bp.patch("/admin/session-requests/<int:request_id>")
@jwt_required()
def handle(request_id):
    """Give the request a mentor, which books it: both sides are emailed and their chat opens.

    One step on purpose. The team only assigns a mentor once they have agreed a time and payment
    with the student, so there is nothing left to confirm afterwards."""
    me = team_member("bookings")
    row = db.session.get(SessionRequest, request_id) or abort(404, "We could not find that request.")
    data = request.get_json(silent=True) or {}
    if "note" in data:
        row.note = _text(data["note"], 500) or None
    if "startsAt" in data:
        row.starts_at = _when(data["startsAt"])
    if _numbered(data, "minutes") in MINUTES:
        row.minutes = data["minutes"]

    if data.get("end"):
        _end(row, me.display_name)
    elif data.get("status") == "cancelled":
        row.status = "cancelled"
    elif data.get("status") == "assigned" and row.status == "cancelled":
        row.status = "assigned" if row.mentor_id else "new"   # reopened
    elif "mentorId" in data:
        mentor = db.session.get(MentorProfile, _numbered(data, "mentorId") or 0)             or abort(404, "We could not find that mentor.")
        if not mentor.is_verified:
            abort(400, "That mentor is not in the directory yet.")
        row.mentor_id = mentor.id
        row.confirmed_at = row.confirmed_at or utcnow()
        row.status = "confirmed"
        _confirm(row)          # emails both sides and opens their chat

    row.handled_by_id = me.id
    db.session.commit()
    return jsonify(_admin(row))


def _end(row, who):
    """Close the session. The chat stays open afterwards: the point is the clock stopping, not
    cutting two people off mid sentence."""
    if row.status != "confirmed":
        abort(409, "This session is not running.")
    if row.ended_at:
        return
    row.ended_at = utcnow()
    if row.student_id:
        db.session.add(MentorMessage(
            mentor_id=row.mentor_id, student_id=row.student_id, author_id=row.mentor.user_id,
            kind="system",
            body=f"{who.split()[0]} ended the session. You can still message each other here."))
        notify(row.student_id, None, "booking",
               message=f"Your session with {_mentor_name(row.mentor)} has ended.")


@bp.post("/session-requests/<int:request_id>/end")
@jwt_required()
@limiter.limit("60 per hour")
def end_my_session(request_id):
    """The mentor closes their own session, once they are both done. Only they can: a student should
    not be able to stop time they paid for by accident."""
    row = db.session.get(SessionRequest, request_id)
    if not row or not row.mentor or row.mentor.user_id != current_user.id:
        abort(404, "We could not find that session.")
    now = utcnow()
    if row.starts_at and row.starts_at > (now.replace(tzinfo=None) if row.starts_at.tzinfo is None else now):
        abort(409, "This session has not started yet.")
    _end(row, current_user.display_name)
    db.session.commit()
    return jsonify(_public(row))


def _confirm(row):
    """Both sides hear it is on, and their chat opens. The chat needs the student to have an
    account: without one there is nothing to open, so they are asked to sign up with this email."""
    mentor = row.mentor
    chat = f"{_site()}/my/sessions"
    if row.student_id:
        thread, _new = open_thread(mentor.id, row.student_id, row.message)
        thread.status = "accepted"   # the team arranged it, so there is nothing left to accept
        thread.decided_at = utcnow()
        notify(row.student_id, None, "booking",
               message=f"Your session with {_mentor_name(mentor)} is confirmed. Your chat is open.")

    first = escape(row.name.split()[0])
    joining = (f"<p><a href='{chat}'>Open your chat with {escape(_mentor_name(mentor))}</a></p>"
               if row.student_id else
               "<p>Create a free TYM account with this email address and your chat with your mentor "
               f"will be waiting: <a href='{_site()}/register'>{escape(_site())}/register</a></p>")
    mailer.send_quietly(
        row.email, "Your TYM session is confirmed",
        f"<p>Hi {first},</p><p>Your mentorship session with "
        f"<strong>{escape(_mentor_name(mentor))}</strong> is confirmed.</p>"
        + _said(row)
        + (f"<p>{escape(row.note)}</p>" if row.note else "")
        + joining
        + "<p>Your mentor can read what you wanted to cover, and shares the call link in that chat.</p>",
        reply_to=current_app.config["CONTACT_EMAIL"])

    if mentor.user:
        who = escape(mentor.user.display_name.split()[0]) if mentor.user.display_name else "there"
        theirs = (f"<p><a href='{chat}'>Open your chat with them</a></p>" if row.student_id else
                  "<p>They do not have a TYM account yet, so our team will put you in touch directly.</p>")
        mailer.send_quietly(
            mentor.user.email, f"Your session with {row.name} is confirmed",
            f"<p>Hi {who},</p><p>Our team has confirmed your session with "
            f"<strong>{escape(row.name)}</strong>.</p>"
            + _said(row)
            + _para("They want to cover", row.message)
            + (f"<p>{escape(row.note)}</p>" if row.note else "")
            + theirs,
            reply_to=current_app.config["CONTACT_EMAIL"])
