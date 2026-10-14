"""Mentor applications (Module 9). Someone who signed up at /mentors/signup applies with everything
a mentor profile needs. The team reviews it; approval makes the account active and the profile live
and bookable straight away.

A mentor account is its own account and shows no photo ID: until the team decides, it is "pending"
and the only thing it can do is write and send this application.

    GET  /mentor-application                         your latest application, or null
    POST /mentor-application                         multipart: the fields below, plus cv and proof files
    GET  /admin/mentor-applications?status=pending   the review queue (admins)
    GET  /admin/mentor-applications/<id>/files/cv | proof
    POST /admin/mentor-applications/<id>/decision    {approve: true|false, note}
"""
import json
import re
from io import BytesIO
from pathlib import Path
from zoneinfo import available_timezones

from flask import Blueprint, abort, current_app, jsonify, redirect, request, send_from_directory
from flask_jwt_extended import current_user, jwt_required
from markupsafe import escape

from ..extensions import db, limiter
from ..models import (AccountClosure, Community, Country, MentorApplication, MentorProfile, ModerationLog,
                      Subject)
from ..models.base import utcnow
from ..services import accounts, content, handoff, images, mailer, staff, storage
from ..services.notify import notify

bp = Blueprint("mentor_applications", __name__)

MAX_FILE = 5 * 1024 * 1024
LINKEDIN = re.compile(r"^https://([a-z]{2,3}\.)?linkedin\.com/\S+$", re.I)
ZONES = available_timezones()


def _summary(a):
    return {
        "id": a.id, "status": a.status, "note": a.note, "createdAt": a.created_at.isoformat(),
        "decidedAt": a.decided_at.isoformat() if a.decided_at else None,
        "country": a.community.country.slug, "university": a.university, "course": a.course,
        "graduationYear": a.graduation_year, "graduated": a.graduated, "headline": a.headline, "about": a.about,
        "experience": a.experience, "topics": a.topics, "languages": a.languages, "linkedin": a.linkedin,
        "sessionMinutes": a.session_minutes, "timezone": a.timezone,
        "weeklyHours": a.weekly_hours, "details": a.details or {},
    }


# The registration form's own questions (frontend/src/data/mentorForm.js). These must be answered:
REQUIRED = ("firstName", "lastName", "mobileCode", "mobile", "city", "currentCountry", "qualification", "field",
            "studiedAbroad", "totalExperience", "employment", "organisation", "jobTitle", "jobDescription",
            "studyAbroadRole", "howYouKnow", "mentorCountries", "studyAreas", "expertise", "whyMentor",
            "studentsLearn", "approach", "formats",
            "availability", "confirmName")
KEY = re.compile(r"^[A-Za-z]{2,40}$")


def _details(raw):
    """{question: answer} where an answer is text or a list of choices. Cleaned like any other text a
    member writes, and kept small: it is shown to the team as it was sent."""
    try:
        sent = json.loads(raw or "{}")
        if not isinstance(sent, dict) or len(sent) > 60:
            raise ValueError
    except (ValueError, TypeError):
        abort(400, "We could not read your answers. Reload the page and try again.")
    clean = {}
    for key, value in sent.items():
        if not KEY.match(str(key)):
            continue
        if isinstance(value, list):
            # 160, not 80: one answer here can be a qualification, an institution and a country
            value = [content.clean(str(v), 161)[0][:160] for v in value[:20]]
            value = [v for v in value if v]
        else:
            value = content.clean(str(value), 2001)[0][:2000]
        if value:
            clean[key] = value
    if missing := [k for k in REQUIRED if k not in clean]:
        abort(400, "Some required answers are missing. Check each section marked with *.")
    return clean


def _text(form, key, label, lo, hi, required=True):
    value, _ = content.clean(form.get(key, ""), hi + 1)
    if not value and not required:
        return None
    if not lo <= len(value) <= hi:
        abort(400, f"{label}: write between {lo} and {hi} characters.")
    return value


def _list(form, key, label, most, longest):
    try:
        items = [content.clean(str(x), longest + 1)[0] for x in json.loads(form.get(key) or "[]")]
    except (ValueError, TypeError):
        abort(400, f"{label}: we could not read that list.")
    items = list(dict.fromkeys(i for i in items if i))
    if not 1 <= len(items) <= most or any(len(i) > longest for i in items):
        abort(400, f"{label}: add between 1 and {most}, each under {longest} characters.")
    return items


def _file(name, label, allow_images):
    upload = request.files.get(name)
    if not upload or not upload.filename:
        abort(400, f"Add your {label}.")
    data = upload.read(MAX_FILE + 1)
    if len(data) > MAX_FILE:
        abort(400, f"Your {label} is over 5 MB. Upload a smaller file.")
    if data.startswith(b"%PDF"):
        return storage.upload(data, "applications", "application/pdf")
    if not allow_images:
        abort(400, f"Upload your {label} as a PDF.")
    try:
        return storage.upload(images.prepare(BytesIO(data), max_side=2400), "applications", "image/jpeg")
    except images.ImageError:
        abort(400, f"Upload your {label} as a PDF, JPG or PNG.")


