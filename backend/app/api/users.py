"""User profiles and the "My TYM" personal area (Module 1 + agreement sections 12-13).

Planned routes (Phase 2+):
    GET    /users/me                     profile + account settings
    PATCH  /users/me                     bio, target country, study level, settings
    POST   /users/me/avatar
    GET    /users/me/communities         joined communities
    GET    /users/me/chat-rooms
    GET    /users/me/questions
    GET    /users/me/answers
    GET    /users/me/saved
    GET    /users/me/mentors             followed mentors
    GET    /users/<username>
    POST   /users/<username>/block
"""
from flask import Blueprint

bp = Blueprint("users", __name__)