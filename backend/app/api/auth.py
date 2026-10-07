"""Accounts (Module 1): email + password confirmed with a 6-digit email code, Google sign-in, JWT.

Sign-up order: register -> verify-email (returns a session) -> identity check (api/verify.py),
which reads the date of birth from a photo ID and checks the member is 18 or over. Until that passes
the account status stays "pending".
"""
import hashlib
import hmac
import re
import secrets
from datetime import timedelta

import bcrypt
import requests
from flask import Blueprint, abort, current_app, jsonify, request
from flask_jwt_extended import (create_access_token, create_refresh_token, current_user, get_jwt_identity,
                                jwt_required)

from ..extensions import db, jwt, limiter
from ..models import User
from ..models.base import utcnow
from ..services import mailer
from . import serializers as s

bp = Blueprint("auth", __name__)

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CODE_TTL = timedelta(minutes=10)
BAD_CODE = "That code is wrong or has expired. Check the latest email, or ask for a new code."


@jwt.user_lookup_loader
def _load_user(_header, data):
    return db.session.get(User, int(data["sub"]))


@jwt.token_in_blocklist_loader
def _signed_out_everywhere(_header, data):
    """Tokens from before the account's password last changed are refused: resetting a password
    ends every session, a stolen one included."""
    user = db.session.get(User, int(data["sub"]))
    return bool(user and user.tokens_valid_after and data["iat"] < int(user.tokens_valid_after.timestamp()))


def _email_key():
    """Guesses at a code are counted per account, whatever addresses they come from."""
    return "code:" + str((request.get_json(silent=True) or {}).get("email") or "").strip().lower()[:255]


def _body(*fields):
    data = request.get_json(silent=True) or {}
    return [str(data.get(f) or "").strip() for f in fields]


def _by_email(email):
    return db.session.scalar(db.select(User).where(User.email == email.lower()))


def _password_hash(password):
    if len(password) < 8 or len(password.encode()) > 72:  # bcrypt only reads the first 72 bytes
        abort(400, "Use a password of 8 to 72 characters.")
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _username(name):
    base = re.sub(r"[^a-z0-9]+", ".", name.lower()).strip(".")[:24] or "member"
    candidate = base
    while db.session.scalar(db.select(User.id).where(User.username == candidate)):
        candidate = f"{base}.{secrets.randbelow(9000) + 1000}"
    return candidate


def _code_hash(code):
    return hashlib.sha256(code.encode()).hexdigest()


def _send_code(user, subject):
    code = f"{secrets.randbelow(10**6):06d}"
    user.email_code_hash = _code_hash(code)
    user.email_code_expires_at = utcnow() + CODE_TTL
    db.session.commit()
    mailer.send(user.email, subject,
                f"<p>Your code is <strong style='font-size:22px;letter-spacing:4px'>{code}</strong></p>"
                "<p>It expires in 10 minutes. If you did not ask for it, you can ignore this email.</p>")
    # Local development has no email provider, so the code goes back to the page instead
    if current_app.debug and not current_app.config["RESEND_API_KEY"]:
        current_app.logger.warning("Email code for %s: %s", user.email, code)
        return {"devCode": code}
    return {}


def _use_code(user, code):
    valid = (user and user.email_code_hash and user.email_code_expires_at
             and user.email_code_expires_at > utcnow()
             and hmac.compare_digest(user.email_code_hash, _code_hash(code)))
    if not valid:
        abort(400, BAD_CODE)
    user.email_code_hash = user.email_code_expires_at = None


def _check_allowed(user):
    if user.status in ("suspended", "banned"):
        abort(403, "This account is suspended. Write to support@theyouthmatters.org if you think this is a mistake.")


def _session(user):
    identity = str(user.id)
    return jsonify(access=create_access_token(identity), refresh=create_refresh_token(identity), user=s.me(user))


@bp.post("/auth/register")
@limiter.limit("10 per hour")
def register():
    name, email, password = _body("displayName", "email", "password")
    email = email.lower()
    if not 2 <= len(name) <= 80:
        abort(400, "Enter your full name.")
    if not EMAIL.match(email) or len(email) > 255:
        abort(400, "Enter a valid email address.")
    user = _by_email(email)
    # A team account is never taken over by a new sign-up, whatever state it was in when it was added
    if user and (user.email_verified or user.role != "student"):
        abort(409, "There is already an account with this email. Log in instead.")
    if not user:  # an unconfirmed earlier attempt is simply taken over by whoever confirms the email
        user = User(email=email, username=_username(name))
        db.session.add(user)
    user.display_name = name
    user.password_hash = _password_hash(password)
    return jsonify(email=email, **_send_code(user, "Your TYM verification code")), 201


