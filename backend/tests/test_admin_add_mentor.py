"""A mentor the team puts on the site itself, with no application (api/admin.py).

The account and the profile are made together, so the mentor is listed straight away. Session
length and weekly hours are not asked for here: the mentor sets both in their own settings.
"""
import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.api import admin as admin_api
from app.config import TestConfig
from app.extensions import db
from app.models import Community, Country, MentorApplication, MentorProfile, Subject, User

TABLES = [db.metadata.tables[t] for t in ("countries", "subjects", "communities", "users",
                                          "identity_verifications", "mentor_profiles", "mentor_countries", "mentor_reviews",
                                          "mentor_applications", "availability_slots", "bookings",
                                          "moderation_logs")]

MENTOR = {"name": "Sumayya Samreen", "email": "sumayya@example.org", "password": "a-long-password",
          "countries": ["uk", "usa"], "university": "Royal Holloway", "course": "MSc Artificial Intelligence",
          "headline": "I help students apply to UK universities on a budget.", "topics": "Applications, Housing"}


@pytest.fixture
def site(monkeypatch):
    app = create_app(TestConfig)
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        monkeypatch.setattr(admin_api.mailer, "send_quietly", lambda *a, **kw: None)
        db.session.add_all([
            Community(subject=Subject(slug="study-abroad", name="Study Abroad", is_active=True),
                      country=Country(slug="uk", name="United Kingdom", iso_code="GB"), is_active=True),
            User(email="boss@example.org", username="boss", display_name="Boss", role="admin",
                 status="active", email_verified=True, admin_access=["*"])])
        db.session.flush()
        # A second country to be listed in as well as the home one
        subject = db.session.scalar(db.select(Subject))
        db.session.add(Community(subject_id=subject.id,
                                 country=Country(slug="usa", name="United States", iso_code="US"), is_active=True))
        db.session.commit()
        boss = db.session.scalar(db.select(User).where(User.username == "boss"))
        yield app.test_client(), {"Authorization": f"Bearer {create_access_token(str(boss.id))}"}


def test_the_team_adds_a_mentor_and_they_are_listed(site):
    client, admin = site
    res = client.post("/api/admin/mentors", headers=admin, json=MENTOR)
    assert res.status_code == 201, res.get_json()

    m = db.session.get(MentorProfile, res.get_json()["id"])
    assert m.is_verified and m.topics == ["Applications", "Housing"]
    assert m.session_minutes == 30 and m.weekly_hours == {}  # theirs to set, in /my/mentor
    # The account can log in on the site as a mentor from the moment it is made
    assert m.user.role == "mentor" and m.user.status == "active" and m.user.email_verified
    assert client.get("/api/mentors").get_json()[0]["user"]["displayName"] == "Sumayya Samreen"


def test_what_the_form_will_not_take(site):
    client, admin = site
    for bad in ({"name": "S"}, {"email": "not-an-email"}, {"countries": ["narnia"]}, {"countries": []},
                {"headline": ""}, {"university": ""}, {"password": "short"}):
        res = client.post("/api/admin/mentors", headers=admin, json={**MENTOR, **bad})
        assert res.status_code == 400, (bad, res.get_json())

    assert client.post("/api/admin/mentors", headers=admin, json=MENTOR).status_code == 201
    twice = client.post("/api/admin/mentors", headers=admin, json=MENTOR)
    assert twice.status_code == 409  # the same email twice is one account, not two


def test_only_a_mentor_the_team_added_may_have_its_listing_edited(site):
    """A mentor who applied wrote their own profile and the team approved those words. Editing them
    afterwards would put the team's words under someone else's name and photo."""
    client, admin = site
    ours = client.post("/api/admin/mentors", headers=admin, json=MENTOR).get_json()["id"]
    assert client.get(f"/api/admin/mentors/{ours}", headers=admin).get_json()["ours"] is True
    fix = client.patch(f"/api/admin/mentors/{ours}", headers=admin, json={"headline": "A better headline for them"})
    assert fix.status_code == 200, fix.get_json()

    # the same profile, once an application sits behind it, is theirs and not the team's
    m = db.session.get(MentorProfile, ours)
    db.session.add(MentorApplication(
        user_id=m.user_id, community_id=m.community_id, university="Leeds", course="MSc",
        graduation_year=2024, headline="Their own headline", about="x" * 200, topics=["Visas"],
        languages=["English"], timezone="Europe/London", details={}, cv_key="cv.pdf",
        proof_key="proof.pdf", status="approved"))
    db.session.commit()

    assert client.get(f"/api/admin/mentors/{ours}", headers=admin).get_json()["ours"] is False
    refused = client.patch(f"/api/admin/mentors/{ours}", headers=admin, json={"headline": "Rewriting their words"})
    assert refused.status_code == 403
    assert db.session.get(MentorProfile, ours).headline == "A better headline for them"

    listed = client.get("/api/admin/mentors", headers=admin).get_json()
    assert [row["ours"] for row in listed] == [False]
    # hiding them is still the team's call either way
    assert client.post(f"/api/admin/mentors/{ours}/listed", headers=admin, json={"listed": False}).status_code == 200


def test_a_mentor_is_found_under_every_country_they_mentor_for(site):
    """A mentor who studied in the UK and can also advise on the USA belongs in both lists."""
    client, admin = site
    client.post("/api/admin/mentors", headers=admin, json=MENTOR)

    for slug in ("uk", "usa"):
        found = client.get(f"/api/mentors?country={slug}").get_json()
        assert [m["user"]["displayName"] for m in found] == ["Sumayya Samreen"], slug
    assert client.get("/api/mentors?country=narnia").get_json() == []

    only = client.get("/api/mentors").get_json()[0]
    assert [c["slug"] for c in only["countries"]] == ["uk", "usa"]
    assert only["community"]["country"]["slug"] == "uk"  # the first one ticked is the home country
