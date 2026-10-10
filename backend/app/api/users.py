"""Member profiles and the "My TYM" area (Module 1 + agreement sections 12-13).

    GET    /users/<username>              public profile with stats
    GET    /users/<username>/comments     their answers and replies, newest first
    PATCH  /users/me                      edit profile
    POST   /users/me/avatar | DELETE      profile photo (square)
    GET    /users/me/communities          communities you have joined
    DELETE /users/me                      close the account for good: {confirm: "DELETE", password?, reason?}
"""
import bcrypt
from flask import Blueprint, abort, current_app, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from markupsafe import escape

from ..extensions import db, limiter, member_key
from ..models import Comment, Community, Country, Follow, MentorProfile, Post, User
from ..models.user import STUDY_LEVELS
from ..services import accounts, content, images, mailer, staff, storage
from . import serializers as s

bp = Blueprint("users", __name__)
MEDIA = "/api/media/"
AVATAR_BYTES = 90 * 1024  # every profile photo is stored under 90 KB, to keep storage small


def _visible(username):
    u = db.session.scalar(db.select(User).where(db.func.lower(User.username) == username.lower()))
    if not u or u.status in ("banned",) or u.role == "bot":
        abort(404, "We could not find that member.")
    return u


def _stats(u):
    posts, post_karma = db.session.execute(
        db.select(db.func.count(Post.id), db.func.coalesce(db.func.sum(Post.score), 0))
        .where(Post.author_id == u.id, ~Post.is_deleted)).one()
    answers, answer_karma = db.session.execute(
        db.select(db.func.count(Comment.id), db.func.coalesce(db.func.sum(Comment.score), 0))
        .where(Comment.author_id == u.id, ~Comment.is_deleted)).one()
    helpful = db.session.scalar(db.select(db.func.count(Post.id)).join(Comment, Post.helpful_comment_id == Comment.id)
                                .where(Comment.author_id == u.id))
    return {"posts": posts, "answers": answers, "karma": int(post_karma) + int(answer_karma), "helpful": helpful}


def _profile(u):
    mentor_id = db.session.scalar(db.select(MentorProfile.id).where(MentorProfile.user_id == u.id,
                                                                   MentorProfile.is_verified))
    return s.profile(u, _stats(u), mentor_id)


@bp.get("/users/<username>")
def get_user(username):
    return jsonify(_profile(_visible(username)))


@bp.get("/users/<username>/comments")
def user_comments(username):
    u = _visible(username)
    page = max(request.args.get("page", 1, type=int), 1)
    q = (db.select(Comment).join(Post, Comment.post_id == Post.id).where(Comment.author_id == u.id, ~Comment.is_deleted, ~Post.is_deleted)
         .order_by(Comment.created_at.desc()))
    rows = db.paginate(q, page=page, per_page=20, error_out=False)
    return jsonify(items=[{**s.comment(c), "post": {"id": c.post.id, "title": c.post.title},
                           "isHelpful": c.post.helpful_comment_id == c.id} for c in rows.items],
                   page=page, hasMore=rows.has_next)


@bp.patch("/users/me")
@jwt_required()
@limiter.limit("30 per hour")
def edit_me():
    u = current_user
    data = request.get_json(silent=True) or {}
    if "displayName" in data:
        name, _ = content.clean(data["displayName"], 80)
        if len(name) < 2:
            abort(400, "Enter your name.")
        u.display_name = name
    if "bio" in data:
        u.bio, _ = content.clean(data["bio"], 300)
    for field, column, limit in (("university", "university", 120), ("course", "course", 120), ("intake", "intake", 40)):
        if field in data:
            value, _ = content.clean(data[field], limit)
            setattr(u, column, value or None)
    if "studyLevel" in data:
        if data["studyLevel"] not in (None, "", *STUDY_LEVELS):
            abort(400, "Choose a study level from the list.")
        u.study_level = data["studyLevel"] or None
    if "targetCountry" in data:
        slug = data["targetCountry"]
        u.target_country = db.session.scalar(db.select(Country).filter_by(slug=slug)) if slug else None
        if slug and not u.target_country:
            abort(400, "Choose a destination from the list.")
    db.session.commit()
    return jsonify(me=s.me(u), profile=_profile(u))


def _replace_picture(column, folder, **resize):
    u = current_user
    upload = request.files.get("image")
    if not upload:
        abort(400, "Choose a picture to upload.")
    try:
        key = storage.upload(images.prepare(upload, **resize), folder, "image/jpeg")
    except images.ImageError as e:
        abort(400, str(e))
    _remove_picture(column)
    setattr(u, column, s.media_url(key))
    db.session.commit()
    return jsonify(me=s.me(u), profile=_profile(u))


def _remove_picture(column):
    old = getattr(current_user, column)
    if old and old.startswith(MEDIA):
        storage.delete(old[len(MEDIA):])
    setattr(current_user, column, None)


@bp.post("/users/me/avatar")
@jwt_required()
@limiter.limit("20 per hour")
def upload_avatar():
    return _replace_picture("avatar_url", "avatars", max_side=480, square=True, max_bytes=AVATAR_BYTES)


@bp.delete("/users/me/avatar")
@jwt_required()
def delete_avatar():
    _remove_picture("avatar_url")
    db.session.commit()
    return jsonify(me=s.me(current_user), profile=_profile(current_user))




@bp.get("/users/me/communities")
@jwt_required()
def my_communities():
    rows = db.session.scalars(db.select(Community).join(Follow, Follow.community_id == Community.id)
                              .where(Follow.user_id == current_user.id).order_by(Community.sort_order))
    return jsonify([s.community(c) for c in rows])


@bp.delete("/users/me")
@jwt_required()
@limiter.limit("5 per hour", key_func=member_key)
def delete_me():
    """Delete your own account. The website asks you to type DELETE first, and that word has to
    come back here: a stray request cannot close somebody's account.

    Nothing of yours is left to read either way. When sessions or payments are attached those
    records have to be kept for our books, so the account is emptied and closed instead of deleted
    (services/accounts.py). Either way you cannot sign in again, and nothing personal remains."""
    u = current_user
    data = request.get_json(silent=True) or {}
    if str(data.get("confirm") or "").strip().upper() != "DELETE":
        abort(400, "Type DELETE to confirm.")
    password = str(data.get("password") or "")
    reason = str(data.get("reason") or "").strip()[:1000]
    if u.password_hash and not bcrypt.checkpw(password.encode()[:72], u.password_hash.encode()):
        abort(403, "That password is not right.")
    if staff.access_of(u):
        abort(403, "Team accounts are closed from the admin panel. Ask the owner to take you off the team first.")

    kept = accounts.has_records(u)
    files = accounts.close(u) if kept else accounts.erase(u, blog_author_id=None)
    db.session.commit()
    accounts.remove_files(files)
    # Why they left, emailed to the team without a name or an address: the account is gone, and the
    # page promises nothing of theirs is left on the site, so this is not kept in the inbox either.
    if reason:
        mailer.send_quietly(current_app.config["CONTACT_EMAIL"], "Someone deleted their account",
                            f"<p>Reason given:</p><p>{escape(reason)}</p>")
    return jsonify(deleted=True, kept=kept)