@bp.post("/auth/resend-code")
@limiter.limit("5 per 10 minutes")
def resend_code():
    (email,) = _body("email")
    user = _by_email(email)
    extra = _send_code(user, "Your TYM verification code") if user and not user.email_verified else {}
    return jsonify(email=email.lower(), **extra)


@bp.post("/auth/verify-email")
@limiter.limit("10 per 10 minutes")
@limiter.limit("6 per 10 minutes", key_func=_email_key)
def verify_email():
    email, code = _body("email", "code")
    user = _by_email(email)
    _use_code(user, code)
    _check_allowed(user)
    user.email_verified = True
    db.session.commit()
    return _session(user)


@bp.post("/auth/login")
@limiter.limit("10 per minute")
def login():
    email, password = _body("email", "password")
    user = _by_email(email)
    if not (user and user.password_hash and bcrypt.checkpw(password.encode()[:72], user.password_hash.encode())):
        abort(401, "That email and password do not match. Try again, or reset your password.")
    _check_allowed(user)
    if not user.email_verified:
        extra = _send_code(user, "Your TYM verification code")
        return jsonify(error="email_unverified", email=user.email,
                       message="Confirm your email first. We have sent you a new code.", **extra), 403
    return _session(user)


@bp.post("/auth/google")
@limiter.limit("20 per hour")
def google():
    client_id = current_app.config["GOOGLE_CLIENT_ID"]
    if not client_id:
        abort(501, "Google sign-in is not switched on yet. Use your email for now.")
    (token,) = _body("accessToken")
    try:
        info = requests.get("https://oauth2.googleapis.com/tokeninfo", params={"access_token": token}, timeout=10)
        data = info.json() if info.ok else {}
    except (requests.RequestException, ValueError):
        abort(502, "We could not reach Google. Try again in a moment.")
    # The token must have been issued to our app, otherwise any site's Google token could sign in here
    if (data.get("aud") != client_id or str(data.get("email_verified")).lower() != "true"
            or not data.get("email") or not data.get("sub")):
        abort(401, "Google sign-in did not go through. Try again.")

    user = db.session.scalar(db.select(User).where(User.google_id == data["sub"])) or _by_email(data["email"])
    if not user:
        try:
            profile = requests.get("https://openidconnect.googleapis.com/v1/userinfo",
                                   headers={"Authorization": f"Bearer {token}"}, timeout=10).json()
        except (requests.RequestException, ValueError):
            profile = {}
        name = (profile.get("name") or data["email"].split("@")[0])[:80]
        user = User(email=data["email"].lower(), username=_username(name), display_name=name)
        db.session.add(user)
    _check_allowed(user)
    if not user.email_verified:
        # Someone typed this email into the sign-up form but never confirmed it. Google has now shown
        # who owns it, so the password that stranger chose must not open the account.
        user.password_hash = None
    user.google_id, user.email_verified = data["sub"], True
    db.session.commit()
    # A new Google account is "pending" like any other: it still has to pass the photo-ID age check
    return _session(user)


@bp.post("/auth/refresh")
@jwt_required(refresh=True)
def refresh():
    _check_allowed(current_user)
    return jsonify(access=create_access_token(get_jwt_identity()))


@bp.get("/auth/me")
@jwt_required()
def me():
    _check_allowed(current_user)
    return jsonify(s.me(current_user))


@bp.post("/auth/forgot-password")
@limiter.limit("5 per 10 minutes")
def forgot_password():
    (email,) = _body("email")
    user = _by_email(email)
    extra = _send_code(user, "Reset your TYM password") if user else {}
    return jsonify(email=email.lower(), **extra)  # same answer either way: no hint whether the account exists


@bp.post("/auth/reset-password")
@limiter.limit("10 per 10 minutes")
@limiter.limit("6 per 10 minutes", key_func=_email_key)
def reset_password():
    email, code, password = _body("email", "code", "password")
    hashed = _password_hash(password)
    user = _by_email(email)
    _use_code(user, code)
    _check_allowed(user)
    user.password_hash, user.tokens_valid_after = hashed, utcnow()
    user.email_verified = True  # they just proved they read this inbox
    db.session.commit()
    return _session(user)
