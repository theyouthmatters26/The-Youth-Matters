"""Booking a session while payment is arranged by hand (api/session_requests.py).

The whole point of this flow is that nothing is lost between the form and the call: the student
hears back, the mentor they asked for knows somebody is waiting, and when the team assigns a mentor
both sides are told and their chat is open. Each of those is tested here, because a missed email is
invisible until a student complains.
"""
import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.api import session_requests as api
from app.models import (Community, Country, MentorProfile, MentorThread, Notification, SessionRequest,
                        Subject, User)

TABLES = [db.metadata.tables[t] for t in (
    "countries", "subjects", "communities", "users", "identity_verifications", "mentor_profiles",
    "availability_slots", "bookings", "counseling_packages", "payments", "mentor_threads",
    "mentor_messages", "notifications", "moderation_logs", "session_requests")]


class NoLimit(TestConfig):
    RATELIMIT_ENABLED = False


@pytest.fixture
def site(monkeypatch):
    app = create_app(NoLimit)
    app.config["ADMIN_EMAIL"] = "owner@theyouthmatters.com"
    app.config["CONTACT_EMAIL"] = "team@theyouthmatters.com"
    app.config["SITE_URL"] = "https://theyouthmatters.com"
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        sent = []
        monkeypatch.setattr(api.mailer, "send_quietly",
                            lambda to, subject, html, **kw: sent.append((to, subject, html)))

        community = Community(subject=Subject(slug="study-abroad", name="Study Abroad", is_active=True),
                              country=Country(slug="uk", name="United Kingdom", iso_code="GB"), is_active=True)
        owner = User(email="owner@theyouthmatters.com", username="owner", display_name="Owner",
                     role="admin", status="active", email_verified=True)
        priya = User(email="priya@example.org", username="priya", display_name="Priya Rao",
                     role="mentor", status="active", email_verified=True)
        sam = User(email="sam@example.org", username="sam", display_name="Sam Lee",
                   role="mentor", status="active", email_verified=True)
        asha = User(email="asha@example.org", username="asha", display_name="Asha",
                    status="active", email_verified=True)
        db.session.add_all([community, owner, priya, sam, asha])
        db.session.flush()
        mentors = []
        for who in (priya, sam):
            m = MentorProfile(user_id=who.id, community_id=community.id, university="Leeds", course="MSc",
                              graduation_year=2024, headline="Helps with UK visas", about="x" * 200,
                              topics=["Visas"], languages=["English"], session_minutes=60,
                              timezone="Europe/London", weekly_hours={}, is_verified=True)
            db.session.add(m)
            mentors.append(m)
        db.session.commit()
        head = {"Authorization": f"Bearer {create_access_token(str(owner.id))}"}
        yield app.test_client(), sent, mentors, head, asha.id
        db.session.remove()
        db.metadata.drop_all(db.engine, tables=TABLES)


FORM = {"name": "Asha Rao", "email": "asha@example.org", "whatsapp": "+91 90000 00000",
        "message": "I need help with my UK visa financials.",
        "answers": {"Preferred time": "6pm IST", "Signed": "Asha Rao"}}


def to(sent):
    return [row[0] for row in sent]


def test_a_request_reaches_the_student_and_the_team(site):
    client, sent, _mentors, _head, _asha = site
    made = client.post("/api/session-requests", json=FORM)
    assert made.status_code == 201, made.get_json()

    assert to(sent) == ["team@theyouthmatters.com", "asha@example.org"]
    assert "6pm IST" in sent[0][2] and "Asha Rao" in sent[0][2]        # the answers go to the team
    assert "session request" in sent[1][1]

    row = db.session.scalar(db.select(SessionRequest))
    assert row.status == "new" and row.mentor_id is None
    assert row.answers["Signed"] == "Asha Rao"


def test_asking_for_a_mentor_tells_that_mentor(site):
    client, sent, mentors, _head, _asha = site
    client.post("/api/session-requests", json={**FORM, "mentorId": mentors[0].id})

    assert "priya@example.org" in to(sent)
    theirs = next(row for row in sent if row[0] == "priya@example.org")
    assert "asked" in theirs[1] and "Asha Rao" in theirs[2]
    # and the mentor sees it on their bell too
    assert db.session.scalar(db.select(Notification).filter_by(kind="booking")) is not None
    assert db.session.scalar(db.select(SessionRequest)).wanted_mentor_id == mentors[0].id


def test_a_form_from_a_known_email_is_tied_to_that_account(site):
    client, _sent, _mentors, _head, asha = site
    client.post("/api/session-requests", json=FORM)
    assert db.session.scalar(db.select(SessionRequest)).student_id == asha

    client.post("/api/session-requests", json={**FORM, "email": "nobody@example.org"})
    rows = db.session.scalars(db.select(SessionRequest).order_by(SessionRequest.id)).all()
    assert rows[1].student_id is None


def test_assigning_a_mentor_books_it_tells_both_and_opens_the_chat(site):
    client, sent, mentors, head, asha = site
    client.post("/api/session-requests", json=FORM)
    row = db.session.scalar(db.select(SessionRequest))
    sent.clear()

    done = client.patch(f"/api/admin/session-requests/{row.id}", headers=head,
                        json={"mentorId": mentors[0].id, "note": "Wed 22 Oct, 6pm IST. Paid by UPI."})
    assert done.status_code == 200, done.get_json()
    assert done.get_json()["status"] == "confirmed"

    # both sides heard about it, with the agreed time in each
    assert sorted(to(sent)) == ["asha@example.org", "priya@example.org"]
    assert all("Wed 22 Oct" in row[2] for row in sent)

    # ...and the chat is open, not waiting for the mentor to accept
    thread = db.session.scalar(db.select(MentorThread))
    assert thread.mentor_id == mentors[0].id and thread.student_id == asha
    assert thread.status == "accepted"
    assert thread.request_note == FORM["message"]


