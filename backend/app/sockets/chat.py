"""Real-time public chatrooms (Module 7).

Phase 4 adds the authenticated `message` event: JWT check, mute check, censor(), persist
ChatMessage, broadcast, and an inline TYMAi reply when the body starts with '@TYMAi'.
"""
from flask_socketio import join_room, leave_room

from ..extensions import socketio


@socketio.on("join")
def on_join(data):
    join_room(f"room:{data['room']}")


@socketio.on("leave")
def on_leave(data):
    leave_room(f"room:{data['room']}")
