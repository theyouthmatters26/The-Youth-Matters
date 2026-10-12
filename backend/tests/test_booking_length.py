"""A student picks the start and the end of a session, not just the start.

A booking runs across as many of the mentor's slots as they asked for. The thing that must not
happen is somebody booking an hour that another session is already running through.
"""
from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import AvailabilitySlot, Booking, Community, Country, MentorProfile, Subject, User
from app.models.base import utcnow
from app.services import availability

TABLES = [db.metadata.tables[t] for t in ("countries", "subjects", "communities", "users",
                                          "identity_verifications", "mentor_profiles",
                                          "availability_slots", "bookings", "payments",
                                          "mentor_reviews", "mentor_threads", "mentor_messages",
                                          "notifications", "counseling_packages")]


@pytest.fixture
def site(monkeypatch):
    app = create_app(TestConfig)
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        # SQLite hands times back without a zone; PostgreSQL keeps it. Give both sides the same "now".
        from app.api import bookings as bookings_api
        naive = lambda: utcnow().replace(tzinfo=None)  # noqa: E731
        monkeypatch.setattr(bookings_api, "utcnow", naive)
        monkeypatch.setattr(availability, "utcnow", naive)

        community = Community(subject=Subject(slug="study-abroad", name="Study Abroad", is_active=True),
                              country=Country(slug="uk", name="United Kingdom", iso_code="GB"), is_active=True)
        who = User(email="priya@example.org", username="priya", display_name="Priya", role="mentor",
                   status="active", email_verified=True)
        asha = User(email="asha@example.org", username="asha", display_name="Asha", status="active",
                    email_verified=True, counseling_minutes=600)
        ben = User(email="ben@example.org", username="ben", display_name="Ben", status="active",
                   email_verified=True, counseling_minutes=600)
        db.session.add_all([community, who, asha, ben])
        db.session.flush()
        m = MentorProfile(user_id=who.id, community_id=community.id, university="Leeds", course="MSc",
                          graduation_year=2024, headline="Helps with UK visas and SOPs", about="x" * 200,
                          topics=["Visas"], languages=["English"], session_minutes=60,
                          timezone="Europe/London", weekly_hours={}, is_verified=True)
        db.session.add(m)
        db.session.flush()
        # Four hours back to back, well clear of the notice period
        start = (utcnow() + timedelta(days=3)).replace(minute=0, second=0, microsecond=0, tzinfo=None)
        made = []
        for n in range(4):
            sl = AvailabilitySlot(mentor_id=m.id, starts_at=start + timedelta(hours=n),
                                  ends_at=start + timedelta(hours=n + 1))
            db.session.add(sl)
            made.append(sl)
        db.session.commit()
        heads = {n: {"Authorization": f"Bearer {create_access_token(str(i))}"}
                 for n, i in (("asha", asha.id), ("ben", ben.id))}
        yield app.test_client(), m, made, heads, {"asha": asha.id, "ben": ben.id}


def book(client, head, slot, slots=None):
    body = {"slotId": slot.id}
    if slots is not None:
        body["slots"] = slots
    return client.post("/api/bookings", headers=head, json=body)


def free_ids(m):
    return {s.id for s in availability.free_slots(m)}


def test_a_student_books_two_hours_in_one_session(site):
    client, m, slots, heads, who = site

    made = book(client, heads["asha"], slots[0], 2)
    assert made.status_code == 201, made.get_json()
    b = db.session.scalar(db.select(Booking))
    assert b.minutes_deducted == 120                      # two of the mentor's hours
    assert b.ends_at.replace(tzinfo=None) == slots[1].ends_at.replace(tzinfo=None)
    # ...and two hours came off the balance, not one
    assert db.session.get(User, who["asha"]).counseling_minutes == 600 - 120


def test_the_hours_a_session_runs_through_stop_being_bookable(site):
    client, m, slots, heads, _who = site
    assert free_ids(m) == {s.id for s in slots}

    book(client, heads["asha"], slots[0], 2)
    db.session.expire_all()
    # The second hour is inside that session even though no booking names it
    assert free_ids(m) == {slots[2].id, slots[3].id}

    clash = book(client, heads["ben"], slots[1], 1)
    assert clash.status_code == 409, "a second student booked an hour inside somebody else's session"


def test_a_length_that_runs_past_the_free_hours_is_refused(site):
    client, m, slots, heads, _who = site
    book(client, heads["asha"], slots[2], 2)              # takes the last two hours
    db.session.expire_all()

    over = book(client, heads["ben"], slots[1], 2)        # would run into them
    assert over.status_code == 409
    assert book(client, heads["ben"], slots[0], 9).status_code == 400   # past the maximum


def test_booking_one_slot_still_works_without_asking_for_a_length(site):
    client, _m, slots, heads, who = site
    made = book(client, heads["asha"], slots[0])
    assert made.status_code == 201
    assert db.session.scalar(db.select(Booking)).minutes_deducted == 60
    assert db.session.get(User, who["asha"]).counseling_minutes == 600 - 60


def test_a_long_session_needs_the_hours_to_pay_for_it(site):
    client, _m, slots, heads, who = site
    poor = db.session.get(User, who["ben"])
    poor.counseling_minutes = 60
    db.session.commit()

    short = book(client, heads["ben"], slots[0], 3)
    assert short.status_code == 402, short.get_json()
    db.session.expire_all()
    assert db.session.get(User, who["ben"]).counseling_minutes == 60   # nothing taken
    assert db.session.scalar(db.select(Booking)) is None
