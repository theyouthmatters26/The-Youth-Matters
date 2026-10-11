import base64
import hashlib
import hmac
from datetime import date, datetime, timezone

from app import create_app
from app.config import TestConfig
from app.services import payments
from app.services.availability import session_times


class PayConfig(TestConfig):
    CASHFREE_APP_ID = "TEST_APP"
    CASHFREE_SECRET_KEY = "secret"
    CASHFREE_ENV = "sandbox"


def sign(secret, timestamp, body):
    """How Cashfree signs: base64 of HMAC-SHA256 over the timestamp followed by the raw body."""
    digest = hmac.new(secret.encode(), f"{timestamp}".encode() + body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


def test_webhook_signatures():
    with create_app(PayConfig).app_context():
        body = b'{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_amount":850.00}}}'
        assert payments.valid_webhook("1760000000", body, sign("secret", "1760000000", body))
        # The body has to be the bytes that arrived, and the timestamp has to be the one signed
        assert not payments.valid_webhook("1760000000", body + b" ", sign("secret", "1760000000", body))
        assert not payments.valid_webhook("1760000001", body, sign("secret", "1760000000", body))
        assert not payments.valid_webhook("1760000000", body, None)
        assert not payments.valid_webhook(None, body, sign("secret", "None", body))


def test_webhook_rejected_without_a_secret():
    with create_app(TestConfig).app_context():
        assert not payments.valid_webhook("1760000000", b"{}", sign("", "1760000000", b"{}"))


def test_amounts_go_to_cashfree_in_rupees():
    """We keep paise; Cashfree wants rupees. Getting this wrong charges 100x or 1/100th."""
    assert payments.rupees(85000) == 850.0
    assert payments.rupees(425000) == 4250.0
    assert payments.rupees(100000) == 1000.0
    assert payments.rupees(1) == 0.01


def test_session_times_follow_the_mentors_clock_across_dst():
    hours = {"sat": ["10:00"]}
    # London: 10:00 is 09:00 UTC in summer time and 10:00 UTC after the clocks go back (25 Oct 2026)
    times = list(session_times(hours, "Europe/London", 30, date(2026, 10, 17), days=7))
    assert times == [
        (datetime(2026, 10, 17, 9, 0, tzinfo=timezone.utc), datetime(2026, 10, 17, 9, 30, tzinfo=timezone.utc)),
        (datetime(2026, 10, 24, 9, 0, tzinfo=timezone.utc), datetime(2026, 10, 24, 9, 30, tzinfo=timezone.utc)),
    ]
    after = list(session_times(hours, "Europe/London", 30, date(2026, 10, 31), days=0))
    assert after[0][0] == datetime(2026, 10, 31, 10, 0, tzinfo=timezone.utc)
