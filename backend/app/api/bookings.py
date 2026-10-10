"""Mentor sessions (Module 10), paid for with counselling hours.

    POST /bookings                       book a time: the session's length comes off the student's hours
    GET  /bookings                       my sessions: the ones I booked and, for a mentor, the ones I give
    POST /bookings/<id>/cancel           free until FREE_CANCEL before: the hours go back on the balance
    POST /bookings/<id>/end              the mentor closes a session once they are done
    POST /bookings/<id>/review           rate a session after it happened

A session is time in the private chat with that mentor, not a video call: they talk in Messages for
the time that was booked. When the time is up the mentor is told once (time_is_up below) and ends
the session when the conversation is finished. A mentor who would rather meet on video shares a
call link in the chat themselves.

Hours are bought as packages (api/packages.py). Mentors have no price of their own.
"""
from datetime import timedelta
from zoneinfo import ZoneInfo, available_timezones

from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from markupsafe import escape
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from ..extensions import db, limiter
from ..models import AvailabilitySlot, Booking, MentorMessage, MentorProfile, MentorReview
from ..models.base import utcnow
from ..services import availability, content, handoff, mailer
from ..services.notify import notify
from . import serializers as s
from .mentor_chat import open_thread
from .packages import add_minutes, hours_text, take_minutes

bp = Blueprint("bookings", __name__)

FREE_CANCEL = timedelta(hours=24)
TAKEN = "Someone has just booked this time. Pick another one."


class NeedsHours(HTTPException):
    """402: not enough counselling time. The website offers the packages when it sees this."""
    code = 402
    name = "Payment Required"


def _body():
    return request.get_json(silent=True) or {}


def _member():
    if current_user.status != "active":
        abort(403, "Finish verifying your account to book a session.")


def _mine(booking_id):
    b = db.session.get(Booking, booking_id)
    if not b or b.student_id != current_user.id:
        abort(404, "We could not find that booking.")
    return b


def _when(b, tz_name):
    tz_name = tz_name if tz_name in available_timezones() else "UTC"
    start = b.slot.starts_at.astimezone(ZoneInfo(tz_name))
    return f"{start:%A} {start.day} {start:%B %Y}, {start:%H:%M} ({tz_name})"


def _email_confirmation(b):
    """Tell both people, each in their own email: one address bouncing must not leave the other untold.
    Names and the topic are typed by members, so they are escaped before they go into the email."""
    m = b.mentor
    student, mentor = escape(b.student.display_name), escape(m.user.display_name)
    topic = f"<p>What {student} wants to cover:<br>{escape(b.topic)}</p>" if b.topic else ""
    student_chat = f"{handoff.site_url()}/u/{b.student.username}?tab=Messages&with={m.id}-{b.student_id}"
    mentor_chat = f"{handoff.site_url()}/u/{m.user.username}?tab=Messages&with={m.id}-{b.student_id}"
    mailer.send_quietly(b.student.email, f"Booked: your session with {m.user.display_name}",
                        f"<p>You are booked with {mentor} on {_when(b, b.student_timezone)}.</p>"
                        f"<p>Your session happens in your private chat on The Youth Matters, in Messages on your "
                        f"profile: <a href='{student_chat}'>{student_chat}</a>. {mentor} opens the chat when they "
                        f"accept your request, and you can write to each other before the time as well.</p>"
                        f"<p>{hours_text(b.minutes_deducted)} came off your counselling hours. Need to change plans? "
                        f"Cancel from My TYM up to 24 hours before and the time goes back on your balance.</p>")
    mailer.send_quietly(m.user.email, f"New session: {b.student.display_name}",
                        f"<p>{student} booked a {m.session_minutes} minute chat session on "
                        f"{_when(b, m.timezone)}.</p>{topic}"
                        f"<p>Accept their request to open the conversation, and talk there at the time: "
                        f"<a href='{mentor_chat}'>{mentor_chat}</a></p>")


