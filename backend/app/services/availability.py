"""Bookable session times. Mentors set weekly hours in their own time zone; the next WINDOW_DAYS
of those hours become AvailabilitySlot rows (stored in UTC) the first time someone looks, and a
slot is free while no active booking holds it."""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_
from sqlalchemy.dialects.postgresql import insert

from ..extensions import db
from ..models import AvailabilitySlot, Booking
from ..models.base import utcnow

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
WINDOW_DAYS = 21
MIN_NOTICE = timedelta(hours=12)  # mentors need time to prepare


def session_times(weekly_hours, tz_name, minutes, start_day: date, days=WINDOW_DAYS):
    """(starts_at, ends_at) in UTC for every weekly hour from start_day on. DST-safe: each time is
    placed in the mentor's zone on that exact date before converting."""
    tz = ZoneInfo(tz_name)
    for offset in range(days + 1):
        day = start_day + timedelta(days=offset)
        for hhmm in (weekly_hours or {}).get(DAYS[day.weekday()], []):
            hour, minute = map(int, hhmm.split(":"))
            start = datetime.combine(day, time(hour, minute), tzinfo=tz)
            yield start.astimezone(timezone.utc), (start + timedelta(minutes=minutes)).astimezone(timezone.utc)


def ensure_slots(mentor):
    """Create any missing slots for the booking window. Safe to call on every request."""
    # ponytail: slots made from old weekly hours stay until the mentor portal can remove them
    rows = [{"mentor_id": mentor.id, "starts_at": s, "ends_at": e, "created_at": utcnow()}
            for s, e in session_times(mentor.weekly_hours, mentor.timezone, mentor.session_minutes, date.today())]
    if rows:
        db.session.execute(insert(AvailabilitySlot).values(rows)
                           .on_conflict_do_nothing(index_elements=["mentor_id", "starts_at"]))


def held(now=None):
    """SQL condition: a booking that currently holds its slot."""
    now = now or utcnow()
    return or_(Booking.status == "confirmed",
               and_(Booking.status == "pending_payment", Booking.hold_expires_at > now))


def free_slots(mentor):
    now = utcnow()
    taken = db.select(Booking.id).where(Booking.slot_id == AvailabilitySlot.id, held(now)).exists()
    return db.session.scalars(
        db.select(AvailabilitySlot)
        .where(AvailabilitySlot.mentor_id == mentor.id,
               AvailabilitySlot.starts_at > now + MIN_NOTICE,
               AvailabilitySlot.starts_at < now + timedelta(days=WINDOW_DAYS),
               ~taken)
        .order_by(AvailabilitySlot.starts_at)
    ).all()
