"""Identity check (Module 1): photo ID -> date of birth (18+) -> live selfie matched to the ID.

How the reading and matching work is in services/identity.py. A selfie that does not match after
MAX_SELFIE_ATTEMPTS goes to a person (status "review", admin panel) instead of failing forever.
"""
from flask import Blueprint, abort, current_app, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db, limiter
from ..models import IdentityVerification, User
from ..models.base import utcnow
from ..models.user import DOCUMENT_TYPES
from ..services import identity, storage
from . import serializers as s

bp = Blueprint("verify", __name__)

MAX_SELFIE_ATTEMPTS = 3


def _open_check():
    user = current_user
    if not user.email_verified:
        abort(403, "Confirm your email first.")
    if user.status == "active":
        abort(409, "Your account is already verified.")
    v = user.verification or IdentityVerification(user=user)
    if v.status == "review":
        abort(409, "Your check is with our team. We will email you within 24 hours.")
    if v.status == "rejected":
        abort(403, "We could not verify this account. Write to support@theyouthmatters.org for help.")
    return v


def _photo(field):
    upload = request.files.get(field)
    if not upload:
        abort(400, "Add a photo to continue.")
    try:
        return identity.decode(upload.read())
    except identity.IdentityError as e:
        abort(400, str(e))


@bp.post("/verify/document")
@jwt_required()
@limiter.limit("15 per hour")
def document():
    v = _open_check()
    doc_type = request.form.get("documentType")
    if doc_type not in DOCUMENT_TYPES:
        abort(400, "Choose which document this is.")
    img = _photo("document")
    try:
        dob, source = identity.read_dob(img)
        face = identity.id_face(img)
    except identity.IdentityError as e:
        abort(422, str(e))

    min_age = current_app.config["MIN_AGE"]
    if User.age_on(dob) < min_age:
        abort(403, f"The date of birth on this document is {dob.day} {dob:%B %Y}. "
                   f"The Youth Matters is for members aged {min_age} and over.")

    storage.delete(v.document_key)  # an earlier attempt, if any
    v.document_key = storage.upload(identity.to_jpeg(img), "identity", "image/jpeg")
    v.document_type, v.dob_source, v.id_face, v.status = doc_type, source, face, "pending"
    current_user.date_of_birth = dob
    db.session.add(v)
    db.session.commit()
    return jsonify(dateOfBirth=dob.isoformat(), source=source, user=s.me(current_user))


@bp.post("/verify/selfie")
@jwt_required()
@limiter.limit("20 per hour")
def selfie():
    v = _open_check()
    if not v.id_face:
        abort(409, "Add your photo ID first.")
    straight, turned = _photo("straight"), _photo("turned")
    try:
        score = identity.check_selfie(straight, turned, v.id_face)
    except identity.IdentityError as e:
        abort(422, str(e))  # framing / liveness problems are retakes, they do not use up an attempt

    v.attempts += 1
    v.face_score = score
    if score >= identity.MATCH_THRESHOLD:
        v.status, current_user.status = "verified", "active"
        storage.delete(v.document_key)
        v.document_key = v.id_face = None
        v.decided_at = utcnow()
    elif v.attempts >= MAX_SELFIE_ATTEMPTS:
        v.status = "review"
        v.selfie_key = storage.upload(identity.to_jpeg(straight), "identity", "image/jpeg")
        v.id_face = None
        v.note = f"Face match {score:.2f} after {v.attempts} tries"
    db.session.commit()

    if v.status == "pending":
        left = MAX_SELFIE_ATTEMPTS - v.attempts
        abort(422, "Your selfie did not match the photo on your ID. Face the light, take off glasses "
                   f"or a cap, and try again ({left} {'try' if left == 1 else 'tries'} left).")
    return jsonify(user=s.me(current_user))
