"""Text that members write: posts, answers, replies, bios.

Stored as plain text. Any HTML is stripped (the website renders text, never HTML), blank lines are
kept as paragraph breaks, and blocked words are censored.
"""
import re

import bleach

from .moderation import censor

MENTION = re.compile(r"(?<![\w@])@([a-z0-9._]{3,32})", re.I)


def clean(text, max_len):
    """(clean_text, was_censored). Strips tags, trims, collapses 3+ blank lines, caps length."""
    # Cut first: cleaning megabytes of junk would hold up everyone else's requests
    text = bleach.clean(str(text or "")[:max_len * 4], tags=[], strip=True)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = re.sub(r"\n{3,}", "\n\n", text.replace("\r\n", "\n")).strip()[:max_len]
    return censor(text)


def mentions(text):
    """Lower-cased usernames mentioned as @username, without duplicates."""
    return sorted({m.lower() for m in MENTION.findall(text or "")})
