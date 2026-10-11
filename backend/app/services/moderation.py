"""Censoring and the 3-strike policy.

Everything a member writes runs through censor() by way of services/content.py, so this one list
covers the chatrooms, questions, answers, mentor chats and profiles.

Phase 4 plugs in the local Hugging Face models (Vrandan/Comment-Moderation for toxicity,
all-MiniLM-L6-v2 for off-topic) in front of censor(); the strike rules below stay the same. A word
list cannot judge whether a sentence is off-topic or abusive in context, only whether it contains a
word we will not print, so that part waits for the model.
"""
import re
from datetime import timedelta

MUTE_DURATION = timedelta(hours=24)

# Words we will not print: vulgarity, slurs and the plain insults people throw at each other.
# Anything subtler than a word (a sentence that is cruel, or off topic) is for the report button,
# the strike rules, and the model this file is waiting on.
BLOCKED_WORDS = {
    # insults
    "idiot", "stupid", "moron", "dumbass", "loser", "pathetic", "scum",
    # vulgarity
    "fuck", "fucker", "fucking", "motherfucker", "shit", "bullshit", "bitch", "bastard",
    "cunt", "dick", "prick", "cock", "pussy", "twat", "wanker", "arsehole", "asshole",
    "slut", "whore", "nigga", "nigger", "retard", "retarded", "faggot", "fag", "dyke",
    "chutiya", "bhenchod", "behenchod", "madarchod", "bhosdike", "randi", "gandu", "lund",
    # sexual
    "porn", "porno", "blowjob", "handjob", "cumshot", "dildo", "anal", "boobs", "titties",
    # self harm and violence, which the community guidelines do not allow either
    "rape", "rapist",
}

# Letters people swap in to get a word past a filter: fuck -> f*ck, f u c k, fuuuck, sh1t, @ss
LOOKALIKE = {
    "a": "a@4", "b": "b8", "c": "c(", "e": "e3", "g": "g9", "i": "i1l!|", "l": "l1i|",
    "o": "o0", "s": "s5$", "t": "t7+", "u": "uv", "z": "z2",
}
# Between letters: a star, a dot, a space, at most two of them. Longer gaps would start matching
# across words that have nothing to do with each other.
GAP = r"[\W_]{0,2}"


# Masking a letter out: f*ck, sh#t. Allowed in the middle of a word only, so a row of stars on its
# own does not match everything in the list.
MASK = "*#"


def _loose(word):
    """A pattern for one word that still catches the usual ways round it."""
    parts = []
    for i, ch in enumerate(word):
        allowed = LOOKALIKE.get(ch, ch)
        if 0 < i < len(word) - 1:
            allowed += MASK
        parts.append(f"[{re.escape(allowed)}]+")
    return GAP.join(parts)


# Anchored on letters and digits rather than \b: a word may now start with $ or @, and \b does not
# hold in front of those. "assignment", "classic", "Scunthorpe" and "analysis" are still safe,
# because what follows them is a letter and the closing anchor fails.
_pattern = re.compile(r"(?<![A-Za-z0-9])(?:"
                      + "|".join(_loose(w) for w in sorted(BLOCKED_WORDS, key=len, reverse=True))
                      + r")(?![A-Za-z0-9])", re.I)


def censor(text: str) -> tuple[str, bool]:
    """Replace blocked words with ****. Returns (clean_text, was_censored)."""
    clean, count = _pattern.subn("****", text)
    return clean, count > 0


def strike_action(level: int) -> str:
    """What happens to a user when they receive their Nth strike."""
    if level <= 1:
        return "warn_and_delete"
    if level == 2:
        return "mute_24h"
    return "suspend_pending_review"
