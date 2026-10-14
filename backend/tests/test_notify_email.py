"""Who gets an email about a reply, and who does not (services/notify.py).

The rules matter more than the sending: email the wrong people and they mark it as spam, which
costs the whole domain its deliverability.
"""
from types import SimpleNamespace as N

import pytest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import Notification, Post, User
from app.models.base import utcnow
from app.services import notify as notify_service

TABLES = [db.metadata.tables[t] for t in ("countries", "users", "identity_verifications", "notifications")]


@pytest.fixture
def site(monkeypatch):
    app = create_app(TestConfig)
    app.config["SITE_URL"] = "https://theyouthmatters.com"
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        sent = []
        monkeypatch.setattr(notify_service.mailer, "send_quietly",
                            lambda to, subject, html, **kw: sent.append((to, subject, html)))

        def person(name, **kw):
            kw.setdefault("status", "active")
            # Reply email is off until a member asks for it, so everyone here has asked except
            # "quiet", who is the one testing that the switch is honoured.
            kw.setdefault("notify_email", True)
            u = User(email=f"{name}@example.org", username=name, display_name=name.title(),
                     email_verified=True, **kw)
            db.session.add(u)
            return u

        asha = person("asha")
        ben = person("ben")
        here = person("here")
        quiet = person("quiet", notify_email=False)
        shut = person("shut", status="suspended")
        db.session.commit()
        # A post row is needed for the link, but posts carry a PostgreSQL column: stand one in
        post = N(id=7, title="How do I show proof of funds?")
        with app.test_request_context():
            yield app, sent, post, {"asha": asha, "ben": ben, "here": here, "quiet": quiet, "shut": shut}


def run(sent, post, to, actor, kind, body="Here is what I did."):
    notify_service.notify(to.id, actor, kind, post, N(id=1, body=body))
    db.session.commit()
    notify_service.send_pending()
    return sent


def test_an_answer_to_your_question_reaches_your_inbox(site):
    _app, sent, post, who = site
    run(sent, post, who["asha"], who["ben"], "answer")

    assert len(sent) == 1
    to, subject, html = sent[0]
    assert to == "asha@example.org"
    assert subject == "Ben answered your question"
    assert "How do I show proof of funds?" in html and "Here is what I did." in html
    assert "https://theyouthmatters.com/p/7" in html
    assert "/settings" in html  # how to turn it off, in every one


def read_the_bell(person):
    db.session.execute(db.update(Notification).where(Notification.user_id == person.id).values(is_read=True))
    db.session.commit()


def test_a_reply_and_a_mention_are_emailed_too(site):
    _app, sent, post, who = site
    run(sent, post, who["asha"], who["ben"], "reply")
    read_the_bell(who["asha"])
    run(sent, post, who["asha"], who["ben"], "mention")
    assert [s[1] for s in sent] == ["Ben replied to you", "Ben mentioned you"]


def test_only_the_first_of_a_run_is_emailed(site):
    """A busy thread must not fill an inbox: one email, then the bell until they come and read it."""
    _app, sent, post, who = site
    for _ in range(4):
        run(sent, post, who["asha"], who["ben"], "reply")
    assert [s[1] for s in sent] == ["Ben replied to you"]
    assert db.session.scalar(db.select(db.func.count(Notification.id))) == 4  # the bell has all four

    read_the_bell(who["asha"])  # reading it starts the next run
    run(sent, post, who["asha"], who["ben"], "reply")
    assert len(sent) == 2


def test_votes_and_the_rest_stay_on_the_bell(site):
    _app, sent, post, who = site
    for kind in ("upvote", "followed_post", "system", "moderation"):
        notify_service.notify(who["asha"].id, who["ben"], kind, post)
    db.session.commit()
    notify_service.send_pending()
    assert sent == []
    # ...but the bell still has every one of them
    assert db.session.scalar(db.select(db.func.count(Notification.id))) == 4


def test_nobody_is_emailed_who_should_not_be(site):
    _app, sent, post, who = site
    run(sent, post, who["quiet"], who["ben"], "answer")   # turned it off in settings
    run(sent, post, who["shut"], who["ben"], "answer")    # suspended account
    notify_service.notify(who["ben"].id, who["ben"], "answer", post)  # their own doing
    db.session.commit()
    notify_service.send_pending()
    assert sent == []


def test_being_on_the_site_does_not_swallow_the_email(site):
    """There is no "probably still reading" guess any more: it keyed off last_seen_at, which is
    written once at sign-up and never updated, so it silently dropped mail to new accounts."""
    _app, sent, post, who = site
    who["here"].last_seen_at = utcnow()
    db.session.commit()
    run(sent, post, who["here"], who["ben"], "answer")
    assert len(sent) == 1 and sent[0][0] == "here@example.org"


def test_nothing_is_emailed_when_the_answer_did_not_save(site):
    """notify() only queues. Without the commit and the send_pending() after it, nothing goes."""
    _app, sent, post, who = site
    notify_service.notify(who["asha"].id, who["ben"], "answer", post, N(id=1, body="x"))
    db.session.rollback()
    assert sent == []