@bp.get("/mentor-application")
@jwt_required()
def mine():
    a = db.session.scalar(db.select(MentorApplication).where(MentorApplication.user_id == current_user.id)
                          .order_by(MentorApplication.id.desc()).limit(1))
    return jsonify(_summary(a) if a else None)


def _applicant():
    """Who may send an application: a mentor account, waiting for the team or already approved."""
    user = current_user
    if user.role != "mentor":
        abort(403, "Mentor applications come from a mentor account. Sign up on the Become a mentor page.")
    if user.status not in ("pending", "active"):
        abort(403, "This account is suspended. Write to support@theyouthmatters.com.")
    return user


@bp.post("/mentor-application")
@jwt_required()
@limiter.limit("5 per day")
def apply():
    user = _applicant()
    if db.session.scalar(db.select(MentorProfile.id).where(MentorProfile.user_id == user.id)):
        abort(409, "You are already a TYM mentor.")
    if db.session.scalar(db.select(MentorApplication.id).where(
            MentorApplication.user_id == user.id, MentorApplication.status == "pending")):
        abort(409, "Your application is already with our team.")
    if not user.avatar_url:
        abort(400, "Add a profile photo first. Students book mentors they can see.")

    f = request.form
    community = db.session.scalar(db.select(Community).join(Subject).join(Country).where(
        Subject.slug == "study-abroad", Country.slug == f.get("country", ""), Community.is_active))
    if not community:
        abort(400, "Choose the country you studied in.")
    year = f.get("graduationYear", type=int)
    if not year or not 1970 <= year <= 2035:
        abort(400, "Enter your graduation year, or the year you expect to graduate.")
    tz = f.get("timezone", "")
    if tz not in ZONES:
        abort(400, "Choose your time zone.")
    linkedin = (f.get("linkedin") or "").strip() or None
    if linkedin and not LINKEDIN.match(linkedin):
        abort(400, "Use your full LinkedIn profile link, starting with https://www.linkedin.com/")
    if f.get("agree") != "true":
        abort(400, "Please agree to the Mentor Code of Conduct and the declarations.")
    details = _details(f.get("details"))

    a = MentorApplication(
        user_id=user.id, community=community, graduation_year=year, graduated=f.get("graduated") == "true",
        university=_text(f, "university", "University", 2, 120), course=_text(f, "course", "Course", 2, 120),
        headline=_text(f, "headline", "Headline", 20, 160), about=_text(f, "about", "About you", 150, 2000),
        experience=_text(f, "experience", "Experience", 2, 255, required=False),
        topics=_list(f, "topics", "Topics", 20, 60), languages=_list(f, "languages", "Languages", 6, 30),
        linkedin=linkedin, timezone=tz, details=details,
    )
    a.cv_key = _file("cv", "CV", allow_images=False)
    a.proof_key = _file("proof", "proof of enrolment or degree", allow_images=True)
    db.session.add(a)
    db.session.commit()

    rows = [("Member", f"{user.display_name} (@{user.username}, {user.email})"), ("Country", community.country.name),
            ("Studies", f"{a.course}, {a.university}, {'graduated' if a.graduated else 'graduating'} {a.graduation_year}"),
            ("Headline", a.headline), ("Topics", ", ".join(a.topics)), ("Languages", ", ".join(a.languages)),
            ("Time zone", a.timezone),
            ("LinkedIn", a.linkedin or "-"),
            ("Mobile", f"{details['mobileCode']} {details['mobile']}"), ("Lives in", f"{details['city']}, {details['currentCountry']}"),
            ("Work", f"{details['jobTitle']}, {details['organisation']} ({details['totalExperience']})"),
            ("Mentors for", ", ".join(details["mentorCountries"]) if isinstance(details["mentorCountries"], list) else details["mentorCountries"])]
    html = "".join(f"<p><b>{k}:</b> {escape(v)}</p>" for k, v in rows) + f"<p>{escape(a.about)}</p>"
    # The application is saved: a failed email must not tell the applicant it was lost
    mailer.send_quietly(current_app.config["CONTACT_EMAIL"], f"[Mentor application #{a.id}] {user.display_name}", html,
                        reply_to=user.email)
    return jsonify(_summary(a)), 201


