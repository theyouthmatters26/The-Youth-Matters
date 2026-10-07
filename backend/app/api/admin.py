"""The admin panel's API (Module 10). Team only: the owner from .env and the admins the owner added,
each limited to the areas chosen for them (services/staff.py). The support inbox is in support.py.

    POST   /admin/login                       email + password
    GET    /admin/me                          who you are and what you can open
    PATCH  /admin/me                          {name}
    POST   /admin/me/password                 {current, new}: change your own password
    GET    /admin/badges                      counts for the menu
    GET    /admin/overview

    GET    /admin/team                        POST adds someone, PATCH and DELETE /admin/team/<id>
    GET    /admin/members?q=&filter=&page=    POST adds an account {name, email, password, dateOfBirth?}
    GET    /admin/members/<id>                PATCH {name, email, password}, DELETE removes the account for good
    POST   /admin/members/<id>/status         {status: active | suspended | banned, reason}
    POST   /admin/members/<id>/verify         {dateOfBirth}: verify by hand after checking their ID
    POST   /admin/members/<id>/strike         {reason}
    GET    /admin/reports?status=&page=       POST /admin/reports/<id>/resolve {action}
    DELETE /admin/content/<kind>/<id>         remove a post, answer or chat message
    GET    /admin/mentors                     POST /admin/mentors/<id>/listed {listed}
    GET    /admin/mentors/<id>                PATCH {headline, university, course, about, price}, DELETE
    DELETE /admin/reviews/<id>                take a mentor review down
    GET    /admin/bookings?status=&page=      POST /admin/bookings/<id>/cancel {refund, reason}
    GET    /admin/payments?status=&page=      GET /admin/earnings (what each mentor's sessions brought in)

Blog, community, the contact inbox, setup and exports are in admin_content.py.
"""
import secrets
from datetime import date, timedelta

import bcrypt
from flask import Blueprint, abort, current_app, jsonify, request
from flask_jwt_extended import create_access_token, create_refresh_token, current_user, jwt_required
from markupsafe import escape

from ..extensions import db, limiter
from ..models import (AiConversation, AvailabilitySlot, BlogPost, Booking, ChatMessage, ChatRoom, Comment,
                      ContactMessage, IdentityVerification, MentorApplication, MentorProfile, MentorReview,
                      ModerationLog, Payment, Post, Report, Strike, User, Vote)
from ..models.base import utcnow
from ..services import handoff, mailer, payments, staff, storage
from ..services.moderation import MUTE_DURATION, strike_action
from ..services.notify import notify
from . import serializers as s
from .auth import EMAIL, _body, _by_email, _password_hash, _username

bp = Blueprint("admin", __name__)

PAGE = 25
PEOPLE = User.role.in_(("student", "mentor"))
# Checked when the email is unknown, so a wrong email takes as long to refuse as a wrong password
_DECOY = bcrypt.hashpw(secrets.token_bytes(16), bcrypt.gensalt(rounds=12))


# ---------------------------------------------------------------- helpers

def team_member(area=None):
    """The signed-in admin, allowed into `area`. Call inside @jwt_required."""
    me = current_user
    if not staff.access_of(me):
        abort(403, "This area is for the TYM team.")
    if area and not staff.can(me, area):
        abort(403, "You do not have access to this part of the panel.")
    return me


def admin_json(u):
    return {"id": u.id, "name": u.display_name, "email": u.email, "avatar": u.avatar_url,
            "access": staff.access_of(u), "isOwner": staff.is_owner(u)}


def record(action, target_type, target_id, **detail):
    """One line in the audit trail: who did what to whom."""
    db.session.add(ModerationLog(actor_id=current_user.id, action=action, target_type=target_type,
                                 target_id=target_id, detail=detail or None))


def paged(query, serialise):
    page = max(request.args.get("page", 1, type=int), 1)
    rows = db.session.scalars(query.limit(PAGE + 1).offset((page - 1) * PAGE)).all()
    return {"items": [serialise(r) for r in rows[:PAGE]], "page": page, "hasMore": len(rows) > PAGE}


def count(*where):
    return db.session.scalar(db.select(db.func.count()).where(*where)) or 0


def waiting_for_a_person():
    """Students who asked for a person, or wrote last in a conversation a person is handling."""
    return db.or_(AiConversation.status == "waiting",
                  db.and_(AiConversation.status == "human", AiConversation.last_role == "user"))


def _matches(password, hashed):
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed if isinstance(hashed, bytes) else hashed.encode())
    except ValueError:  # the stored value is not a bcrypt hash
        return False


def _member(user_id):
    u = db.session.get(User, user_id)
    if not u or u.role == "bot":
        abort(404, "We could not find that member.")
    return u


def _can_act_on(target):
    """Nobody acts on the owner or on themselves, and only team managers act on other admins."""
    me = current_user
    if staff.is_owner(target):
        abort(400, "The owner's account cannot be changed from the panel.")
    if target.id == me.id:
        abort(400, "You cannot do this to your own account.")
    if target.role == "admin" and not staff.can(me, "team"):
        abort(403, "Only someone who manages the team can change another admin.")


# ---------------------------------------------------------------- signing in

def _owner_account():
    """The owner's row, made the first time they sign in with the first password from .env."""
    email = current_app.config["ADMIN_EMAIL"]
    u = _by_email(email)
    if not u:
        name = email.split("@")[0].replace(".", " ").replace("_", " ").title()
        u = User(email=email, username=_username(name), display_name=name)
        db.session.add(u)
    elif u.role != "admin":
        # A member account that used this email: whatever password it had must not open the panel
        u.password_hash = None
    u.role, u.status, u.email_verified = "admin", "active", True
    return u


