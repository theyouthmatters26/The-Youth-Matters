"""Reports and blocks (Module 8). Admin review endpoints arrive with the admin panel (Phase 3).

Planned routes (Phase 2+):
    POST /reports   {targetType, targetId, reason}
"""
from flask import Blueprint

bp = Blueprint("moderation", __name__)
