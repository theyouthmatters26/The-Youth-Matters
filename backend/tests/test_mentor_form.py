"""The registration form's answers on a mentor application (api/mentor_applications.py)."""
import json

import pytest
from werkzeug.exceptions import BadRequest

from app.api.mentor_applications import REQUIRED, _details

ANSWERS = {k: "x" for k in REQUIRED} | {"mentorCountries": ["UK", "Canada"], "studyAreas": ["Law"], "formats": ["Video Call"],
                                        "availability": ["Weekends"]}


def test_answers_are_kept_clean_and_small():
    sent = ANSWERS | {"website": "  https://example.com  ", "gender": "", "bad key!": "dropped",
                      "mentorCountries": ["UK"] * 30, "approach": "y" * 5000}
    kept = _details(json.dumps(sent))
    assert kept["website"] == "https://example.com" and "gender" not in kept and "bad key!" not in kept
    assert len(kept["mentorCountries"]) == 20 and len(kept["approach"]) == 2000


def test_required_answers_and_unreadable_input_are_refused():
    for raw in (json.dumps({k: v for k, v in ANSWERS.items() if k != "jobTitle"}), json.dumps(ANSWERS | {"formats": []}),
                "not json", json.dumps(["a", "list"]), None):
        with pytest.raises(BadRequest):
            _details(raw)
