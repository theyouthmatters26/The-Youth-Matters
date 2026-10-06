from app.api.votes import vote_delta
from app.services.content import clean, mentions


def test_vote_delta_covers_every_change():
    assert vote_delta(0, 1) == (1, 0)      # new upvote
    assert vote_delta(0, -1) == (0, 1)     # new downvote
    assert vote_delta(1, 0) == (-1, 0)     # upvote removed
    assert vote_delta(-1, 0) == (0, -1)    # downvote removed
    assert vote_delta(1, -1) == (-1, 1)    # switched to down: score moves by 2
    assert vote_delta(-1, 1) == (1, -1)


def test_clean_strips_html_keeps_paragraphs_and_censors():
    text, censored = clean("<b>Hi</b> <script>alert(1)</script>there\r\n\r\n\r\n\r\nYou idiot", 1000)
    assert text == "Hi alert(1)there\n\nYou ****"
    assert censored
    assert clean("Visa & funds < 31 days", 1000) == ("Visa & funds < 31 days", False)
    assert clean("x" * 50, 10)[0] == "x" * 10


def test_mentions_are_unique_lowercase_and_ignore_emails():
    assert mentions("Thanks @Priya.S and @priya.s, cc @rohan_m but not me@example.com") == ["priya.s", "rohan_m"]
