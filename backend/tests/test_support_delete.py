"""Deleting a conversation from the support inbox: who may, and what goes with it."""
import pytest
import sqlalchemy as sa
from flask_jwt_extended import create_access_token

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import AiConversation, AiMessage, ModerationLog, User

TABLES = [db.metadata.tables[t] for t in ("countries", "users", "identity_verifications", "ai_conversations",
                                          "ai_messages", "moderation_logs")]


@pytest.fixture
def site():
    app = create_app(TestConfig)
    with app.app_context():
        # PostgreSQL enforces ON DELETE CASCADE; SQLite only does when asked. Ask, so this test
        # checks what production actually does when a conversation row goes.
        sa.event.listen(db.engine, "connect",
                        lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
        db.metadata.create_all(db.engine, tables=TABLES)
        boss = User(email="boss@example.org", username="boss", display_name="Boss", role="admin",
                    status="active", email_verified=True, admin_access=["*"])
        asha = User(email="asha@example.org", username="asha", display_name="Asha", status="active",
                    email_verified=True)
        db.session.add_all([boss, asha])
        db.session.flush()
        convo = AiConversation(user_id=asha.id, title="Hi", status="waiting")
        db.session.add(convo)
        db.session.flush()
        db.session.add_all([AiMessage(conversation_id=convo.id, role="user", content="hi"),
                            AiMessage(conversation_id=convo.id, role="assistant", content="hello")])
        db.session.commit()
        head = {n: {"Authorization": f"Bearer {create_access_token(str(i))}"}
                for n, i in (("boss", boss.id), ("asha", asha.id))}
        yield app.test_client(), convo.id, head


def test_the_team_can_delete_a_conversation_and_its_messages(site):
    client, convo_id, head = site

    gone = client.delete(f"/api/admin/support/conversations/{convo_id}", headers=head["boss"])
    assert gone.status_code == 200 and gone.get_json() == {"deleted": True}

    assert db.session.get(AiConversation, convo_id) is None
    left = db.session.scalars(db.select(AiMessage).where(AiMessage.conversation_id == convo_id)).all()
    assert left == []  # the messages go with it
    logged = db.session.scalar(db.select(ModerationLog).where(ModerationLog.action == "support_deleted"))
    assert logged and logged.detail["title"] == "Hi"  # and the deletion is in the audit trail

    # Deleting it twice says so plainly instead of failing oddly
    assert client.delete(f"/api/admin/support/conversations/{convo_id}", headers=head["boss"]).status_code == 404


def test_a_member_cannot_delete_from_the_support_inbox(site):
    client, convo_id, head = site

    assert client.delete(f"/api/admin/support/conversations/{convo_id}", headers=head["asha"]).status_code == 403
    assert client.delete(f"/api/admin/support/conversations/{convo_id}").status_code in (401, 422)
    assert db.session.get(AiConversation, convo_id) is not None  # still there
