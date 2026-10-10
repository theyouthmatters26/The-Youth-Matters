"""The whole mentor way in, over HTTP: sign up -> wait -> approved -> the account opens.

The pieces are covered on their own in test_mentor_accounts.py; this walks the real routes in order,
because that is the part that has to be right in production.
"""
import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.api import auth as auth_api
from app.config import TestConfig
from app.extensions import db
from app.models import Community, Country, MentorApplication, MentorProfile, Subject, User
from app.models.base import utcnow

TABLES = [db.metadata.tables[t] for t in ("countries", "subjects", "communities", "users", "identity_verifications",
                                          "mentor_profiles", "mentor_applications", "moderation_logs",
                                          "notifications", "availability_slots")]

MENTOR = {"displayName": "Riya Mehta", "email": "riya@example.org", "password": "a-long-password", "as": "mentor"}


class Local(TestConfig):
    DEBUG = True  # with no email provider the code comes back in the response (api/auth.py)


@pytest.fixture
def site(monkeypatch):
    # SQLite hands times back without a zone; PostgreSQL keeps it. Give the code check the same kind of "now".
    monkeypatch.setattr(auth_api, "utcnow", lambda: utcnow().replace(tzinfo=None))
    app = create_app(Local)
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        community = Community(subject=Subject(slug="study-abroad", name="Study Abroad", is_active=True),
                              country=Country(slug="uk", name="United Kingdom", iso_code="GB"), is_active=True)
        boss = User(email="boss@example.org", username="boss", display_name="Boss", role="admin",
                    status="active", email_verified=True, admin_access=["*"])
        db.session.add_all([community, boss])
        db.session.commit()
        yield app.test_client(), community.id, {"Authorization": f"Bearer {create_access_token(str(boss.id))}"}


def auth(res):
    return {"Authorization": f"Bearer {res.get_json()['access']}"}


def test_a_mentor_signs_up_waits_and_is_opened_by_the_team(site):
    client, community_id, admin = site

    # 1. Sign up as a mentor: an account that is "pending" and knows it is a mentor
    started = client.post("/api/auth/register", json=MENTOR)
    assert started.status_code == 201, started.get_json()
    code = started.get_json()["devCode"]
    session = client.post("/api/auth/verify-email", json={"email": MENTOR["email"], "code": code})
    assert session.status_code == 200, session.get_json()
    me, headers = session.get_json()["user"], auth(session)
    assert me["role"] == "mentor" and me["status"] == "pending" and me["verification"] == "mentor"

    # 2. While they wait, the application is the only thing the account can reach
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    assert client.get("/api/mentor-application", headers=headers).get_json() is None
    shut = client.post("/api/posts", headers=headers, json={"title": "hello", "body": "x" * 30})
    assert shut.status_code == 403 and "approved your application" in shut.get_json()["message"]
    # ...and a photo ID must not open it behind the team's back
    assert client.post("/api/verify/document", headers=headers, data={"documentType": "passport"}).status_code == 403

    # 3. The team approves the application
    user = db.session.scalar(db.select(User).where(User.email == MENTOR["email"]))
    db.session.add(MentorApplication(
        user_id=user.id, community_id=community_id, university="Leeds", course="MSc Data Science",
        graduation_year=2024, graduated=True, headline="Helps with UK visas and SOPs",
        about="x" * 200, topics=["Visas"], languages=["English"], session_minutes=60,
        timezone="Europe/London", weekly_hours={"mon": ["18:00", "19:00"]}, details={},
        cv_key="cv.pdf", proof_key="proof.pdf"))
    db.session.commit()
    application = db.session.scalar(db.select(MentorApplication))
    decided = client.post(f"/api/admin/mentor-applications/{application.id}/decision",
                          headers=admin, json={"approve": True})
    assert decided.status_code == 200, decided.get_json()

    # 4. Approval is what opens the account, and puts the profile on the site
    db.session.expire_all()
    user = db.session.scalar(db.select(User).where(User.email == MENTOR["email"]))
    assert user.status == "active" and user.role == "mentor"
    assert db.session.scalar(db.select(MentorProfile).where(MentorProfile.user_id == user.id)).is_verified
    assert client.get("/api/auth/me", headers=headers).get_json()["verification"] == "verified"
    assert client.post("/api/posts", headers=headers,
                       json={"title": "hello", "body": "x" * 30}).status_code != 403


def test_a_student_account_cannot_apply_to_mentor(site):
    client, _community_id, _admin = site

    started = client.post("/api/auth/register", json={k: v for k, v in MENTOR.items() if k != "as"}
                          | {"email": "sam@example.org"})
    session = client.post("/api/auth/verify-email",
                          json={"email": "sam@example.org", "code": started.get_json()["devCode"]})
    me, headers = session.get_json()["user"], auth(session)
    assert me["role"] == "student" and me["verification"] == "document"  # still the photo-ID route

    # A student is held at the age check, mentor routes included: mentors need their own account
    blocked = client.post("/api/mentor-application", headers=headers, data={})
    assert blocked.status_code == 403 and "age check" in blocked.get_json()["message"]


def test_a_mentor_cannot_sign_up_over_a_students_email(site):
    client, _community_id, _admin = site

    started = client.post("/api/auth/register", json={k: v for k, v in MENTOR.items() if k != "as"})
    client.post("/api/auth/verify-email", json={"email": MENTOR["email"], "code": started.get_json()["devCode"]})
    again = client.post("/api/auth/register", json=MENTOR)
    assert again.status_code == 409 and "Log in instead" in again.get_json()["message"]
