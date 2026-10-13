"""Five messages to a person, then the student is told so (api/ai.py).

The count starts when they ask for a person, not at the top of the conversation: whatever they said
to TYMAi beforehand does not come off their allowance.
"""
import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.api import ai as ai_api
from app.config import TestConfig
from app.extensions import db
from app.models import AiConversation, AiMessage, User

TABLES = [db.metadata.tables[t] for t in ("countries", "users", "identity_verifications",
                                          "ai_conversations", "ai_messages", "notifications")]


class NoLimit(TestConfig):
    # Off before create_app, not after: the limiter reads this when it is built, and its counters
    # live for the whole test run, so a user id reused by another file would trip this one.
    RATELIMIT_ENABLED = False


@pytest.fixture
def site(monkeypatch):
    app = create_app(NoLimit)
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        monkeypatch.setattr(ai_api.handoff, "alert_team", lambda c, heading: None)
        monkeypatch.setattr(ai_api.tymai, "answer", lambda user, q, history=(): ("Here is an answer.", []))
        asha = User(email="asha@example.org", username="asha", display_name="Asha", status="active",
                    email_verified=True)
        db.session.add(asha)
        db.session.commit()
        head = {"Authorization": f"Bearer {create_access_token(str(asha.id))}"}
        yield app.test_client(), head


def say(client, head, body, convo=None):
    return client.post("/api/ai/messages", headers=head,
                       json={"body": body, "conversationId": convo})


def test_five_messages_to_a_person_then_the_student_is_told(site):
    client, head = site

    # Three with TYMAi first: these must not count against the allowance
    convo = say(client, head, "Hi, what do I need for a UK visa?").get_json()["conversation"]["id"]
    say(client, head, "And for Ireland?", convo)
    say(client, head, "Thanks", convo)

    asked = client.post(f"/api/ai/conversations/{convo}/human", headers=head, json={})
    assert asked.status_code == 200 and asked.get_json()["status"] == "waiting"

    for n in range(5):
        sent = say(client, head, f"message {n + 1}", convo)
        assert sent.status_code == 201, f"message {n + 1} was refused: {sent.get_json()}"

    over = say(client, head, "message 6", convo)
    assert over.status_code == 403
    assert "5 messages" in over.get_json()["message"]
    assert "support@theyouthmatters.com" in over.get_json()["message"]

    # The one over the line is not kept either
    kept = db.session.scalars(db.select(AiMessage).where(
        AiMessage.conversation_id == convo, AiMessage.role == "user")).all()
    assert [m.content for m in kept].count("message 6") == 0
    assert len(kept) == 8  # 3 to TYMAi + 5 to the team


def test_cancelling_the_request_gives_tymai_back(site):
    client, head = site
    convo = say(client, head, "Hello").get_json()["conversation"]["id"]
    client.post(f"/api/ai/conversations/{convo}/human", headers=head, json={})
    for n in range(5):
        say(client, head, f"message {n + 1}", convo)
    assert say(client, head, "one more", convo).status_code == 403

    back = client.post(f"/api/ai/conversations/{convo}/human", headers=head, json={"cancel": True})
    assert back.status_code == 200 and back.get_json()["status"] == "ai"
    assert say(client, head, "ask TYMAi instead", convo).status_code == 201


def test_talking_to_tymai_alone_is_never_capped(site):
    client, head = site
    convo = say(client, head, "First question").get_json()["conversation"]["id"]
    for n in range(8):
        assert say(client, head, f"question {n + 2}", convo).status_code == 201
    assert db.session.get(AiConversation, convo).status == "ai"
