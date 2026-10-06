from datetime import date, datetime, timedelta, timezone

from app import create_app
from app.config import TestConfig
from app.models import User
from app.services.moderation import censor, strike_action
from app.services.ranking import hot_score

NOW = datetime(2026, 10, 1, tzinfo=timezone.utc)


def test_health():
    client = create_app(TestConfig).test_client()
    assert client.get("/api/health").get_json() == {"status": "ok"}


def test_hot_prefers_recent_over_slightly_higher_score():
    old = hot_score(20, NOW - timedelta(hours=24))
    new = hot_score(15, NOW)
    assert new > old


def test_hot_negative_score_ranks_below_zero():
    assert hot_score(-5, NOW) < hot_score(0, NOW)


def test_age_gate_boundary():
    assert User.age_on(date(2008, 10, 5), today=date(2026, 10, 5)) == 18
    assert User.age_on(date(2008, 10, 6), today=date(2026, 10, 5)) == 17


def test_censor_and_strikes():
    assert censor("You are an Idiot.") == ("You are an ****.", True)
    assert censor("Visa help please") == ("Visa help please", False)
    assert [strike_action(n) for n in (1, 2, 3)] == [
        "warn_and_delete", "mute_24h", "suspend_pending_review"]
