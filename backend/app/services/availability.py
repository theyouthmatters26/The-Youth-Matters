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
    rows = [{"mentor_id": mentor.id, "starts_at": s, "ends_at": e, "created_at": utcnow()}
            for s, e in session_times(mentor.weekly_hours, mentor.timezone, mentor.session_minutes, date.today())]
    if rows:
        db.session.execute(insert(AvailabilitySlot).values(rows)
                           .on_conflict_do_nothing(index_elements=["mentor_id", "starts_at"]))


def rebuild_slots(mentor):
    """After a mentor edits their hours, zone or session length.

    Times they have dropped go, so nobody books an hour they no longer keep. A slot a student has
    already booked stays whatever they do: the session is agreed, and cancelling it is a decision
    for a person, not a side effect of editing a form. Past slots are left alone as the record of
    what happened."""
    now = utcnow()
    wanted = {s for s, _ in session_times(mentor.weekly_hours, mentor.timezone,
                                          mentor.session_minutes, date.today())}
    booked = db.select(Booking.id).where(Booking.slot_id == AvailabilitySlot.id, held(now)).exists()
    db.session.execute(
        db.delete(AvailabilitySlot).where(
            AvailabilitySlot.id.in_(
                db.select(AvailabilitySlot.id).where(
                    AvailabilitySlot.mentor_id == mentor.id,
                    AvailabilitySlot.starts_at > now,
                    AvailabilitySlot.starts_at.notin_(wanted) if wanted else db.true(),
                    ~booked))))
    ensure_slots(mentor)


def held(now=None):
    """SQL condition: a booking that currently holds its slot."""
    now = now or utcnow()
    return or_(Booking.status == "confirmed",
               and_(Booking.status == "pending_payment", Booking.hold_expires_at > now))


def busy(now=None):
    """SQL condition: some booking's session covers this AvailabilitySlot.

    A booking names the slot it starts in and how many minutes it runs for, so a two hour session
    booked at 10:00 occupies 11:00 as well. Matching on slot_id alone would leave the later hours
    looking free and let somebody book over a session that is already going on."""
    now = now or utcnow()
    first = db.aliased(AvailabilitySlot)
    # Bookings made before sessions could span slots have no end of their own: theirs is one slot long
    ends = db.func.coalesce(Booking.ends_at, first.ends_at)
    return (db.select(Booking.id)
            .join(first, Booking.slot_id == first.id)
            .where(held(now), Booking.mentor_id == AvailabilitySlot.mentor_id,
                   first.starts_at <= AvailabilitySlot.starts_at, AvailabilitySlot.starts_at < ends)
            .exists())


def free_slots(mentor):
    now = utcnow()
    return db.session.scalars(
        db.select(AvailabilitySlot)
        .where(AvailabilitySlot.mentor_id == mentor.id,
               AvailabilitySlot.starts_at > now + MIN_NOTICE,
               AvailabilitySlot.starts_at < now + timedelta(days=WINDOW_DAYS),
               ~busy(now))
        .order_by(AvailabilitySlot.starts_at)
    ).all()


def run_of_slots(mentor, first_slot, count):
    """`count` slots starting at first_slot, back to back, or None if they do not run together.

    Locked for the rest of the transaction: two students reaching for the same hour both wait on
    these rows, so only one of them gets them."""
    window = db.session.scalars(
        db.select(AvailabilitySlot)
        .where(AvailabilitySlot.mentor_id == mentor.id,
               AvailabilitySlot.starts_at >= first_slot.starts_at)
        .order_by(AvailabilitySlot.starts_at).limit(count).with_for_update()).all()
    if len(window) != count or window[0].id != first_slot.id:
        return None
    for before, after in zip(window, window[1:]):
        if before.ends_at != after.starts_at:   # a gap in the mentor's day
            return None
    return window
