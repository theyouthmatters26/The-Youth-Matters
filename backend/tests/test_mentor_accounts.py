"""Mentor accounts are their own accounts: no photo ID, and approval is what opens them.

The flow: /mentors/signup makes a pending mentor account -> it can only write and send its
application -> the team approves it -> the account goes active and the profile is bookable.
"""
from types import SimpleNamespace

import pytest
from werkzeug.exceptions import Forbidden

from app.api import MENTOR_SIGN_UP, SIGN_UP, open_to_unverified
from app.api.mentor_applications import _applicant


def account(role="mentor", status="pending"):
    return SimpleNamespace(role=role, status=status)


def test_a_waiting_mentor_reaches_its_application_and_nothing_else(monkeypatch):
    import app.api as api

    def gate(path, user, method="POST"):
        monkeypatch.setattr(api, "request", SimpleNamespace(
            headers={"Authorization": "Bearer x"}, method=method, path=path))
        monkeypatch.setattr(api, "verify_jwt_in_request", lambda **_: None)
        monkeypatch.setattr(api, "current_user", user)
        return api.visitors_until_verified()

    waiting = account()
    for path in ("/api/mentor-application", "/api/users/me/avatar"):
        assert gate(path, waiting) is None, path          # this is their sign-up
    for path in ("/api/posts", "/api/bookings", "/api/chat/rooms/uk/messages"):
        with pytest.raises(Forbidden):                     # the rest of the site stays shut
            gate(path, waiting)

    # A student is still held to the photo-ID check, mentor routes or not
    with pytest.raises(Forbidden):
        gate("/api/mentor-application", account(role="student"))
    # An approved mentor is active, so the gate lets everything through
    assert gate("/api/posts", account(status="active")) is None


def test_only_a_mentor_account_may_send_an_application(monkeypatch):
    import app.api.mentor_applications as ma

    def applicant(user):
        monkeypatch.setattr(ma, "current_user", user)
        return _applicant()

    assert applicant(account()).role == "mentor"            # waiting for the team
    assert applicant(account(status="active")).role == "mentor"
    for user in (account(role="student"), account(role="student", status="active")):
        with pytest.raises(Forbidden):
            applicant(user)
    with pytest.raises(Forbidden):
        applicant(account(status="banned"))


def test_a_photo_id_cannot_open_a_mentor_account(monkeypatch):
    """Otherwise any 18+ ID would skip the team and make the account active."""
    import app.api.verify as verify

    monkeypatch.setattr(verify, "current_user",
                        SimpleNamespace(role="mentor", status="pending", email_verified=True, verification=None))
    plain = verify.document.__wrapped__.__wrapped__  # past @jwt_required and the rate limit
    with pytest.raises(Forbidden):
        plain()


def test_the_mentor_routes_are_not_open_to_everyone():
    # They are allowed by role inside visitors_until_verified, never by path alone
    for path in MENTOR_SIGN_UP:
        assert not open_to_unverified("POST", path), path
        assert not path.startswith(SIGN_UP), path