def _stored_hash(email):
    """What an admin's password is checked against, or None when this email cannot sign in here.
    The owner starts on ADMIN_PASSWORD_HASH from .env. Once they choose a password in the panel, or
    reset it by email, their own replaces it and the one in .env stops working."""
    cfg, u = current_app.config, _by_email(email)
    own = u.password_hash if u and u.role == "admin" else None
    first = cfg["ADMIN_PASSWORD_HASH"] if cfg["ADMIN_EMAIL"] and email == cfg["ADMIN_EMAIL"] else None
    return own or first or None


@bp.post("/admin/login")
@limiter.limit("5 per minute; 30 per hour")
def login():
    email, password = _body("email", "password")
    email, refused = email.lower(), "That email and password do not match an admin account."
    hashed = _stored_hash(email)
    if not (_matches(password, hashed or _DECOY) and hashed):
        abort(401, refused)
    user = _owner_account() if email == current_app.config["ADMIN_EMAIL"] else _by_email(email)
    if not staff.access_of(user):
        abort(401, refused)
    user.last_seen_at = utcnow()
    db.session.commit()
    identity = str(user.id)
    return jsonify(access=create_access_token(identity), refresh=create_refresh_token(identity),
                   admin=admin_json(user))


@bp.get("/admin/me")
@jwt_required()
def me():
    return jsonify(admin_json(team_member()))


@bp.post("/admin/me/password")
@jwt_required()
@limiter.limit("10 per hour")
def change_password():
    user = team_member()
    current, new = _body("current", "new")
    if not _matches(current, _stored_hash(user.email.lower()) or _DECOY):
        abort(400, "Your current password is not right.")
    if new == current:
        abort(400, "That is the password you already have. Choose a different one.")
    user.password_hash, user.tokens_valid_after = _password_hash(new), utcnow()
    db.session.commit()
    mailer.send_quietly(user.email, "Your TYM admin password was changed",
                        "<p>The password for your TYM admin account was just changed.</p>"
                        "<p>If that was you, there is nothing to do. If it was not, reset it now from the admin "
                        f"sign-in page: <a href='{handoff.site_url()}/admin/login'>{handoff.site_url()}/admin/login</a></p>")
    # Every other sign-in on this account has just ended; this one carries on with fresh tokens
    identity = str(user.id)
    return jsonify(access=create_access_token(identity), refresh=create_refresh_token(identity))


@bp.patch("/admin/me")
@jwt_required()
def update_me():
    user = team_member()
    (name,) = _body("name")
    if not 2 <= len(name) <= 80:
        abort(400, "Enter your name.")
    user.display_name = name
    db.session.commit()
    return jsonify(admin_json(user))


@bp.get("/admin/badges")
@jwt_required()
def badges():
    me = team_member()
    out = {}
    if staff.can(me, "support"):
        out["support"] = count(waiting_for_a_person())
        out["contact"] = count(ContactMessage.status == "new")
    if staff.can(me, "moderation"):
        out["moderation"] = count(Report.status == "open")
    if staff.can(me, "mentors"):
        out["mentors"] = count(MentorApplication.status == "pending")
    return jsonify(out)


# ---------------------------------------------------------------- overview

@bp.get("/admin/overview")
@jwt_required()
def overview():
    team_member("overview")
    now = utcnow()
    week, month = now - timedelta(days=7), now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    first_day = (now - timedelta(days=13)).date()
    per_day = dict(db.session.execute(
        db.select(db.func.date(User.created_at), db.func.count(User.id))
        .where(PEOPLE, User.created_at >= first_day).group_by(db.func.date(User.created_at))).all())
    earned = db.session.scalar(db.select(db.func.coalesce(db.func.sum(Payment.amount_minor), 0))
                               .where(Payment.status == "paid", Payment.created_at >= month))
    upcoming = db.session.scalar(db.select(db.func.count(Booking.id)).join(AvailabilitySlot, Booking.slot_id == AvailabilitySlot.id)
                                 .where(Booking.status == "confirmed", AvailabilitySlot.starts_at > now))
    newest = db.session.scalars(db.select(User).where(PEOPLE).order_by(User.id.desc()).limit(6))
    actors = db.aliased(User)
    activity = db.session.execute(db.select(ModerationLog, actors.display_name)
                                  .outerjoin(actors, ModerationLog.actor_id == actors.id)
                                  .order_by(ModerationLog.id.desc()).limit(8)).all()
    return jsonify(
        members={"total": count(PEOPLE), "verified": count(PEOPLE, User.status == "active"),
                 "pending": count(PEOPLE, User.status == "pending"), "newThisWeek": count(PEOPLE, User.created_at >= week)},
        community={"questions": count(~Post.is_deleted), "questionsThisWeek": count(~Post.is_deleted, Post.created_at >= week),
                   "unanswered": count(~Post.is_deleted, Post.comment_count == 0),
                   "answers": count(~Comment.is_deleted),
                   "chatToday": count(~ChatMessage.is_deleted, ChatMessage.created_at >= now - timedelta(hours=24)),
                   "aiConversations": count(AiConversation.id.isnot(None))},
        money={"earnedThisMonthMinor": int(earned), "currency": "INR", "upcomingSessions": upcoming,
               "mentors": count(MentorProfile.is_verified)},
        queues={"support": count(waiting_for_a_person()), "contact": count(ContactMessage.status == "new"),
                "moderation": count(Report.status == "open"), "mentors": count(MentorApplication.status == "pending")},
        signups=[{"date": d.isoformat(), "count": per_day.get(d, 0)}
                 for d in (first_day + timedelta(days=i) for i in range(14))],
        newest=[{**s.user_brief(u), "status": u.status, "joinedAt": u.created_at.isoformat()} for u in newest],
        activity=[{"id": log.id, "action": log.action, "by": name or "TYM", "detail": log.detail or {}, "target": log.target_type,
                   "at": log.created_at.isoformat()} for log, name in activity],
    )