def _turned_down(user, note):
    """Tell them it was not approved and close the account, which is what the team asked for.

    The account only exists to carry the application, so it goes with it. Everything they need to
    come back is in the email, because there is nothing left to log in to. A row in
    account_closures keeps the record of who was turned down and why."""
    site = handoff.site_url()
    mailer.send_quietly(user.email, "Your TYM mentor application",
                        f"<p>Hi {escape(user.display_name.split()[0])},</p>"
                        f"<p>Thank you for applying to mentor with The Youth Matters. We are not able to "
                        f"approve your application this time.</p>"
                        f"<blockquote style='margin:16px 0;padding:0 0 0 14px;border-left:3px solid #e5e5e5;"
                        f"color:#444'>{escape(note or 'Our team could not approve it on this occasion.')}"
                        f"</blockquote>"
                        f"<p>Your mentor account has been closed, so there is nothing left to sign in to. "
                        f"You are welcome to:</p>"
                        f"<ul>"
                        f"<li><a href='{site}/mentors/signup'>Apply again as a mentor</a> once you can meet "
                        f"the points above</li>"
                        f"<li><a href='{site}/register'>Join as a student</a> instead, which is free and "
                        f"opens the community, the chatrooms and TYM AI</li>"
                        f"</ul>"
                        f"<p>Thank you for your interest in TYM.</p>")
    db.session.add(AccountClosure(display_name=user.display_name, username=user.username, email=user.email,
                                  reason=f"Mentor application rejected: {note or 'no note'}"[:1000],
                                  kept=False, joined_at=user.created_at))


def _admin():
    if not staff.can(current_user, "mentors"):
        abort(403, "Only team members with access to mentors can review applications.")


def _application(application_id):
    a = db.session.get(MentorApplication, application_id)
    if not a:
        abort(404, "We could not find that application.")
    return a


@bp.get("/admin/mentor-applications")
@jwt_required()
def queue():
    _admin()
    status = request.args.get("status", "pending")
    rows = db.session.scalars(db.select(MentorApplication).where(MentorApplication.status == status)
                              .order_by(MentorApplication.id))
    return jsonify([{**_summary(a), "user": {"id": a.user.id, "username": a.user.username, "avatar": a.user.avatar_url,
                                             "displayName": a.user.display_name, "email": a.user.email, "role": a.user.role},
                     "proofIsPdf": a.proof_key.endswith(".pdf")} for a in rows])


@bp.get("/admin/mentor-applications/<int:application_id>/files/<kind>")
@jwt_required()
def document(application_id, kind):
    _admin()
    a = _application(application_id)
    key = {"cv": a.cv_key, "proof": a.proof_key}.get(kind) or abort(404)
    if current_app.config["SPACES_KEY"]:
        url = storage.signed_url(key)
        return jsonify(url=url) if request.args.get("link") else redirect(url)  # the panel asks for the link
    return send_from_directory(Path(current_app.instance_path, "private"), key)


@bp.post("/admin/mentor-applications/<int:application_id>/decision")
@jwt_required()
def decide(application_id):
    _admin()
    a = _application(application_id)
    if a.status != "pending":
        abort(409, f"This application was already {a.status}.")
    data = request.get_json(silent=True) or {}
    a.status = "approved" if data.get("approve") else "rejected"
    a.note = str(data.get("note") or "").strip()[:500] or None
    if a.status == "rejected" and len(a.note or "") < 10:
        abort(400, "Write a note saying what they should change. They see it when they apply again.")
    a.decided_at, a.reviewed_by_id = utcnow(), current_user.id
    if a.status == "approved":
        m = db.session.scalar(db.select(MentorProfile).where(MentorProfile.user_id == a.user_id)) \
            or MentorProfile(user_id=a.user_id)
        m.community_id, m.university, m.course, m.graduation_year = a.community_id, a.university, a.course, a.graduation_year
        m.headline, m.about, m.experience = a.headline, a.about, a.experience
        m.topics, m.languages, m.links = a.topics, a.languages, {"linkedin": a.linkedin} if a.linkedin else None
        m.session_minutes = a.session_minutes
        m.timezone, m.weekly_hours, m.is_verified = a.timezone, a.weekly_hours, True
        db.session.add(m)
        if a.user.role == "student":  # someone on the team who also mentors keeps their place on the team
            a.user.role = "mentor"
        if a.user.status == "pending":
            a.user.status = "active"  # approving the application is what opens a mentor's account
        notify(a.user_id, current_user, "system",
               message="approved your mentor application. Students can book you now.")
    db.session.add(ModerationLog(actor_id=current_user.id, action=f"mentor_{a.status}", target_type="user",
                                 target_id=a.user_id, detail={"name": a.user.display_name}))
    summary = _summary(a)
    files = []
    if a.status == "rejected":
        user = a.user
        # Only an account that exists to carry this application is closed. A student who also
        # mentors, or somebody on the team, keeps everything: they had a life here before this form.
        if user.role == "mentor" and user.status == "pending" and not accounts.has_records(user):
            _turned_down(user, a.note)
            files = accounts.erase(user, blog_author_id=None)
        else:
            notify(a.user_id, current_user, "system",
                   message="reviewed your mentor application. Open TYM Mentors to see the note.")
    db.session.commit()
    accounts.remove_files(files)
    return jsonify(summary)
