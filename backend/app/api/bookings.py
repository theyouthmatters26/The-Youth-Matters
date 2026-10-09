"""Mentor sessions (Module 10), paid for with counselling hours.

    POST /bookings                       book a time: the session's length comes off the student's hours
    GET  /bookings                       my sessions: the ones I booked and, for a mentor, the ones I give
    POST /bookings/<id>/cancel           free until FREE_CANCEL before: the hours go back on the balance
    POST /bookings/<id>/review           rate a session after it happened

Hours are bought as packages (api/packages.py). Mentors have no price of their own.
"""
import secrets
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
from . import serializers as s
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
    mailer.send_quietly(b.student.email, f"Booked: your session with {m.user.display_name}",
                        f"<p>You are booked with {mentor} on {_when(b, b.student_timezone)}.</p>"
                        f"<p>Join here at the time: {b.meeting_url}</p>"
                        f"<p>{hours_text(b.minutes_deducted)} came off your counselling hours. Need to change plans? "
                        f"Cancel from My TYM up to 24 hours before and the time goes back on your balance.</p>")
    chat = f"{handoff.site_url()}/u/{m.user.username}?tab=Messages&with={m.id}-{b.student_id}"
    mailer.send_quietly(m.user.email, f"New session: {b.student.display_name}",
                        f"<p>{student} booked a {m.session_minutes} minute session on "
                        f"{_when(b, m.timezone)}.</p>{topic}<p>Meeting link: {b.meeting_url}</p>"
                        f"<p>You can message {student} before the call: <a href='{chat}'>{chat}</a></p>")


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
                meeting_url=f"https://meet.jit.si/TYM-{secrets.token_urlsafe(10)}",
                topic=str(data.get("topic") or "").strip()[:1000] or None,
                student_timezone=data.get("timezone") if data.get("timezone") in available_timezones() else None)
    db.session.add(b)
    try:
        db.session.flush()
    except IntegrityError:  # the partial unique index: another active booking holds this slot
        db.session.rollback()  # the hours taken above go back with it
        abort(409, TAKEN)
    if b.topic:  # booking opens their private conversation (api/mentor_chat.py): what they want to cover starts it
        db.session.add(MentorMessage(mentor_id=mentor.id, student_id=current_user.id, author_id=current_user.id,
                                     body=content.clean(b.topic, 2000)[0] or b.topic))
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


@bp.get("/bookings")
@jwt_required()
def mine():
    me = current_user.id
    booked = db.and_(Booking.student_id == me, Booking.status.in_(("confirmed", "cancelled")))
    # meeting_url is set when a booking is confirmed: a cancelled one without it never reached the mentor
    given = db.and_(MentorProfile.user_id == me, Booking.meeting_url.isnot(None),
                    Booking.status.in_(("confirmed", "completed", "cancelled")))
    rows = db.session.scalars(
        db.select(Booking).join(AvailabilitySlot).join(MentorProfile, Booking.mentor_id == MentorProfile.id)
        .where(db.or_(booked, given))
        .order_by(AvailabilitySlot.starts_at.desc())).all()
    return jsonify([session_row(b, me) for b in rows])


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
    if b.status != "confirmed" or b.slot.ends_at > utcnow():
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
