"""Counselling hours: bought as packages, spent on sessions, returned on a cancellation in time."""
from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.api import bookings
from app.api.packages import credit
from app.config import TestConfig
from app.extensions import db
from app.models import (AvailabilitySlot, Booking, Community, CounselingPackage, Country, MentorProfile, Payment, Subject,
                        User)
from app.models.base import utcnow

TABLES = [db.metadata.tables[t] for t in ("countries", "subjects", "communities", "users", "identity_verifications",
                                         "mentor_profiles", "availability_slots", "counseling_packages", "bookings",
                                         "payments", "mentor_reviews", "mentor_messages")]


@pytest.fixture
def site(monkeypatch):
    # SQLite hands times back without a zone; PostgreSQL keeps it. Give the booking code the same kind of "now".
    monkeypatch.setattr(bookings, "utcnow", lambda: utcnow().replace(tzinfo=None))
    app = create_app(TestConfig)
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)  # not every table: posts use a PostgreSQL search column
        community = Community(subject=Subject(slug="study-abroad", name="Study Abroad", is_active=True),
                              country=Country(slug="uk", name="United Kingdom", iso_code="GB"))
        people = [User(email=f"{n}@example.org", username=n, display_name=n.title(), status="active", email_verified=True)
                  for n in ("mentor", "asha", "ben")]
        mentor = MentorProfile(user=people[0], community=community, university="Leeds", course="MSc", headline="Helps with visas",
                               session_minutes=60, is_verified=True, timezone="Europe/London")
        start = utcnow() + timedelta(days=3)
        package = CounselingPackage(title="1 hour", hours=1, price_minor=85000)
        db.session.add_all([community, *people, mentor, package])
        db.session.flush()
        slot = AvailabilitySlot(mentor_id=mentor.id, starts_at=start, ends_at=start + timedelta(hours=1))
        db.session.add(slot)
        db.session.commit()
        ids = {"slot": slot.id, "package": package.id, "mentor": people[0].id, "asha": people[1].id, "ben": people[2].id,
               "profile": mentor.id}
        login = {n: {"Authorization": f"Bearer {create_access_token(str(ids[n]))}"} for n in ("mentor", "asha", "ben")}
        yield app.test_client(), ids, login
        db.session.remove()
        db.metadata.drop_all(db.engine, tables=TABLES)


def minutes(user_id):
    db.session.expire_all()
    return db.session.get(User, user_id).counseling_minutes


def buy(user_id, package_id):
    pay = Payment(user_id=user_id, kind="package", package_id=package_id, minutes=60, amount_minor=85000,
                  razorpay_order_id=f"order_{user_id}")
    db.session.add(pay)
    db.session.commit()
    return pay


def test_packages_are_listed_for_everyone(site):
    client, ids, _ = site
    assert client.get("/api/packages").get_json() == [
        {"id": ids["package"], "title": "1 hour", "hours": 1, "priceMinor": 85000, "currency": "INR"}]


def test_a_payment_adds_its_hours_once(site):
    _, ids, _ = site
    pay = buy(ids["asha"], ids["package"])
    assert credit(pay, "pay_1") is True
    assert credit(pay, "pay_1") is False  # Checkout and the webhook both arrive: the second changes nothing
    db.session.commit()
    assert minutes(ids["asha"]) == 60 and pay.status == "paid" and pay.invoice_number


def test_booking_spends_hours_and_cancelling_gives_them_back(site):
    client, ids, login = site
    book = {"slotId": ids["slot"], "timezone": "Asia/Kolkata"}

    r = client.post("/api/bookings", json=book, headers=login["asha"])
    assert r.status_code == 402 and "Buy hours" in r.get_json()["message"]  # nothing bought yet

    for who in ("asha", "ben"):
        credit(buy(ids[who], ids["package"]), f"pay_{who}")
    db.session.commit()

    r = client.post("/api/bookings", json=book, headers=login["asha"])
    assert r.status_code == 201 and r.get_json()["counselingMinutes"] == 0
    booking = r.get_json()["booking"]
    assert booking["status"] == "confirmed" and booking["minutes"] == 60 and booking["meetingUrl"]

    r = client.post("/api/bookings", json=book, headers=login["ben"])  # the same time, a moment later
    assert r.status_code == 409 and minutes(ids["ben"]) == 60          # refused, and Ben keeps his hour

    r = client.post(f"/api/bookings/{booking['id']}/cancel", headers=login["asha"])
    assert r.status_code == 200 and r.get_json()["counselingMinutes"] == 60
    assert db.session.get(Booking, booking["id"]).status == "cancelled"

    r = client.post("/api/bookings", json=book, headers=login["ben"])  # the time is free again
    assert r.status_code == 201 and minutes(ids["ben"]) == 0


def test_a_student_and_the_mentor_they_booked_can_message_each_other(site):
    client, ids, login = site
    thread = f"/api/mentor-chats/{ids['profile']}/{ids['asha']}/messages"

    r = client.post(thread, json={"body": "Hello"}, headers=login["asha"])
    assert r.status_code == 403  # not booked yet

    credit(buy(ids["asha"], ids["package"]), "pay_asha")
    db.session.commit()
    assert client.post("/api/bookings", json={"slotId": ids["slot"]}, headers=login["asha"]).status_code == 201

    assert client.post(thread, json={"body": "Hello, can you look at my <b>SOP</b>?"}, headers=login["asha"]).status_code == 201
    inbox = client.get("/api/mentor-chats", headers=login["mentor"]).get_json()
    assert len(inbox) == 1 and inbox[0]["asMentor"] and inbox[0]["unread"] == 1 and inbox[0]["with"]["username"] == "asha"

    seen = client.get(thread, headers=login["mentor"]).get_json()
    assert [m["body"] for m in seen] == ["Hello, can you look at my SOP?"]  # tags are stripped like any other text
    assert client.get("/api/mentor-chats", headers=login["mentor"]).get_json()[0]["unread"] == 0  # reading marks it read
    assert client.post(thread, json={"body": "Yes, send it over."}, headers=login["mentor"]).status_code == 201
    assert client.get("/api/mentor-chats", headers=login["asha"]).get_json()[0]["unread"] == 1

    assert client.get(thread, headers=login["ben"]).status_code == 404  # nobody else can open it
    assert client.get("/api/mentor-chats", headers=login["ben"]).get_json() == []
