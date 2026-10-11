"""Closing your own account leaves the team a note of who left and why (api/users.py).

Erasing the account itself is `services/accounts.py` and goes nowhere near SQLite: posts carry a
PostgreSQL search column. It is stubbed here so the note, and who may read it, are what is checked.
"""
import bcrypt
import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.api import users as users_api
from app.config import TestConfig
from app.extensions import db
from app.models import AccountClosure, User

TABLES = [db.metadata.tables[t] for t in ("countries", "users", "identity_verifications", "account_closures")]
PASSWORD = "a-long-password"


@pytest.fixture
def site(monkeypatch):
    app = create_app(TestConfig)
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        stub = type("Accounts", (), {
            "has_records": staticmethod(lambda u: False),
            "erase": staticmethod(lambda u, blog_author_id=None: (db.session.delete(u), [])[1]),
            "close": staticmethod(lambda u: []),
            "remove_files": staticmethod(lambda files: None),
        })
        monkeypatch.setattr(users_api, "accounts", stub)
        boss = User(email="boss@example.org", username="boss", display_name="Boss", role="admin",
                    status="active", email_verified=True, admin_access=["*"])
        asha = User(email="asha@example.org", username="asha", display_name="Asha Rao", status="active",
                    email_verified=True, password_hash=bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode())
        db.session.add_all([boss, asha])
        db.session.commit()
        head = {n: {"Authorization": f"Bearer {create_access_token(str(i))}"}
                for n, i in (("boss", boss.id), ("asha", asha.id))}
        yield app.test_client(), asha.id, head


def test_the_reason_for_leaving_reaches_the_team(site):
    client, asha_id, head = site

    gone = client.delete("/api/users/me", headers=head["asha"],
                         json={"confirm": "DELETE", "password": PASSWORD, "reason": "Want to sign up as mentor."})
    assert gone.status_code == 200, gone.get_json()
    assert db.session.get(User, asha_id) is None  # the account itself still goes

    note = db.session.scalar(db.select(AccountClosure))
    assert note.display_name == "Asha Rao" and note.username == "asha" and note.email == "asha@example.org"
    assert note.reason == "Want to sign up as mentor." and note.kept is False

    shown = client.get("/api/admin/closures", headers=head["boss"]).get_json()["items"]
    assert len(shown) == 1 and shown[0]["reason"] == "Want to sign up as mentor."
    assert shown[0]["displayName"] == "Asha Rao" and shown[0]["kept"] is False


def test_leaving_without_a_reason_still_leaves_the_note(site):
    client, _asha_id, head = site

    assert client.delete("/api/users/me", headers=head["asha"],
                         json={"confirm": "DELETE", "password": PASSWORD}).status_code == 200
    note = db.session.scalar(db.select(AccountClosure))
    assert note.reason is None and note.username == "asha"


def test_a_wrong_password_leaves_no_note_and_no_deletion(site):
    client, asha_id, head = site

    refused = client.delete("/api/users/me", headers=head["asha"],
                            json={"confirm": "DELETE", "password": "not-it", "reason": "x"})
    assert refused.status_code == 403
    assert db.session.scalar(db.select(AccountClosure)) is None
    assert db.session.get(User, asha_id) is not None


def test_only_the_team_reads_the_deleted_list(site):
    client, _asha_id, head = site

    assert client.get("/api/admin/closures", headers=head["asha"]).status_code == 403
    assert client.get("/api/admin/closures").status_code in (401, 422)