def test_a_student_with_no_account_is_booked_but_told_to_sign_up(site):
    client, sent, mentors, head, _asha = site
    client.post("/api/session-requests", json={**FORM, "email": "nobody@example.org"})
    row = db.session.scalar(db.select(SessionRequest))
    sent.clear()

    client.patch(f"/api/admin/session-requests/{row.id}", headers=head, json={"mentorId": mentors[0].id})
    theirs = next(r for r in sent if r[0] == "nobody@example.org")
    assert "/register" in theirs[2]
    assert db.session.scalar(db.select(MentorThread)) is None   # nobody to open it with yet


def test_only_the_team_can_assign_a_mentor(site):
    client, _sent, mentors, _head, asha = site
    client.post("/api/session-requests", json=FORM)
    row = db.session.scalar(db.select(SessionRequest))
    student = {"Authorization": f"Bearer {create_access_token(str(asha))}"}

    assert client.patch(f"/api/admin/session-requests/{row.id}", json={"mentorId": mentors[0].id}).status_code == 401
    assert client.patch(f"/api/admin/session-requests/{row.id}", headers=student,
                        json={"mentorId": mentors[0].id}).status_code == 403
    db.session.expire_all()
    assert db.session.scalar(db.select(SessionRequest)).status == "new"


def test_the_queue_shows_what_still_needs_arranging(site):
    client, _sent, mentors, head, _asha = site
    client.post("/api/session-requests", json=FORM)
    client.post("/api/session-requests", json={**FORM, "name": "Ben", "email": "ben@example.org"})
    first = db.session.scalars(db.select(SessionRequest).order_by(SessionRequest.id)).first()

    waiting = client.get("/api/admin/session-requests", headers=head).get_json()
    assert waiting["waiting"] == 2 and len(waiting["items"]) == 2

    client.patch(f"/api/admin/session-requests/{first.id}", headers=head, json={"mentorId": mentors[1].id})
    after = client.get("/api/admin/session-requests", headers=head).get_json()
    assert after["waiting"] == 1
    assert [r["name"] for r in client.get("/api/admin/session-requests?status=confirmed",
                                          headers=head).get_json()["items"]] == ["Asha Rao"]


def test_a_closed_request_books_nobody(site):
    client, sent, _mentors, head, _asha = site
    client.post("/api/session-requests", json=FORM)
    row = db.session.scalar(db.select(SessionRequest))
    sent.clear()

    client.patch(f"/api/admin/session-requests/{row.id}", headers=head, json={"status": "cancelled"})
    db.session.expire_all()
    assert db.session.scalar(db.select(SessionRequest)).status == "cancelled"
    assert db.session.scalar(db.select(MentorThread)) is None
    assert sent == []


def test_a_half_filled_form_is_refused(site):
    client, sent, _mentors, _head, _asha = site
    assert client.post("/api/session-requests", json={**FORM, "email": "not-an-address"}).status_code == 400
    assert client.post("/api/session-requests", json={**FORM, "name": "A"}).status_code == 400
    assert db.session.scalar(db.select(SessionRequest)) is None
    assert sent == []


def test_the_team_can_book_a_session_somebody_asked_for_off_the_site(site):
    client, sent, mentors, head, asha = site
    made = client.post("/api/admin/session-requests", headers=head, json={
        "name": "Asha Rao", "email": "ASHA@example.org", "whatsapp": "+91 90000 00000",
        "mentorId": mentors[1].id, "note": "Fri 24 Oct, 7pm IST. Paid by UPI.",
        "message": "Shortlisting Manchester courses."})
    assert made.status_code == 201, made.get_json()
    assert made.get_json()["status"] == "confirmed"

    # booked the moment it was made: both told, chat open, and the email is lower cased as stored
    assert sorted(to(sent)) == ["asha@example.org", "sam@example.org"]
    assert all("Fri 24 Oct" in row[2] for row in sent)
    thread = db.session.scalar(db.select(MentorThread))
    assert (thread.mentor_id, thread.student_id, thread.status) == (mentors[1].id, asha, "accepted")


def test_the_team_cannot_book_without_a_mentor_or_a_real_email(site):
    client, sent, mentors, head, _asha = site
    assert client.post("/api/admin/session-requests", headers=head,
                       json={"name": "Asha", "email": "asha@example.org"}).status_code == 400
    assert client.post("/api/admin/session-requests", headers=head,
                       json={"name": "Asha", "email": "nope", "mentorId": mentors[0].id}).status_code == 400
    assert db.session.scalar(db.select(SessionRequest)) is None
    assert sent == []


def test_only_the_team_can_book_one(site):
    client, _sent, mentors, _head, asha = site
    student = {"Authorization": f"Bearer {create_access_token(str(asha))}"}
    body = {"name": "Asha", "email": "asha@example.org", "mentorId": mentors[0].id}
    assert client.post("/api/admin/session-requests", json=body).status_code == 401
    assert client.post("/api/admin/session-requests", headers=student, json=body).status_code == 403
