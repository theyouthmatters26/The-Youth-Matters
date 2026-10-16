"""Turning down a mentor application: the email goes, then the account does.

Whoever they are, the team's note reaches them: it is the only thing that says what to change.
The account exists only to carry the application, so it is closed with it. What this must never do
is close an account that had a life here before the form: a student who also applied, or somebody
on the team.
"""
import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.api import mentor_applications as ma
from app.config import TestConfig
from app.extensions import db
from app.models import AccountClosure, Community, Country, MentorApplication, Subject, User

TABLES = [db.metadata.tables[t] for t in ("countries", "subjects", "communities", "users",
                                          "identity_verifications", "mentor_applications",
                                          "mentor_profiles", "moderation_logs", "notifications",
                                          "account_closures", "availability_slots")]
NOTE = "Please add proof of your degree and a clearer CV."


@pytest.fixture
def site(monkeypatch):
    app = create_app(TestConfig)
    app.config["SITE_URL"] = "https://theyouthmatters.com"
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        sent = []
        monkeypatch.setattr(ma.mailer, "send_quietly",
                            lambda to, subject, html, **kw: sent.append((to, subject, html)))
        # erase() walks tables this fixture does not build; the account going is what matters here
        monkeypatch.setattr(ma.accounts, "erase", lambda u, blog_author_id=None: (db.session.delete(u), [])[1])
        monkeypatch.setattr(ma.accounts, "has_records", lambda u: False)

        community = Community(subject=Subject(slug="study-abroad", name="Study Abroad", is_active=True),
                              country=Country(slug="uk", name="United Kingdom", iso_code="GB"), is_active=True)
        boss = User(email="boss@example.org", username="boss", display_name="Boss", role="admin",
                    status="active", email_verified=True, admin_access=["*"])
        db.session.add_all([community, boss])
        db.session.commit()

        def applicant(name, **kw):
            kw.setdefault("role", "mentor")
            kw.setdefault("status", "pending")
            u = User(email=f"{name}@example.org", username=name, display_name=name.title(),
                     email_verified=True, **kw)
            db.session.add(u)
            db.session.flush()
            a = MentorApplication(user_id=u.id, community_id=community.id, university="Leeds",
                                  course="MSc", graduation_year=2024, graduated=True,
                                  headline="Helps with UK visas and SOPs", about="x" * 200,
                                  topics=["Visas"], languages=["English"], session_minutes=60,
                                  timezone="Europe/London", weekly_hours={"mon": ["18:00"]},
                                  details={}, cv_key="cv.pdf", proof_key="proof.pdf")
            db.session.add(a)
            db.session.commit()
            return u, a

        yield (app.test_client(), sent, applicant,
               {"Authorization": f"Bearer {create_access_token(str(boss.id))}"})


def reject(client, head, application_id, note=NOTE):
    return client.post(f"/api/admin/mentor-applications/{application_id}/decision",
                       headers=head, json={"approve": False, "note": note})


def test_a_turned_down_applicant_is_emailed_and_the_account_closed(site):
    client, sent, applicant, head = site
    user, application = applicant("riya")
    user_id = user.id

    assert reject(client, head, application.id).status_code == 200

    # the email goes first, while the address still exists
    assert len(sent) == 1
    to, subject, html = sent[0]
    assert to == "riya@example.org" and subject == "Your TYM mentor application"
    assert NOTE in html                                        # why, in the team's own words
    assert "https://theyouthmatters.com/mentors/signup" in html  # apply again
    assert "https://theyouthmatters.com/register" in html        # or join as a student

    assert db.session.get(User, user_id) is None               # ...and then the account goes

    note = db.session.scalar(db.select(AccountClosure))
    assert note.email == "riya@example.org" and NOTE in note.reason and note.kept is False


def test_an_account_that_is_more_than_an_application_is_left_alone(site):
    client, sent, applicant, head = site
    student, application = applicant("asha", role="student", status="active")
    teammate, their_application = applicant("sam", role="admin", status="active")

    for a in (application, their_application):
        assert reject(client, head, a.id).status_code == 200

    assert db.session.get(User, student.id) is not None
    assert db.session.get(User, teammate.id) is not None
    assert db.session.scalar(db.select(AccountClosure)) is None  # nothing was closed

    # They are still told why: whoever they are, the same email goes with the team's reasons in it
    assert [to for to, _subject, _html in sent] == ["asha@example.org", "sam@example.org"]
    for _to, subject, html in sent:
        assert subject == "Your TYM mentor application" and NOTE in html
        assert "https://theyouthmatters.com/mentors/signup" in html


def test_the_note_is_what_the_email_is_for(site):
    """No note, no email worth sending: the form refuses the decision before it reaches them."""
    client, sent, applicant, head = site
    _user, application = applicant("nina")

    too_short = reject(client, head, application.id, note="no")
    assert too_short.status_code == 400 and sent == []
    assert db.session.get(MentorApplication, application.id).status == "pending"


def test_approving_still_opens_the_account(site):
    client, sent, applicant, head = site
    user, application = applicant("maya")

    ok = client.post(f"/api/admin/mentor-applications/{application.id}/decision",
                     headers=head, json={"approve": True})
    assert ok.status_code == 200
    db.session.expire_all()
    opened = db.session.get(User, user.id)
    assert opened is not None and opened.status == "active" and opened.role == "mentor"
    assert sent == [] and db.session.scalar(db.select(AccountClosure)) is None
