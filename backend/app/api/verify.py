"""Age check (Module 1): a photo ID -> date of birth (OCR, services/identity.py) -> 18+.

A readable date of birth that shows 18 or over verifies the account straight away. The photo is
read in memory and never stored: we keep the date of birth, not the document.
"""
from flask import Blueprint, abort, current_app, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db, limiter
from ..models import IdentityVerification, User
from ..models.base import utcnow
from ..models.user import DOCUMENT_TYPES
from ..services import identity
from . import serializers as s

bp = Blueprint("verify", __name__)


@bp.post("/verify/document")
@jwt_required()
@limiter.limit("15 per hour")
def document():
    user = current_user
    if not user.email_verified:
        abort(403, "Confirm your email first.")
    if user.status == "active":
        abort(409, "Your account is already verified.")
    if user.status != "pending":  # suspended or banned: an ID photo must not switch the account back on
        abort(403, "This account is suspended. Write to support@theyouthmatters.org if you think this is a mistake.")
    v = user.verification or IdentityVerification(user=user)
    if v.status == "rejected":
        abort(403, "We could not verify this account. Write to support@theyouthmatters.org for help.")

    doc_type = request.form.get("documentType")
    if doc_type not in DOCUMENT_TYPES:
        abort(400, "Choose which document this is.")
    upload = request.files.get("document")
    if not upload:
        abort(400, "Add a photo of your document to continue.")
    try:
        dob, source = identity.read_dob(identity.decode(upload.read()))
    except identity.IdentityError as e:
        abort(422, str(e))

    min_age = current_app.config["MIN_AGE"]
    if User.age_on(dob) < min_age:
        abort(403, f"The date of birth on this document is {dob.day} {dob:%B %Y}. "
                   f"The Youth Matters is for members aged {min_age} and over.")

    v.document_type, v.dob_source, v.status, v.decided_at = doc_type, source, "verified", utcnow()
    user.date_of_birth, user.status = dob, "active"
    db.session.add(v)
    db.session.commit()
    return jsonify(dateOfBirth=dob.isoformat(), source=source, user=s.me(user))