@bp.post("/bookings")
@jwt_required()
@limiter.limit("30 per hour")
def create():
    _member()
    data = _body()
    slot_id = data.get("slotId")
    slot = db.session.get(AvailabilitySlot, slot_id, with_for_update=True) if isinstance(slot_id, int) else None
    if not slot or slot.starts_at < utcnow() + availability.MIN_NOTICE:
        abort(409, "That time is no longer available. Pick another one.")
    mentor = db.session.get(MentorProfile, slot.mentor_id)
    if mentor.user_id == current_user.id:
        abort(400, "You cannot book a session with yourself.")
    if not mentor.is_verified or mentor.user.status != "active":  # hidden by the team, or the account is suspended
        abort(409, "This mentor is not taking bookings at the moment.")

    minutes = mentor.session_minutes
    if not take_minutes(current_user.id, minutes):
        raise NeedsHours(f"This session needs {hours_text(minutes)} of counselling time and you do not have enough. "
                         "Buy hours to book.")
    b = Booking(slot=slot, mentor=mentor, student=current_user, status="confirmed", minutes_deducted=minutes,
                topic=str(data.get("topic") or "").strip()[:1000] or None,
                student_timezone=data.get("timezone") if data.get("timezone") in available_timezones() else None)
    db.session.add(b)
    try:
        db.session.flush()
    except IntegrityError:  # the partial unique index: another active booking holds this slot
        db.session.rollback()  # the hours taken above go back with it
        abort(409, TAKEN)
    # Paying for a session asks the mentor for a chat (api/mentor_chat.py). They accept it from
    # their dashboard, and what the student wants to cover is the request.
    _, asked = open_thread(mentor.id, current_user.id, note=content.clean(b.topic, 1000)[0] if b.topic else None)
    if asked:
        notify(mentor.user_id, current_user, "message", message="booked a session and would like to chat")
    db.session.commit()
    _email_confirmation(b)
    return jsonify(booking=s.booking(b), counselingMinutes=current_user.counseling_minutes), 201


def session_row(b, viewer_id):
    """A booking as the person looking at it should see it. The mentor giving the session gets the
    student's name and photo, never their email."""
    row = s.booking(b)
    if b.mentor.user_id != viewer_id:
        return row
    return {**row, "asMentor": True, "student": s.user_brief(b.student)}


def time_is_up(b):
    """Tell the mentor, once, that a session has run past its time. There is no scheduler here: the
    chat and the sessions page both pass through this, and one of the two people is always looking."""
    if b.status != "confirmed" or b.time_up_at or b.ended_at or b.slot.ends_at > utcnow():
        return False
    b.time_up_at = utcnow()
    notify(b.mentor.user_id, None, "booking",
           message=f"The {hours_text(b.minutes_deducted or b.mentor.session_minutes)} you booked with "
                   f"{b.student.display_name} is up. End the session when you are done.")
    db.session.add(MentorMessage(
        mentor_id=b.mentor_id, student_id=b.student_id, author_id=b.mentor.user_id, kind="system",
        body=f"The booked time is up. {b.mentor.user.display_name.split()[0]} can end the session when "
             "you are both done."))
    return True


def sessions_of(user_id):
    """Every session this person is part of, as student or as mentor."""
    booked = db.and_(Booking.student_id == user_id, Booking.status.in_(("confirmed", "completed", "cancelled")))
    given = db.and_(MentorProfile.user_id == user_id,
                    Booking.status.in_(("confirmed", "completed", "cancelled")))
    return (db.select(Booking).join(AvailabilitySlot).join(MentorProfile, Booking.mentor_id == MentorProfile.id)
            .where(db.or_(booked, given)))


