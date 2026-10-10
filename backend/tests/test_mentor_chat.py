import json

import pytest
from werkzeug.exceptions import BadRequest

from app.api.ai import WANTS_PERSON
from app.api.chat import ASKS_TYMAI
from app.api.mentor_applications import weekly_hours
from app.api.mentor_chat import MEETING_HOST, MEETING_LINK


def test_weekly_hours_keeps_valid_days_and_times():
    raw = json.dumps({"mon": ["18:00", "18:00", "25:00", "07:30"], "sat": ["10:00"], "xyz": ["09:00"], "tue": []})
    assert weekly_hours(raw) == {"mon": ["07:30", "18:00"], "sat": ["10:00"]}


def test_weekly_hours_needs_at_least_two_times():
    for raw in ('{"mon": ["18:00"]}', "not json", "[]", ""):
        with pytest.raises(BadRequest):
            weekly_hours(raw)


def test_tymai_is_asked_only_by_a_real_mention():
    assert ASKS_TYMAI.search("@TYMAi how long does a CAS take?")
    assert ASKS_TYMAI.search("hey @tymai, help")
    assert not ASKS_TYMAI.search("mail me at me@tymai.com")
    assert not ASKS_TYMAI.search("@tymaibot hello")


def test_asking_for_a_person_in_words_is_understood():
    for text in ("Can I talk to a human please?", "connect me to a real person", "I want to speak with someone from your team",
                 "I need an agent", "please transfer me to customer support"):
        assert WANTS_PERSON.search(text), text
    for text in ("How do I talk to my professor about an extension?", "Which person signs the CAS?",
                 "What is the best way to reach the embassy?", "I want to study human biology",
                 "I want to do a human rights course in the UK"):
        assert not WANTS_PERSON.search(text), text


def test_a_call_link_is_spotted_however_it_is_written():
    for text in ("join https://meet.google.com/abc-defg-hij", "meet.google.com/abc-defg-hij now",
                 "https://us02web.zoom.us/j/123456", "teams.microsoft.com/l/meetup-join/19%3a",
                 "https://meet.jit.si/TYM-abc", "whereby.com/tym", "discord.gg/abcdef"):
        assert MEETING_LINK.search(text), text
    for text in ("Shall we meet on Google at 6?", "My university is meet.ac.uk material",
                 "Send the SOP to me@zoom-tutors.com"):
        assert not MEETING_LINK.search(text), text


def test_only_a_real_call_link_can_be_shared_as_the_meeting():
    assert MEETING_HOST.match("https://meet.google.com/abc-defg-hij")
    assert MEETING_HOST.match("https://us02web.zoom.us/j/123456")
    for url in ("http://meet.google.com/abc", "https://evil.example.com/meet.google.com",
                "meet.google.com/abc", "https://meet.google.com"):
        assert not MEETING_HOST.match(url), url
