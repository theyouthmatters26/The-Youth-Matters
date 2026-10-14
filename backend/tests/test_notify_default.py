"""A new account is not emailed about replies until its owner asks to be."""
from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import User

TABLES = [db.metadata.tables[t] for t in ("countries", "users", "identity_verifications")]


def test_a_new_account_starts_with_reply_email_off():
    app = create_app(TestConfig)
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        u = User(email="new@example.org", username="new", display_name="New", status="active")
        db.session.add(u)
        db.session.commit()
        assert u.notify_email is False, "a new member must opt in, not opt out"
        db.session.remove()
        db.metadata.drop_all(db.engine, tables=TABLES)
