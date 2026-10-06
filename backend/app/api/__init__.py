from flask import Blueprint, jsonify

from . import (ai, auth, blogs, bookings, chat, comments, contact, communities, feed, media, mentor_applications,
               mentors, moderation,
               notifications, posts, search, users, verify, votes)

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    return jsonify(status="ok")


BLUEPRINTS = [
    health_bp,
    auth.bp, users.bp, communities.bp, posts.bp, comments.bp, votes.bp, feed.bp, search.bp,
    notifications.bp, moderation.bp, chat.bp, mentors.bp, bookings.bp, blogs.bp, verify.bp, contact.bp, media.bp,
    ai.bp, mentor_applications.bp,
]


def register_blueprints(app):
    for bp in BLUEPRINTS:
        app.register_blueprint(bp, url_prefix="/api")