@bp.get("/bookings")
@jwt_required()
def mine():
    me = current_user.id
    # "completed" is a session the mentor has closed: the student still sees it, and reviews it
    booked = db.and_(Booking.student_id == me, Booking.status.in_(("confirmed", "completed", "cancelled")))
    # meeting_url is set when a booking is confirmed: a cancelled one without it never reached the mentor
    given = db.and_(MentorProfile.user_id == me, Booking.status.in_(("confirmed", "completed", "cancelled")))
    rows = db.session.scalars(
        db.select(Booking).join(AvailabilitySlot).join(MentorProfile, Booking.mentor_id == MentorProfile.id)
        .where(db.or_(booked, given))
        .order_by(AvailabilitySlot.starts_at.desc())).all()
    if any(time_is_up(b) for b in rows):
        db.session.commit()
    return jsonify([session_row(b, me) for b in rows])


@bp.post("/bookings/<int:booking_id>/end")
@jwt_required()
@limiter.limit("60 per hour")
def end_session(booking_id):
    """The mentor closes the session once the conversation is finished. Only they can: a student
    cannot end time they paid for by accident, and the mentor decides when it is done."""
    b = db.session.get(Booking, booking_id)
    if not b or b.mentor.user_id != current_user.id:
        abort(404, "We could not find that session.")
    if b.status != "confirmed":
        abort(409, "This session is not running.")
    if b.slot.starts_at > utcnow():
        abort(409, "This session has not started yet.")
    b.status, b.ended_at = "completed", utcnow()
    db.session.add(MentorMessage(
        mentor_id=b.mentor_id, student_id=b.student_id, author_id=current_user.id, kind="system",
        body=f"{current_user.display_name.split()[0]} ended the session. You can still message each other here."))
    notify(b.student_id, current_user, "booking", message="ended your session. Leave a review when you have a moment.")
    db.session.commit()
    return jsonify(booking=s.booking(b))


def give_back(b):
    """Return a cancelled session's time to the student. Only once: the amount is cleared as it goes."""
    if b.minutes_deducted:
        add_minutes(b.student_id, b.minutes_deducted)
        b.minutes_deducted = None
        return True
    return False


@bp.post("/bookings/<int:booking_id>/cancel")
@jwt_required()
@limiter.limit("20 per hour")
def cancel(booking_id):
    b = _mine(booking_id)
    if b.status != "confirmed" or b.slot.starts_at <= utcnow():
        abort(409, "This session can no longer be cancelled.")
    if b.slot.starts_at - utcnow() < FREE_CANCEL:
        abort(409, "Sessions can be cancelled up to 24 hours before they start. "
                   "If something urgent came up, write to support@theyouthmatters.com.")
    give_back(b)
    b.status = "cancelled"
    db.session.commit()
    mailer.send_quietly(b.mentor.user.email, f"Cancelled: session with {current_user.display_name}",
                        f"<p>{escape(current_user.display_name)} cancelled the session on {_when(b, b.mentor.timezone)}. "
                        "The time is open for booking again.</p>")
    return jsonify(booking=s.booking(b), counselingMinutes=current_user.counseling_minutes)


@bp.post("/bookings/<int:booking_id>/review")
@jwt_required()
@limiter.limit("20 per hour")
def review(booking_id):
    b = _mine(booking_id)
    # A session the mentor has closed counts as happened, as does one whose time has simply passed
    if b.status not in ("confirmed", "completed") or (b.status == "confirmed" and b.slot.ends_at > utcnow()):
        abort(409, "You can review a session once it has happened.")
    if b.review:
        abort(409, "You have already reviewed this session.")
    data = _body()
    rating, body = data.get("rating"), str(data.get("body") or "").strip()
    if rating not in (1, 2, 3, 4, 5) or not 10 <= len(body) <= 1000:
        abort(400, "Choose a rating and write a few words (10 to 1000 characters).")
    db.session.add(MentorReview(mentor_id=b.mentor_id, booking=b, author=current_user, rating=rating, body=body))
    db.session.commit()
    return jsonify(booking=s.booking(b)), 201
