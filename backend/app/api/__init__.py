from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, verify_jwt_in_request
from flask_jwt_extended.exceptions import JWTExtendedException
from jwt import PyJWTError

from . import (admin, admin_content, ai, auth, blogs, bookings, chat, comments, contact, communities, faqs, feed,
               media, mentor_applications, mentor_chat, mentors, moderation,
               notifications, packages, posts, search, support, users, verify, votes)

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    return jsonify(status="ok")


BLUEPRINTS = [
    health_bp,
    auth.bp, users.bp, communities.bp, posts.bp, comments.bp, votes.bp, feed.bp, search.bp,
    notifications.bp, moderation.bp, chat.bp, mentors.bp, bookings.bp, blogs.bp, verify.bp, contact.bp, media.bp,
    ai.bp, mentor_applications.bp, admin.bp, support.bp, admin_content.bp, packages.bp, mentor_chat.bp,
    faqs.bp,
]

# Signing up (email, Google, photo ID) and asking the team for help
SIGN_UP = ("/api/auth/", "/api/verify/", "/api/contact")
# A mentor account shows no photo ID: writing and sending its application, with the profile photo
# that application needs, IS its sign-up, and it stays pending until the team approves it.
MENTOR_SIGN_UP = ("/api/mentor-application", "/api/users/me/avatar")
# What a logged-out visitor can read
PUBLIC_READS = ("/api/health", "/api/subjects", "/api/categories", "/api/posts", "/api/search", "/api/mentors",
                "/api/blogs", "/api/media/", "/api/users/", "/api/packages", "/api/faqs")


def open_to_unverified(method, path):
    """What an account can reach before its age check: finishing sign-up, and the pages a visitor
    can read. Anything not listed is closed, so a new route is safe by default."""
    if path.startswith(SIGN_UP):
        return True
    return method == "GET" and (path.startswith(PUBLIC_READS) or path == "/api/chat/rooms")


def visitors_until_verified():
    """However the account was made (email or Google), it is a visitor until the photo-ID check
    has passed, or, for a mentor, until the team approves the application. Suspended accounts are
    held to the same limits."""
    if not request.headers.get("Authorization") or open_to_unverified(request.method, request.path):
        return
    try:
        verify_jwt_in_request(optional=True)
        user = current_user
    except (JWTExtendedException, PyJWTError):
        return  # expired or damaged token: the route answers as it always has
    if not user or user.status == "active":
        return
    if user.status in ("suspended", "banned"):
        abort(403, "This account is suspended.")
    if user.role == "mentor":
        if request.path.startswith(MENTOR_SIGN_UP):
            return
        abort(403, "Your mentor account opens once our team has approved your application.")
    abort(403, "Finish your age check to take part.")


def register_blueprints(app):
    for bp in BLUEPRINTS:
        app.register_blueprint(bp, url_prefix="/api")
    app.before_request(visitors_until_verified)