# ---------------------------------------------------------------- team

def _team_json(u):
    return {**admin_json(u), "username": u.username, "fullAccess": len(staff.access_of(u)) == len(staff.AREAS),
            "lastSeenAt": u.last_seen_at.isoformat() if u.last_seen_at else None, "createdAt": u.created_at.isoformat()}


def _access_from(data):
    access = staff.clean_access(data.get("access"))
    if not access:
        abort(400, "Choose at least one part of the panel this person can open.")
    return access


@bp.get("/admin/team")
@jwt_required()
def team():
    team_member("team")
    admins = db.session.scalars(db.select(User).where(User.role == "admin").order_by(User.display_name)).all()
    admins.sort(key=lambda u: not staff.is_owner(u))  # the owner first
    return jsonify(people=[_team_json(u) for u in admins],
                   areas=[{"key": k, "label": label, "about": about} for k, (label, about) in staff.AREAS.items()])


@bp.post("/admin/team")
@jwt_required()
def add_admin():
    team_member("team")
    data = request.get_json(silent=True) or {}
    name, email, password = (str(data.get(k) or "").strip() for k in ("name", "email", "password"))
    email, access = email.lower(), _access_from(data)
    if not EMAIL.match(email):
        abort(400, "Enter their email address.")
    if email == current_app.config["ADMIN_EMAIL"]:
        abort(400, "That is the owner's email. The owner already has everything.")
    u = _by_email(email)
    if u and (u.role == "bot" or u.status in ("suspended", "banned")):
        abort(400, "That account cannot be added to the team. Reinstate it first if it is suspended.")
    if u and staff.access_of(u):
        abort(409, f"{u.display_name} is already on the team.")
    if not u:
        if not 2 <= len(name) <= 80:
            abort(400, "Enter their name.")
        u = User(email=email, username=_username(name), display_name=name, email_verified=True)
        db.session.add(u)
    if password or not u.password_hash:
        u.password_hash = _password_hash(password)  # refuses anything under 8 characters
    u.role, u.status, u.admin_access = "admin", "active", access
    # The owner vouches for the address. Left unconfirmed, the sign-up form would let anyone who
    # knows the email set a new password on this account.
    u.email_verified = True
    db.session.flush()
    record("team_added", "user", u.id, name=u.display_name, access=access)
    db.session.commit()
    link = f"{current_app.config['SITE_URL'] or request.host_url.rstrip('/')}/admin/login"
    mailer.send_quietly(u.email, "You have been added to The Youth Matters admin panel",
                        f"<p>Hi {escape(u.display_name.split()[0])},</p><p>{escape(current_user.display_name)} added you to the admin "
                        f"panel. Sign in with this email and the password they give you:</p><p><a href='{link}'>{link}</a></p>")
    return jsonify(_team_json(u)), 201


@bp.patch("/admin/team/<int:user_id>")
@jwt_required()
def update_admin(user_id):
    team_member("team")
    u = _member(user_id)
    if u.role != "admin":
        abort(404, "That person is not on the team.")
    _can_act_on(u)
    data = request.get_json(silent=True) or {}
    if "access" in data:
        u.admin_access = _access_from(data)
    if data.get("name"):
        name = str(data["name"]).strip()
        if not 2 <= len(name) <= 80:
            abort(400, "Enter their name.")
        u.display_name = name
    if data.get("password"):
        u.password_hash = _password_hash(str(data["password"]))
    record("team_updated", "user", u.id, name=u.display_name, access=u.admin_access)
    db.session.commit()
    return jsonify(_team_json(u))


@bp.delete("/admin/team/<int:user_id>")
@jwt_required()
def remove_admin(user_id):
    team_member("team")
    u = _member(user_id)
    if u.role != "admin":
        abort(404, "That person is not on the team.")
    _can_act_on(u)
    u.role, u.admin_access = "student", None
    if not u.date_of_birth:  # an account made only for the panel never passed the age check
        u.status = "pending"
    record("team_removed", "user", u.id, name=u.display_name)
    db.session.commit()
    return jsonify(removed=True)


# ---------------------------------------------------------------- members

def _member_row(u):
    return {**s.user_brief(u), "email": u.email, "status": u.status, "joinedAt": u.created_at.isoformat(),
            "lastSeenAt": u.last_seen_at.isoformat() if u.last_seen_at else None,
            "country": u.target_country.name if u.target_country else None}


@bp.get("/admin/members")
@jwt_required()
def members():
    team_member("members")
    q = db.select(User).where(User.role != "bot")
    chosen = request.args.get("filter", "all")
    q = {"verified": q.where(PEOPLE, User.status == "active"), "pending": q.where(User.status == "pending"),
         "suspended": q.where(User.status.in_(("suspended", "banned"))), "mentors": q.where(User.role == "mentor"),
         "team": q.where(User.role == "admin")}.get(chosen, q)
    term = request.args.get("q", "").strip()
    if term:
        like = f"%{term}%"
        q = q.where(User.display_name.ilike(like) | User.username.ilike(like) | User.email.ilike(like))
    return jsonify(paged(q.order_by(User.id.desc()), _member_row))


