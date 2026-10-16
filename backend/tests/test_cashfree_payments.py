"""Buying counselling hours through Cashfree, with Cashfree itself stood in for.

What matters here: hours are added only when Cashfree says PAID, they are added once however many
callbacks arrive, and a browser that claims success on its own gets nothing.
"""
import base64
import hashlib
import hmac

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import CounselingPackage, Payment, User
from app.services import payments

TABLES = [db.metadata.tables[t] for t in ("countries", "users", "identity_verifications",
                                          "counseling_packages", "payments", "mentor_profiles", "mentor_countries",
                                          "communities", "subjects", "bookings", "availability_slots")]
SECRET = "test-secret"


class PayConfig(TestConfig):
    CASHFREE_APP_ID = "TEST_APP"
    CASHFREE_SECRET_KEY = SECRET
    CASHFREE_ENV = "sandbox"


@pytest.fixture
def site(monkeypatch):
    app = create_app(PayConfig)
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        asha = User(email="asha@example.org", username="asha", display_name="Asha Rao",
                    status="active", email_verified=True)
        package = CounselingPackage(title="1 hour", hours=1, price_minor=85000, is_active=True)
        db.session.add_all([asha, package])
        db.session.commit()

        calls = {"status": "ACTIVE", "orders": []}

        def create_order(order_id, amount_minor, currency, customer, note=None):
            calls["orders"].append({"order_id": order_id, "amount": payments.rupees(amount_minor),
                                    "currency": currency, "customer": customer})
            return {"order_id": order_id, "payment_session_id": f"session_{order_id}",
                    "order_status": "ACTIVE"}

        monkeypatch.setattr(payments, "create_order", create_order)
        monkeypatch.setattr(payments, "order_status", lambda order_id: calls["status"])
        head = {"Authorization": f"Bearer {create_access_token(str(asha.id))}"}
        yield app.test_client(), asha.id, package.id, head, calls


def minutes(user_id):
    db.session.expire_all()
    return db.session.get(User, user_id).counseling_minutes


def test_hours_arrive_only_once_cashfree_says_paid(site):
    client, asha_id, package_id, head, calls = site

    opened = client.post(f"/api/packages/{package_id}/order", headers=head)
    assert opened.status_code == 201, opened.get_json()
    body = opened.get_json()
    pay = db.session.get(Payment, body["paymentId"])

    # The browser is handed a session to open, never a key or a signature to pass back
    assert body["checkout"]["paymentSessionId"] == f"session_{pay.gateway_order_id}"
    assert body["checkout"]["mode"] == "sandbox" and "key" not in body["checkout"]
    # ...and Cashfree was asked for rupees, not paise
    assert calls["orders"][0]["amount"] == 850.0 and calls["orders"][0]["order_id"] == f"tym-{pay.id}"
    assert minutes(asha_id) == 0  # nothing yet

    # A browser claiming success while Cashfree still says ACTIVE buys nothing
    refused = client.post(f"/api/packages/payments/{pay.id}/verify", headers=head, json={})
    assert refused.status_code == 400 and minutes(asha_id) == 0

    calls["status"] = "PAID"
    done = client.post(f"/api/packages/payments/{pay.id}/verify", headers=head, json={"cfPaymentId": "cf_1"})
    assert done.status_code == 200
    assert minutes(asha_id) == 60 and done.get_json()["counselingMinutes"] == 60
    assert done.get_json()["invoiceNumber"].startswith("TYM-")

    # Checkout and the webhook both land: the hours are still added once
    assert client.post(f"/api/packages/payments/{pay.id}/verify", headers=head, json={}).status_code == 200
    assert minutes(asha_id) == 60


def test_the_webhook_credits_when_the_browser_never_comes_back(site):
    client, asha_id, package_id, head, calls = site

    opened = client.post(f"/api/packages/{package_id}/order", headers=head).get_json()
    pay = db.session.get(Payment, opened["paymentId"])
    calls["status"] = "PAID"

    raw = ('{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"%s"},'
           '"payment":{"cf_payment_id":"cf_9","payment_status":"SUCCESS"}}}' % pay.gateway_order_id).encode()
    stamp = "1760000000"
    signature = base64.b64encode(
        hmac.new(SECRET.encode(), stamp.encode() + raw, hashlib.sha256).digest()).decode()

    sent = client.post("/api/payments/cashfree/webhook", data=raw,
                       headers={"x-webhook-timestamp": stamp, "x-webhook-signature": signature,
                                "Content-Type": "application/json"})
    assert sent.status_code == 200 and minutes(asha_id) == 60

    # The same webhook delivered twice does not pay twice
    client.post("/api/payments/cashfree/webhook", data=raw,
                headers={"x-webhook-timestamp": stamp, "x-webhook-signature": signature,
                         "Content-Type": "application/json"})
    assert minutes(asha_id) == 60


def test_a_forged_webhook_is_refused(site):
    client, asha_id, package_id, head, calls = site

    opened = client.post(f"/api/packages/{package_id}/order", headers=head).get_json()
    pay = db.session.get(Payment, opened["paymentId"])
    calls["status"] = "PAID"

    raw = ('{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"%s"}}}' % pay.gateway_order_id).encode()
    bad = client.post("/api/payments/cashfree/webhook", data=raw,
                      headers={"x-webhook-timestamp": "1760000000", "x-webhook-signature": "nope",
                               "Content-Type": "application/json"})
    assert bad.status_code == 400 and minutes(asha_id) == 0


def test_nobody_buys_hours_for_somebody_else(site):
    client, _asha_id, package_id, head, calls = site

    opened = client.post(f"/api/packages/{package_id}/order", headers=head).get_json()
    pay = db.session.get(Payment, opened["paymentId"])
    calls["status"] = "PAID"

    ben = User(email="ben@example.org", username="ben", display_name="Ben", status="active", email_verified=True)
    db.session.add(ben)
    db.session.commit()
    theirs = {"Authorization": f"Bearer {create_access_token(str(ben.id))}"}
    assert client.post(f"/api/packages/payments/{pay.id}/verify", headers=theirs, json={}).status_code == 404
    assert minutes(ben.id) == 0
