"""The booking form reaches three places at once (api/contact.py).

A student fills it in while sessions are still arranged by hand, so the request has to land in the
admin inbox, in the team's email, and back in the student's own inbox. Losing the last one is the
one that costs us: they have paid and heard nothing.
"""
import pytest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import ContactMessage
from app.api import contact as contact_api

TABLES = [db.metadata.tables["contact_messages"]]


class NoLimit(TestConfig):
    RATELIMIT_ENABLED = False


@pytest.fixture
def site(monkeypatch):
    app = create_app(NoLimit)
    app.config["CONTACT_EMAIL"] = "team@theyouthmatters.com"
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        sent = []
        monkeypatch.setattr(contact_api.mailer, "send_quietly",
                            lambda to, subject, html, **kw: sent.append((to, subject, html)))
        yield app.test_client(), sent
        db.session.remove()
        db.metadata.drop_all(db.engine, tables=TABLES)


FORM = {"name": "Asha Rao", "email": "Asha@Example.org", "topic": "Mentorship session",
        "message": "I would like help choosing universities in the UK.",
        "details": {"Plan": "5 hours \u2014 \u20b94,000", "WhatsApp": "+91 90000 00000"}}


def test_the_team_and_the_student_both_get_an_email(site):
    client, sent = site
    assert client.post("/api/contact", json=FORM).status_code == 200

    to = [row[0] for row in sent]
    assert to == ["team@theyouthmatters.com", "Asha@Example.org"]
    # The team's copy carries the answers; the student's says what happens next
    assert "5 hours" in sent[0][2] and "+91 90000 00000" in sent[0][2]
    assert "session request" in sent[1][1]
    assert "Asha" in sent[1][2] and "not confirmed" in sent[1][2]


def test_the_request_is_in_the_admin_inbox_with_its_plan(site):
    client, _sent = site
    client.post("/api/contact", json=FORM)

    row = db.session.scalar(db.select(ContactMessage))
    assert row.topic == "Mentorship session"
    assert row.email == "asha@example.org"          # stored lower case, however they typed it
    assert row.details["Plan"] == "5 hours \u2014 \u20b94,000"


def test_other_topics_still_get_a_plainer_acknowledgement(site):
    client, sent = site
    client.post("/api/contact", json={**FORM, "topic": "Partnerships"})

    assert sent[1][1] == "We have your message"
    assert "reply within a day" in sent[1][2]


def test_a_form_with_no_email_reaches_nobody(site):
    client, sent = site
    assert client.post("/api/contact", json={**FORM, "email": "not-an-address"}).status_code == 400
    assert sent == []
    assert db.session.scalar(db.select(ContactMessage)) is None