def _verify(u, date_of_birth, me):
    """Mark an account as age-checked by someone on the team who saw the ID themselves."""
    try:
        dob = date.fromisoformat(str(date_of_birth))
    except ValueError:
        abort(400, "Enter the date of birth from their ID.")
    minimum = current_app.config["MIN_AGE"]
    if not minimum <= User.age_on(dob) <= 120:
        abort(400, f"That date of birth is not {minimum} or over. The account cannot be verified.")
    v = u.verification or IdentityVerification(user=u)
    v.status, v.decided_at, v.reviewed_by_id = "verified", utcnow(), me.id
    v.note = f"Checked by hand by {me.display_name}"
    u.date_of_birth, u.status = dob, "active"
    db.session.add(v)


@bp.post("/admin/members")
@jwt_required()
def add_member():
    """Make an account for someone: a mentor you invited, or a student who could not sign up themselves."""
    me = team_member("members")
    data = request.get_json(silent=True) or {}
    name, email, password = (str(data.get(k) or "").strip() for k in ("name", "email", "password"))
    email = email.lower()
    if not 2 <= len(name) <= 80:
        abort(400, "Enter their full name.")
    if not EMAIL.match(email):
        abort(400, "Enter a valid email address.")
    if email == current_app.config["ADMIN_EMAIL"] or _by_email(email):
        abort(409, "There is already an account with this email.")
    u = User(email=email, username=_username(name), display_name=name, password_hash=_password_hash(password),
             email_verified=True)  # the team vouches for the address
    db.session.add(u)
    if data.get("dateOfBirth"):
        _verify(u, data["dateOfBirth"], me)
    db.session.flush()
    record("member_added", "user", u.id, name=name)
    db.session.commit()
    link = f"{handoff.site_url()}/login"
    mailer.send_quietly(u.email, "Your account on The Youth Matters",
                        f"<p>Hi {escape(name.split()[0])},</p><p>{escape(me.display_name)} from the TYM team made an account "
                        f"for you. Log in with this email and the password they give you:</p><p><a href='{link}'>{link}</a></p>")
    return jsonify(id=u.id, status=u.status), 201


@bp.patch("/admin/members/<int:user_id>")
@jwt_required()
def edit_member(user_id):
    team_member("members")
    u = _member(user_id)
    _can_act_on(u)
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = str(data["name"] or "").strip()
        if not 2 <= len(name) <= 80:
            abort(400, "Enter their full name.")
        u.display_name = name
    email = str(data.get("email") or u.email).strip().lower()
    if email != u.email:
        if not EMAIL.match(email):
            abort(400, "Enter a valid email address.")
        if email == current_app.config["ADMIN_EMAIL"] or _by_email(email):
            abort(409, "Another account already uses that email.")
        u.email, u.email_verified = email, True
    if data.get("password"):
        u.password_hash, u.tokens_valid_after = _password_hash(str(data["password"])), utcnow()
        record("password_set", "user", u.id, name=u.display_name)
    db.session.commit()
    return jsonify(_member_row(u))


@bp.delete("/admin/members/<int:user_id>")
@jwt_required()
def delete_member(user_id):
    """Erase an account and everything it posted. Accounts with money attached are kept: ban those."""
    me = team_member("members")
    u = _member(user_id)
    _can_act_on(u)
    if u.role == "admin":
        abort(400, "Take them off the team first, on the Team page.")
    profile = db.session.scalar(db.select(MentorProfile.id).where(MentorProfile.user_id == u.id))
    if count(Booking.student_id == u.id) or count(Payment.user_id == u.id) or (profile and count(Booking.mentor_id == profile)):
        abort(409, "This account has sessions or payments, and those records have to be kept. "
                   "Ban the account instead: that closes it for good.")

    # Their votes come off the tallies, and questions they answered are recounted once the answers are gone
    for model, kind in ((Post, "post"), (Comment, "comment")):
        for value, tally in ((1, model.upvotes), (-1, model.downvotes)):
            voted = db.select(Vote.target_id).where(Vote.user_id == u.id, Vote.target_type == kind, Vote.value == value)
            db.session.execute(db.update(model).where(model.id.in_(voted))
                               .values({tally: tally - 1, model.score: model.score - value}))
    answered = db.session.scalars(db.select(Comment.post_id).where(Comment.author_id == u.id).distinct()).all()
    files = db.session.execute(db.select(MentorApplication.cv_key, MentorApplication.proof_key)
                               .where(MentorApplication.user_id == u.id)).all()
    # Only someone who was once on the team has these: their decisions stay, without a name on them
    for model, column in ((MentorApplication, MentorApplication.reviewed_by_id), (Report, Report.resolved_by_id),
                          (IdentityVerification, IdentityVerification.reviewed_by_id)):
        db.session.execute(db.update(model).where(column == u.id).values({column: None}))
    db.session.execute(db.update(BlogPost).where(BlogPost.author_id == u.id).values(author_id=me.id))
    db.session.execute(db.delete(MentorReview).where(MentorReview.author_id == u.id))

    record("member_deleted", "user", u.id, name=u.display_name)
    db.session.execute(db.delete(User).where(User.id == u.id))  # the database removes what hangs off the account
    live = db.select(db.func.count(Comment.id)).where(Comment.post_id == Post.id, ~Comment.is_deleted).scalar_subquery()
    db.session.execute(db.update(Post).where(Post.id.in_(answered)).values(comment_count=live))
    db.session.commit()
    for keys in files:
        for key in keys:
            storage.delete(key)
    return jsonify(deleted=True)


