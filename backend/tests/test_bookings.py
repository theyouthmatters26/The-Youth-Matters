import hashlib
import hmac
from datetime import date, datetime, timezone

from app import create_app
from app.config import TestConfig
from app.services import payments
from app.services.availability import session_times


class PayConfig(TestConfig):
    RAZORPAY_KEY_ID = "rzp_test_123"
    RAZORPAY_KEY_SECRET = "secret"
    RAZORPAY_WEBHOOK_SECRET = "hook-secret"


def sign(secret, message):
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def test_checkout_and_webhook_signatures():
    with create_app(PayConfig).app_context():
        good = sign("secret", b"order_1|pay_1")
        assert payments.valid_payment("order_1", "pay_1", good)
        assert not payments.valid_payment("order_1", "pay_2", good)  # signature for another payment
        assert not payments.valid_payment("order_1", "pay_1", None)

        body = b'{"event":"payment.captured"}'
        assert payments.valid_webhook(body, sign("hook-secret", body))
        assert not payments.valid_webhook(body + b" ", sign("hook-secret", body))


def test_webhook_rejected_without_a_secret():
    with create_app(TestConfig).app_context():
        assert not payments.valid_webhook(b"{}", sign("", b"{}"))


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
