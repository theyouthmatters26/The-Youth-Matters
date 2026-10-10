"""Paid mentor directory (Module 10). Booking and payment live in api/bookings.py.

    GET /mentors                       the directory
    GET /mentors/<id>                  one mentor, with their latest reviews
    GET /mentors/<id>/availability     their open times
    GET /mentors/me/wallet             a mentor's own earnings, for their dashboard
"""
from flask import Blueprint, abort, current_app, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import func

from ..extensions import db
from ..models import AvailabilitySlot, Booking, Community, CounselingPackage, Country, MentorProfile, MentorReview, Subject, User
from ..models.base import utcnow
from ..services import availability
from . import serializers as s

bp = Blueprint("mentors", __name__)


def _ratings(mentor_ids):
    """{mentor_id: (average, count)} in one query instead of one per mentor."""
    rows = db.session.execute(
        db.select(MentorReview.mentor_id, func.avg(MentorReview.rating), func.count())
        .where(MentorReview.mentor_id.in_(mentor_ids)).group_by(MentorReview.mentor_id))
    return {mid: (avg, count) for mid, avg, count in rows}


def _verified(mentor_id):
    """A mentor students can see: listed by the team, on an account in good standing."""
    m = db.session.get(MentorProfile, mentor_id)
    if not m or not m.is_verified or m.user.status != "active":
        abort(404, "We could not find that mentor.")
    return m


@bp.get("/mentors")
def list_mentors():
    q = (db.select(MentorProfile).join(Community).join(User, MentorProfile.user_id == User.id)
         .where(MentorProfile.is_verified, User.status == "active"))
    if slug := request.args.get("subject"):
        q = q.join(Subject).where(Subject.slug == slug)
    if slug := request.args.get("country"):
        q = q.join(Country).where(Country.slug == slug)
    if uni := request.args.get("university"):
        q = q.where(MentorProfile.university.ilike(f"%{uni}%"))
    if course := request.args.get("course"):
        q = q.where(MentorProfile.course.ilike(f"%{course}%"))
    mentors = db.session.scalars(q.order_by(MentorProfile.id)).all()
    ratings = _ratings([m.id for m in mentors])
    return jsonify([s.mentor(m, ratings.get(m.id, (None, 0))) for m in mentors])


@bp.get("/mentors/<int:mentor_id>")
def get_mentor(mentor_id):
    m = _verified(mentor_id)
    reviews = db.session.scalars(db.select(MentorReview).where(MentorReview.mentor_id == m.id)
                                 .order_by(MentorReview.created_at.desc()).limit(8)).all()
    return jsonify(s.mentor(m, _ratings([m.id]).get(m.id, (None, 0)), reviews=reviews))


@bp.get("/mentors/<int:mentor_id>/availability")
def get_availability(mentor_id):
    m = _verified(mentor_id)
    availability.ensure_slots(m)
    db.session.commit()
    return jsonify(timezone=m.timezone, sessionMinutes=m.session_minutes,
                   slots=[s.slot(sl) for sl in availability.free_slots(m)])


# ---------------------------------------------------------------- a mentor's own wallet

def hourly_rate_minor():
    """What one counselling hour sells for, from the cheapest package on sale. Packages are priced
    per hour, so this is the rate every session is valued at."""
    rows = db.session.execute(db.select(CounselingPackage.price_minor, CounselingPackage.hours)
                              .where(CounselingPackage.is_active, CounselingPackage.hours > 0)).all()
    return min((round(price / hours) for price, hours in rows), default=0)


@bp.get("/mentors/me/wallet")
@jwt_required()
def my_wallet():
    """What this mentor has earned: the time they have given, valued at their share of the hourly
    rate. Students buy hours from TYM, so a mentor is paid for time given, not per payment taken."""
    m = db.session.scalar(db.select(MentorProfile).where(MentorProfile.user_id == current_user.id))
    if not m:
        abort(404, "This account is not a mentor.")
    month = utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    minutes = db.func.coalesce(Booking.minutes_deducted, m.session_minutes)
    rows = db.session.execute(
        db.select(db.func.count(Booking.id), db.func.coalesce(db.func.sum(minutes), 0),
                  db.func.coalesce(db.func.sum(db.case((AvailabilitySlot.starts_at >= month, minutes), else_=0)), 0),
                  db.func.coalesce(db.func.sum(db.case((AvailabilitySlot.starts_at > utcnow(), 1), else_=0)), 0))
        .join(AvailabilitySlot, Booking.slot_id == AvailabilitySlot.id)
        .where(Booking.mentor_id == m.id, Booking.status.in_(("confirmed", "completed")))).one()
    sessions, all_minutes, month_minutes, upcoming = (int(v) for v in rows)
    share = current_app.config["MENTOR_SHARE_PERCENT"]
    rate = hourly_rate_minor()

    def earned(mins):
        return round(mins / 60 * rate * share / 100)

    return jsonify(sessions=sessions, upcoming=upcoming, minutes=all_minutes, thisMonthMinutes=month_minutes,
                   sharePercent=share, hourlyRateMinor=rate, currency="INR",
                   earnedMinor=earned(all_minutes), thisMonthMinor=earned(month_minutes))