@bp.get("/admin/members/<int:user_id>")
@jwt_required()
def member_detail(user_id):
    me = team_member("members")
    u = _member(user_id)
    v = u.verification
    strikes = db.session.scalars(db.select(Strike).where(Strike.user_id == u.id).order_by(Strike.id.desc())).all()
    posts = db.session.scalars(db.select(Post).where(Post.author_id == u.id).order_by(Post.id.desc()).limit(5))
    protected = staff.is_owner(u) or u.id == me.id or (u.role == "admin" and not staff.can(me, "team"))
    return jsonify({
        **_member_row(u), "bio": u.bio, "university": u.university, "course": u.course, "intake": u.intake,
        "studyLevel": u.study_level, "emailVerified": u.email_verified, "google": bool(u.google_id),
        "age": User.age_on(u.date_of_birth) if u.date_of_birth else None,
        "mutedUntil": u.muted_until.isoformat() if u.muted_until and u.muted_until > utcnow() else None,
        "verification": v and {"status": v.status, "documentType": v.document_type, "dobSource": v.dob_source,
                               "note": v.note, "decidedAt": v.decided_at.isoformat() if v.decided_at else None},
        "counts": {"questions": count(Post.author_id == u.id, ~Post.is_deleted),
                   "answers": count(Comment.author_id == u.id, ~Comment.is_deleted),
                   "openReports": count(Report.target_type == "user", Report.target_id == u.id, Report.status == "open"),
                   "sessions": count(Booking.student_id == u.id, Booking.status.in_(("confirmed", "completed")))},
        "strikes": [{"level": k.level, "reason": k.reason, "source": k.source, "at": k.created_at.isoformat()} for k in strikes],
        "recentPosts": [{"id": p.id, "title": p.title, "removed": p.is_deleted, "at": p.created_at.isoformat()} for p in posts],
        "canAct": not protected,
    })


@bp.post("/admin/members/<int:user_id>/status")
@jwt_required()
def set_status(user_id):
    team_member("members")
    u = _member(user_id)
    _can_act_on(u)
    data = request.get_json(silent=True) or {}
    status, reason = data.get("status"), str(data.get("reason") or "").strip()[:255]
    if status == "active":
        u.status = "active" if u.date_of_birth or u.role == "admin" else "pending"
        u.muted_until = None
        record("reinstated", "user", u.id, name=u.display_name)
    elif status in ("suspended", "banned"):
        if len(reason) < 5:
            abort(400, "Write a short reason. The member is told why.")
        u.status = status
        record(status, "user", u.id, name=u.display_name, reason=reason)
        mailer.send_quietly(u.email, "Your account on The Youth Matters",
                            f"<p>Hi {escape(u.display_name.split()[0])},</p><p>Your account has been {status}.</p>"
                            f"<p>Reason: {escape(reason)}</p><p>If you think this is a mistake, reply to this email.</p>",
                            reply_to=current_app.config["CONTACT_EMAIL"])
    else:
        abort(400, "Choose active, suspended or banned.")
    db.session.commit()
    return jsonify(status=u.status)


@bp.post("/admin/members/<int:user_id>/verify")
@jwt_required()
def verify_by_hand(user_id):
    """For a member whose photo could not be read: someone on the team checked their ID another way."""
    me = team_member("members")
    u = _member(user_id)
    if u.status != "pending":
        abort(409, "This account is not waiting for an age check.")
    if not u.email_verified:
        abort(400, "This member has not confirmed their email yet.")
    _verify(u, (request.get_json(silent=True) or {}).get("dateOfBirth"), me)
    record("verified", "user", u.id, name=u.display_name)
    db.session.commit()
    return jsonify(status=u.status)


def _strike(u, reason, content=None):
    """Strike 1 warns, strike 2 mutes for a day, strike 3 suspends. Returns what happened."""
    level = count(Strike.user_id == u.id) + 1
    kind, content_id = content or (None, None)
    db.session.add(Strike(user_id=u.id, level=level, reason=reason[:255], source="admin",
                          content_type=kind, content_id=content_id))
    outcome = strike_action(level)
    if outcome == "mute_24h":
        u.muted_until = utcnow() + MUTE_DURATION
        told = "muted you for 24 hours"
    elif outcome == "suspend_pending_review":
        u.status = "suspended"
        told = "suspended your account"
    else:
        told = "sent you a warning"
    notify(u.id, current_user, "moderation", message=f"{told}: {reason[:160]}")
    record("strike", "user", u.id, name=u.display_name, level=level, reason=reason[:160])
    return outcome


@bp.post("/admin/members/<int:user_id>/strike")
@jwt_required()
def strike(user_id):
    team_member("members")
    u = _member(user_id)
    _can_act_on(u)
    reason = str((request.get_json(silent=True) or {}).get("reason") or "").strip()
    if len(reason) < 5:
        abort(400, "Write a short reason. The member sees it.")
    outcome = _strike(u, reason)
    db.session.commit()
    return jsonify(outcome=outcome, status=u.status)


# ---------------------------------------------------------------- moderation

