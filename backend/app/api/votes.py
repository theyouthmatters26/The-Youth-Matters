"""Up/down votes on posts and comments (Module 4).

Planned routes (Phase 2+):
    PUT    /votes   {targetType, targetId, value: 1 | -1 | 0}  -- 0 removes the vote
"""
from flask import Blueprint

bp = Blueprint("votes", __name__)
