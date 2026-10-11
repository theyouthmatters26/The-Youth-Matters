"""The word filter: what it must catch, and what it must leave alone.

The second half matters more than the first. A filter that mangles "assignment" or "Scunthorpe"
gets switched off, and then nothing is filtered at all.
"""
import pytest

from app.services.moderation import censor

CAUGHT = [
    "fuck", "Fuck off", "what the FUCK", "fucking hell", "bullshit", "you bitch",
    "f*ck", "f**k", "f u c k", "fuuuck", "sh1t", "$hit", "@sshole", "b1tch",
    "porn", "nigga", "retard", "chutiya", "madarchod", "rapist",
]

# Words with a blocked word inside them, names, and ordinary student vocabulary
LEFT_ALONE = [
    "assignment", "assignments", "classic", "class", "passed", "assess", "assassin",
    "Scunthorpe", "analysis", "analyse", "Dickens", "Dickinson", "cockpit", "Hancock",
    "shitake",  # near miss, and nobody writes it in a chat room anyway
    "hello", "shell", "cumulative", "document", "circumstances", "accumulate",
    "Essex", "Sussex", "therapist", "grape", "grapes", "titan", "Titanic",
    "I need help with my UK visa application and my SOP",
    "My CAS arrived, the university said my assessment passed",
]


@pytest.mark.parametrize("text", CAUGHT)
def test_the_filter_catches_it(text):
    clean, hit = censor(text)
    assert hit and "****" in clean, f"{text!r} went through as {clean!r}"


@pytest.mark.parametrize("text", LEFT_ALONE)
def test_the_filter_leaves_ordinary_words_alone(text):
    clean, hit = censor(text)
    assert not hit and clean == text, f"{text!r} was censored to {clean!r}"


def test_the_rest_of_the_sentence_survives():
    clean, hit = censor("this visa process is fucking slow but the SOP is done")
    assert hit
    assert clean == "this visa process is **** slow but the SOP is done"


def test_nothing_to_censor_changes_nothing():
    text = "Does anyone know the Leeds deposit deadline?"
    assert censor(text) == (text, False)