def _remove(kind, target_id):
    """Take a post, answer or chat message off the site. Returns its author, or None if it is gone."""
    if kind == "post":
        p = db.session.get(Post, target_id)
        if not p:
            return None
        p.is_deleted = True
        return p.author
    if kind == "comment":
        c = db.session.get(Comment, target_id)
        if not c:
            return None
        # One statement claims the removal, so two at once take one off the count, not two
        if db.session.execute(db.update(Comment).where(Comment.id == c.id, ~Comment.is_deleted).values(is_deleted=True)).rowcount:
            db.session.execute(db.update(Post).where(Post.id == c.post_id)
                               .values(comment_count=db.func.greatest(Post.comment_count - 1, 0)))
            if c.post.helpful_comment_id == c.id:
                c.post.helpful_comment_id = None
        return c.author
    if kind == "chat_message":
        m = db.session.get(ChatMessage, target_id)
        if not m:
            return None
        m.is_deleted = True
        return m.author
    abort(400, "That cannot be removed.")


def _reported(r):
    """What a report points at, in a shape the queue can show whatever kind it is."""
    kind, gone = r.target_type, {"type": r.target_type, "id": r.target_id, "missing": True}
    if kind == "post":
        p = db.session.get(Post, r.target_id)
        return gone if not p else {"type": kind, "id": p.id, "title": p.title, "excerpt": p.body[:280],
                                   "author": s.user_brief(p.author), "url": f"/p/{p.id}", "removed": p.is_deleted}
    if kind == "comment":
        c = db.session.get(Comment, r.target_id)
        return gone if not c else {"type": kind, "id": c.id, "title": f"Answer on: {c.post.title}", "excerpt": c.body[:280],
                                   "author": s.user_brief(c.author), "url": f"/p/{c.post_id}#c{c.id}", "removed": c.is_deleted}
    if kind == "chat_message":
        m = db.session.get(ChatMessage, r.target_id)
        room = m and db.session.get(ChatRoom, m.room_id)
        return gone if not m else {"type": kind, "id": m.id, "title": f"Message in {room.name}", "excerpt": m.body[:280],
                                   "author": s.user_brief(m.author), "url": f"/chat/{room.slug}", "removed": m.is_deleted}
    u = db.session.get(User, r.target_id)
    return gone if not u else {"type": kind, "id": u.id, "title": f"Profile of {u.display_name}", "excerpt": u.bio or "",
                               "author": s.user_brief(u), "url": f"/u/{u.username}",
                               "removed": u.status in ("suspended", "banned")}


@bp.get("/admin/reports")
@jwt_required()
def reports():
    team_member("moderation")
    status = request.args.get("status", "open")
    reporters = {}

    def row(r):
        who = reporters.setdefault(r.reporter_id, db.session.get(User, r.reporter_id))
        return {"id": r.id, "reason": r.reason, "status": r.status, "at": r.created_at.isoformat(),
                "reporter": s.user_brief(who) if who else None, "target": _reported(r)}

    return jsonify(paged(db.select(Report).where(Report.status == status).order_by(Report.id.desc()), row))


@bp.post("/admin/reports/<int:report_id>/resolve")
@jwt_required()
def resolve(report_id):
    """dismiss: nothing wrong. remove: take the content down. strike: take it down and strike its author
    (for a reported profile, strike the member)."""
    me = team_member("moderation")
    r = db.session.get(Report, report_id)
    if not r or r.status != "open":
        abort(404, "That report is already dealt with.")
    action = (request.get_json(silent=True) or {}).get("action")
    same_target = db.select(Report).where(Report.target_type == r.target_type, Report.target_id == r.target_id,
                                          Report.status == "open")
    if action == "dismiss":
        closed, outcome = [r], "dismissed"
        record("report_dismissed", r.target_type, r.target_id, reason=r.reason[:160])
    elif action in ("remove", "strike"):
        if r.target_type == "user":
            if action == "remove":
                abort(400, "A profile cannot be removed. Strike or suspend the member instead.")
            author = _member(r.target_id)
        else:
            author = _remove(r.target_type, r.target_id)
            record("removed", r.target_type, r.target_id, name=author.display_name if author else None,
                   reason=r.reason[:160])
        if action == "strike" and author:
            _can_act_on(author)
            _strike(author, r.reason, None if r.target_type == "user" else (r.target_type, r.target_id))
        closed, outcome = db.session.scalars(same_target).all(), "resolved"
    else:
        abort(400, "Choose what to do with this report.")
    for report in closed:
        report.status, report.resolved_by_id, report.resolved_at = outcome, me.id, utcnow()
    db.session.commit()
    return jsonify(status=outcome, closed=len(closed))


@bp.delete("/admin/content/<kind>/<int:target_id>")
@jwt_required()
def remove_content(kind, target_id):
    team_member("moderation")
    author = _remove(kind, target_id)
    if not author:
        abort(404, "That is already gone.")
    record("removed", kind, target_id, name=author.display_name)
    db.session.commit()
    return jsonify(removed=True)


# ---------------------------------------------------------------- mentors and bookings

@bp.get("/admin/mentors")
@jwt_required()
def mentors():
    team_member("mentors")
    rows = db.session.scalars(db.select(MentorProfile).order_by(MentorProfile.id.desc())).all()
    ratings = {mid: (avg, n) for mid, avg, n in db.session.execute(
        db.select(MentorReview.mentor_id, db.func.avg(MentorReview.rating), db.func.count(MentorReview.id))
        .group_by(MentorReview.mentor_id))}
    sessions = dict(db.session.execute(db.select(Booking.mentor_id, db.func.count(Booking.id))
                                       .where(Booking.status.in_(("confirmed", "completed"))).group_by(Booking.mentor_id)).all())
    return jsonify([{
        "id": m.id, "user": {**s.user_brief(m.user), "email": m.user.email}, "university": m.university, "course": m.course,
        "country": m.community.country.name, "priceMinor": m.price_minor, "currency": m.currency,
        "sessionMinutes": m.session_minutes, "listed": m.is_verified, "sessions": sessions.get(m.id, 0),
        "rating": round(float(ratings[m.id][0]), 1) if m.id in ratings else None,
        "reviewCount": ratings[m.id][1] if m.id in ratings else 0,
    } for m in rows])


