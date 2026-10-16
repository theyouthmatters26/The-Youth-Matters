"""A mentor editing their own page, and what that does to the times students can book.

The part that matters: dropping an hour must not cancel a session somebody already booked into it.
"""
from datetime import date, timedelta

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import AvailabilitySlot, Booking, Community, Country, MentorProfile, Subject, User
from app.models.base import utcnow
from app.services import availability

TABLES = [db.metadata.tables[t] for t in ("countries", "subjects", "communities", "users",
                                          "identity_verifications", "mentor_profiles", "mentor_countries",
                                          "availability_slots", "bookings", "payments",
                                          "mentor_reviews", "mentor_threads", "mentor_messages",
                                          "notifications", "counseling_packages")]
HOURS = {"mon": ["18:00", "19:00"], "wed": ["18:00"]}


@pytest.fixture
def site(monkeypatch):
    app = create_app(TestConfig)
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        # SQLite has no ON CONFLICT target support here; the rebuild is what this file tests
        monkeypatch.setattr(availability, "ensure_slots", lambda mentor: _make(mentor))

        community = Community(subject=Subject(slug="study-abroad", name="Study Abroad", is_active=True),
                              country=Country(slug="uk", name="United Kingdom", iso_code="GB"), is_active=True)
        who = User(email="priya@example.org", username="priya", display_name="Priya", role="mentor",
                   status="active", email_verified=True)
        student = User(email="asha@example.org", username="asha", display_name="Asha", status="active",
                       email_verified=True)
        db.session.add_all([community, who, student])
        db.session.flush()
        m = MentorProfile(user_id=who.id, community_id=community.id, university="Leeds", course="MSc",
                          graduation_year=2024, headline="Helps with UK visas and SOPs", about="x" * 200,
                          topics=["Visas"], languages=["English"], session_minutes=60,
                          timezone="Europe/London", weekly_hours=HOURS, is_verified=True)
        db.session.add(m)
        db.session.commit()
        _make(m)
        db.session.commit()
        head = {"Authorization": f"Bearer {create_access_token(str(who.id))}"}
        yield app.test_client(), m, student, head


def _make(mentor):
    """ensure_slots without the PostgreSQL upsert."""
    have = {s.starts_at for s in db.session.scalars(
        db.select(AvailabilitySlot).where(AvailabilitySlot.mentor_id == mentor.id))}
    for starts, ends in availability.session_times(mentor.weekly_hours, mentor.timezone,
                                                   mentor.session_minutes, date.today()):
        if starts.replace(tzinfo=None) not in {h.replace(tzinfo=None) for h in have}:
            db.session.add(AvailabilitySlot(mentor_id=mentor.id, starts_at=starts, ends_at=ends))
    db.session.flush()


def now():
    """SQLite hands times back without a zone, so compare against the same kind."""
    return utcnow().replace(tzinfo=None)


def slots(m):
    return db.session.scalars(db.select(AvailabilitySlot).where(
        AvailabilitySlot.mentor_id == m.id).order_by(AvailabilitySlot.starts_at)).all()


def test_a_mentor_reads_and_edits_their_own_page(site):
    client, m, _student, head = site

    mine = client.get("/api/mentors/me", headers=head).get_json()
    assert mine["headline"] == "Helps with UK visas and SOPs"
    assert mine["weeklyHours"] == HOURS  # the public view leaves these out; the edit page needs them

    saved = client.patch("/api/mentors/me", headers=head, json={
        "headline": "UK visas, SOPs and CAS letters, line by line",
        "topics": ["Visas", "SOPs", "Scholarships"],
        "languages": ["English", "Hindi"]})
    assert saved.status_code == 200, saved.get_json()
    assert saved.get_json()["headline"] == "UK visas, SOPs and CAS letters, line by line"

    db.session.expire_all()
    # ...and the directory shows it, because both read the same row
    public = client.get(f"/api/mentors/{m.id}").get_json()
    assert public["headline"] == "UK visas, SOPs and CAS letters, line by line"
    assert public["topics"] == ["Visas", "SOPs", "Scholarships"]


def test_dropping_an_hour_removes_the_slot(site):
    client, m, _student, head = site
    before = len(slots(m))
    assert before > 0

    client.patch("/api/mentors/me", headers=head, json={"weeklyHours": {"mon": ["18:00", "19:00"]}})
    db.session.expire_all()
    left = slots(m)
    assert len(left) < before
    assert all(s.starts_at.weekday() == 0 for s in left if s.starts_at > now())  # Wednesday is gone


def test_a_booked_hour_survives_the_mentor_dropping_it(site):
    client, m, student, head = site
    future = next(s for s in slots(m) if s.starts_at > now() + timedelta(hours=24))
    db.session.add(Booking(mentor_id=m.id, student_id=student.id, slot_id=future.id,
                           status="confirmed", minutes_deducted=60))
    db.session.commit()

    # They clear that day entirely
    client.patch("/api/mentors/me", headers=head, json={"weeklyHours": {"sat": ["09:00", "10:00"]}})
    db.session.expire_all()

    kept = db.session.get(AvailabilitySlot, future.id)
    assert kept is not None, "a session somebody booked was deleted by an edit to the hours"


def test_what_the_page_will_not_accept(site):
    client, _m, _student, head = site
    for body in ({"headline": ""}, {"about": "x" * 20},
                 {"sessionMinutes": 25}, {"timezone": "Mars/Olympus"},
                 {"weeklyHours": {"mon": ["25:00"]}}, {"topics": []}):
        assert client.patch("/api/mentors/me", headers=head, json=body).status_code == 400, body


def test_only_a_mentor_has_a_mentor_page(site):
    client, _m, student, _head = site
    theirs = {"Authorization": f"Bearer {create_access_token(str(student.id))}"}
    assert client.get("/api/mentors/me", headers=theirs).status_code == 404
    assert client.patch("/api/mentors/me", headers=theirs, json={"headline": "x" * 30}).status_code == 404
