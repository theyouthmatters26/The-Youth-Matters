"""Feed ranking. Hot = Reddit's formula: log10 of net score plus a recency bonus.

A post needs 10x the score to outrank one posted 12.5 hours later (45000s per order of magnitude).
"""
from datetime import datetime
from math import log10

from sqlalchemy import extract, func

EPOCH_OFFSET = 1134028003  # Reddit's original epoch; any fixed constant works
DECAY_SECONDS = 45000


def hot_score(score: int, created_at: datetime) -> float:
    order = log10(max(abs(score), 1))
    sign = (score > 0) - (score < 0)
    seconds = created_at.timestamp() - EPOCH_OFFSET
    return round(sign * order + seconds / DECAY_SECONDS, 7)


def hot_sql(model):
    """Same formula as hot_score(), as a SQL expression for ORDER BY on PostgreSQL."""
    order = func.log(func.greatest(func.abs(model.score), 1))
    seconds = extract("epoch", model.created_at) - EPOCH_OFFSET
    return func.sign(model.score) * order + seconds / DECAY_SECONDS