@bp.post("/admin/mentors/<int:mentor_id>/listed")
@jwt_required()
def set_listed(mentor_id):
    team_member("mentors")
    m = db.session.get(MentorProfile, mentor_id) or abort(404, "We could not find that mentor.")
    m.is_verified = bool((request.get_json(silent=True) or {}).get("listed"))
    record("mentor_listed" if m.is_verified else "mentor_hidden", "user", m.user_id, name=m.user.display_name)
    db.session.commit()
    return jsonify(listed=m.is_verified)


def _mentor(mentor_id):
    return db.session.get(MentorProfile, mentor_id) or abort(404, "We could not find that mentor.")


@bp.get("/admin/mentors/<int:mentor_id>")
@jwt_required()
def mentor_detail(mentor_id):
    team_member("mentors")
    m = _mentor(mentor_id)
    reviews = db.session.scalars(db.select(MentorReview).where(MentorReview.mentor_id == m.id).order_by(MentorReview.id.desc()))
    return jsonify(id=m.id, headline=m.headline, about=m.about or "", university=m.university, course=m.course,
                   price=m.price_minor // 100, sessionMinutes=m.session_minutes, bookings=count(Booking.mentor_id == m.id),
                   reviews=[{"id": r.id, "rating": r.rating, "body": r.body, "by": r.author.display_name,
                             "at": r.created_at.isoformat()} for r in reviews])


@bp.patch("/admin/mentors/<int:mentor_id>")
@jwt_required()
def edit_mentor(mentor_id):
    """Fix what students read on a mentor's page. Session length and hours stay the mentor's own."""
    team_member("mentors")
    m = _mentor(mentor_id)
    data = request.get_json(silent=True) or {}
    for field, label, shortest, longest in (("headline", "headline", 10, 160), ("university", "university", 2, 120),
                                            ("course", "course", 2, 120), ("about", "About text", 0, 4000)):
        if field in data:
            value = str(data[field] or "").strip()
            if not shortest <= len(value) <= longest:
                abort(400, f"The {label} should be {shortest} to {longest} characters.")
            setattr(m, field, value)
    if "price" in data:
        price = data["price"] if isinstance(data["price"], int) else 0
        if not 299 <= price <= 9999:
            abort(400, "Set a session price between ₹299 and ₹9,999.")
        m.price_minor = price * 100
    record("mentor_edited", "user", m.user_id, name=m.user.display_name)
    db.session.commit()
    return jsonify(saved=True)


@bp.delete("/admin/mentors/<int:mentor_id>")
@jwt_required()
def remove_mentor(mentor_id):
    """Stop someone being a mentor. Their member account stays; they can apply again."""
    team_member("mentors")
    m = _mentor(mentor_id)
    if count(Booking.mentor_id == m.id):
        abort(409, "Students have booked this mentor, and those sessions have to be kept. "
                   "Hide them from the directory instead.")
    user = m.user
    record("mentor_removed", "user", user.id, name=user.display_name)
    db.session.execute(db.update(MentorApplication)
                       .where(MentorApplication.user_id == user.id, MentorApplication.status == "approved")
                       .values(status="rejected", note="Your mentor profile was taken down by the TYM team. You can apply again."))
    db.session.execute(db.delete(MentorProfile).where(MentorProfile.id == m.id))  # hours and reviews go with it
    if user.role == "mentor":
        user.role = "student"
    db.session.commit()
    return jsonify(removed=True)


@bp.delete("/admin/reviews/<int:review_id>")
@jwt_required()
def delete_review(review_id):
    team_member("mentors")
    r = db.session.get(MentorReview, review_id) or abort(404, "That review is already gone.")
    record("review_removed", "user", r.author_id, name=r.author.display_name)
    db.session.delete(r)
    db.session.commit()
    return jsonify(removed=True)


@bp.get("/admin/bookings")
@jwt_required()
def bookings():
    team_member("bookings")
    now = utcnow()
    month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    q = db.select(Booking).join(AvailabilitySlot, Booking.slot_id == AvailabilitySlot.id)
    status = request.args.get("status", "all")
    if status == "upcoming":
        q = q.where(Booking.status == "confirmed", AvailabilitySlot.starts_at > now).order_by(AvailabilitySlot.starts_at)
    elif status != "all":
        q = q.where(Booking.status == status).order_by(Booking.id.desc())
    else:
        q = q.order_by(Booking.id.desc())

    def total(*where):
        return int(db.session.scalar(db.select(db.func.coalesce(db.func.sum(Payment.amount_minor), 0)).where(*where)))

    def row(b):
        pay = b.payment
        return {"id": b.id, "status": b.status, "startsAt": b.slot.starts_at.isoformat(), "topic": b.topic,
                "student": {**s.user_brief(b.student), "email": b.student.email},
                "mentor": s.user_brief(b.mentor.user), "amountMinor": pay.amount_minor if pay else b.mentor.price_minor,
                "currency": pay.currency if pay else b.mentor.currency, "payment": pay.status if pay else None,
                "invoice": pay.invoice_number if pay else None, "bookedAt": b.created_at.isoformat()}

    return jsonify(**paged(q, row), summary={
        "earnedThisMonthMinor": total(Payment.status == "paid", Payment.created_at >= month),
        "earnedAllTimeMinor": total(Payment.status == "paid"), "refundedMinor": total(Payment.status == "refunded"),
        "upcoming": db.session.scalar(db.select(db.func.count(Booking.id)).join(AvailabilitySlot, Booking.slot_id == AvailabilitySlot.id)
                                      .where(Booking.status == "confirmed", AvailabilitySlot.starts_at > now)),
        "currency": "INR"})


