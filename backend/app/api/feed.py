"""Personalised home feed (Module 6).

Planned routes (Phase 2+):
    GET /feed   followed hubs + trending global + recent unanswered questions
"""
from flask import Blueprint

bp = Blueprint("feed", __name__)
