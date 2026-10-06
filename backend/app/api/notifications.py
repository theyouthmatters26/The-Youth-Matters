"""In-app notification centre (Module 9).

Planned routes (Phase 2+):
    GET  /notifications
    POST /notifications/read     mark all or a list of ids as read
"""
from flask import Blueprint

bp = Blueprint("notifications", __name__)