@bp.post("/admin/bookings/<int:booking_id>/cancel")
@jwt_required()
def cancel_booking(booking_id):
    """Cancel a session on someone's behalf (a mentor fell ill, a student wrote in). With refund: true the
    money goes back through Razorpay first; if that fails nothing is changed."""
    team_member("bookings")
    b = db.session.get(Booking, booking_id) or abort(404, "We could not find that booking.")
    if b.status not in ("confirmed", "pending_payment"):
        abort(409, f"This booking is already {b.status.replace('_', ' ')}.")
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason") or "").strip()[:255]
    if len(reason) < 5:
        abort(400, "Write a short reason. The student and the mentor are told.")
    pay = b.payment
    refunded = False
    if data.get("refund") and pay and pay.status == "paid":
        try:
            pay.razorpay_refund_id = payments.refund(pay.razorpay_payment_id, pay.amount_minor)["id"]
        except payments.PaymentError:
            abort(502, "Razorpay did not accept the refund. Refund it in the Razorpay dashboard, then cancel here without a refund.")
        pay.status, refunded = "refunded", True
    b.status, b.note = "cancelled", reason
    record("booking_cancelled", "user", b.student_id, name=b.student.display_name, refunded=refunded)
    db.session.commit()  # the money has moved: save that before anything else can go wrong
    when = b.slot.starts_at.strftime("%d %b %Y, %H:%M UTC")
    money = " The payment has been refunded and should reach the account within a few working days." if refunded else ""
    for person, other in ((b.student, b.mentor.user), (b.mentor.user, b.student)):
        notify(person.id, current_user, "booking", message=f"cancelled your session with {other.display_name}: {reason}")
    db.session.commit()
    for person, other in ((b.student, b.mentor.user), (b.mentor.user, b.student)):
        mailer.send_quietly(person.email, f"Cancelled: your session with {other.display_name}",
                            f"<p>Hi {escape(person.display_name.split()[0])},</p><p>The session with {escape(other.display_name)} on "
                            f"{when} has been cancelled by The Youth Matters.</p><p>Reason: {escape(reason)}</p><p>{money}</p>",
                            reply_to=current_app.config["CONTACT_EMAIL"])
    return jsonify(status=b.status, payment=pay.status if pay else None, refunded=refunded)


@bp.get("/admin/payments")
@jwt_required()
def payment_list():
    team_member("bookings")
    q = db.select(Payment)
    status = request.args.get("status", "all")
    if status != "all":
        q = q.where(Payment.status == status)
    members = {}

    def row(pay):
        who = members.setdefault(pay.user_id, db.session.get(User, pay.user_id))
        b = pay.booking
        return {"id": pay.id, "status": pay.status, "amountMinor": pay.amount_minor, "currency": pay.currency,
                "at": pay.created_at.isoformat(), "member": {**s.user_brief(who), "email": who.email},
                "mentor": b.mentor.user.display_name if b else None, "sessionAt": b.slot.starts_at.isoformat() if b else None,
                "bookingId": b.id if b else None, "bookingStatus": b.status if b else None, "invoice": pay.invoice_number,
                "orderId": pay.razorpay_order_id, "paymentId": pay.razorpay_payment_id, "refundId": pay.razorpay_refund_id}

    def total(*where):
        return int(db.session.scalar(db.select(db.func.coalesce(db.func.sum(Payment.amount_minor), 0)).where(*where)))

    month = utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return jsonify(**paged(q.order_by(Payment.id.desc()), row), summary={
        "paidMinor": total(Payment.status == "paid"), "paidThisMonthMinor": total(Payment.status == "paid", Payment.created_at >= month),
        "refundedMinor": total(Payment.status == "refunded"), "paidCount": count(Payment.status == "paid"),
        "refundedCount": count(Payment.status == "refunded"), "currency": "INR"})


@bp.get("/admin/earnings")
@jwt_required()
def earnings():
    """What each mentor's paid sessions brought in, for working out what they are owed."""
    team_member("bookings")
    month = utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    paid = db.case((Payment.status == "paid", Payment.amount_minor), else_=0)
    total = db.func.coalesce(db.func.sum(paid), 0)
    rows = db.session.execute(
        db.select(MentorProfile, db.func.count(Payment.id).filter(Payment.status == "paid"), total,
                  db.func.coalesce(db.func.sum(db.case((Payment.created_at >= month, paid), else_=0)), 0))
        .join(Booking, Booking.mentor_id == MentorProfile.id).join(Payment, Payment.booking_id == Booking.id)
        .group_by(MentorProfile.id).order_by(total.desc())).all()
    return jsonify([{"mentor": {**s.user_brief(m.user), "email": m.user.email}, "mentorId": m.id, "sessions": n,
                     "paidMinor": int(all_time), "thisMonthMinor": int(this_month), "currency": m.currency}
                    for m, n, all_time, this_month in rows])
