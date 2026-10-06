"""Chatrooms and AI Counsellor Lounge (Module 7). Live messages go over SocketIO (app/sockets).

Planned routes (Phase 2+):
    GET  /chat/rooms
    GET  /chat/rooms/<slug>/messages
    GET  /ai/conversations
    POST /ai/conversations/<id>/messages
"""
from flask import Blueprint

bp = Blueprint("chat", __name__)
