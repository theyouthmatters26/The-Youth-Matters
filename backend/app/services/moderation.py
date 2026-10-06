"""Censoring and the 3-strike policy.

Phase 4 plugs in the local Hugging Face models (Vrandan/Comment-Moderation for toxicity,
all-MiniLM-L6-v2 for off-topic) in front of censor(); the strike rules below stay the same.
"""
import re
from datetime import timedelta

MUTE_DURATION = timedelta(hours=24)

# ponytail: static word list, replaced by model-driven spans in Phase 4
BLOCKED_WORDS = {"idiot", "stupid", "moron"}

_pattern = re.compile(r"\b(" + "|".join(map(re.escape, sorted(BLOCKED_WORDS))) + r")\b", re.I)


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
