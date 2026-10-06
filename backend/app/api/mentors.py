"""Paid mentor directory (Module 10). Booking and payment live in api/bookings.py."""
from flask import Blueprint, abort, jsonify, request
from sqlalchemy import func

from ..extensions import db
from ..models import Community, Country, MentorProfile, MentorReview, Subject
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
    m = db.session.get(MentorProfile, mentor_id)
    if not m or not m.is_verified:
        abort(404, "We could not find that mentor.")
    return m


@bp.get("/mentors")
def list_mentors():
    q = db.select(MentorProfile).join(Community).where(MentorProfile.is_verified)
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
