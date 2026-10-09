import json
from datetime import datetime, timezone
from types import SimpleNamespace as N

from app.api.bookings import session_row


def person(uid, name):
    return N(id=uid, username=name.lower(), display_name=name, role="student", avatar_url=None,
             email=f"{name.lower()}@example.com")


def test_a_mentor_sees_who_booked_but_not_their_email():
    student, mentor = person(1, "Asha"), person(2, "Ravi")
    booking = N(
        id=7, status="confirmed", topic="My SOP opening", meeting_url="https://meet.jit.si/TYM-abc", note=None,
        hold_expires_at=None, review=None, student_id=student.id, student=student, minutes_deducted=30,
        slot=N(starts_at=datetime(2026, 11, 2, 9, 0, tzinfo=timezone.utc),
               ends_at=datetime(2026, 11, 2, 9, 30, tzinfo=timezone.utc)),
        mentor=N(id=3, user_id=mentor.id, user=mentor, university="Leeds", course="MSc Data Science",
                 timezone="Europe/London", session_minutes=30))

    booked = session_row(booking, student.id)
    assert "asMentor" not in booked and "student" not in booked
    assert booked["minutes"] == 30  # what came off the student's counselling hours

    given = session_row(booking, mentor.id)
    assert given["asMentor"] is True
    assert given["student"] == {"id": 1, "username": "asha", "displayName": "Asha", "role": "student", "avatar": None}
    assert given["topic"] == "My SOP opening" and given["meetingUrl"] == "https://meet.jit.si/TYM-abc"
    sent = json.dumps(given)
    assert "asha@example.com" not in sent
