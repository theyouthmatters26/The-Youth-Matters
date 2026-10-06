from datetime import date

from ..extensions import db
from .base import Model, enum, utcnow

ROLES = ("student", "mentor", "admin", "bot")
STATUSES = ("pending", "active", "suspended", "banned")
STUDY_LEVELS = ("undergraduate", "postgraduate", "phd", "foundation", "other")
VERIFICATION_STATUSES = ("pending", "review", "verified", "rejected")
DOCUMENT_TYPES = ("passport", "driving_licence", "national_id")


class User(Model):
    __tablename__ = "users"

    email = db.Column(db.String(255), unique=True, nullable=False)
    username = db.Column(db.String(32), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))  # null for Google-only accounts
    google_id = db.Column(db.String(64), unique=True)
    email_verified = db.Column(db.Boolean, nullable=False, default=False)
    # One-time code for email verification and password reset (sha256 of code, 10 minute expiry)
    email_code_hash = db.Column(db.String(64))
    email_code_expires_at = db.Column(db.DateTime(timezone=True))

    role = db.Column(enum(*ROLES, name="user_role"), nullable=False, default="student")
    # pending until the identity check passes, then active
    status = db.Column(enum(*STATUSES, name="user_status"), nullable=False, default="pending")
    muted_until = db.Column(db.DateTime(timezone=True))  # set by strike 2

    date_of_birth = db.Column(db.Date)  # read from the photo ID during verification
    display_name = db.Column(db.String(80), nullable=False)
    avatar_url = db.Column(db.String(255))  # public image (CDN or site path); uploads land here in phase 2
    bio = db.Column(db.String(500))
    target_country_id = db.Column(db.Integer, db.ForeignKey("countries.id"))
    study_level = db.Column(enum(*STUDY_LEVELS, name="study_level"))

    last_seen_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    target_country = db.relationship("Country")
    verification = db.relationship("IdentityVerification", back_populates="user", uselist=False,
                                   foreign_keys="IdentityVerification.user_id")

    @staticmethod
    def age_on(dob, today=None):
        today = today or date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


class IdentityVerification(Model):
    """Age + identity check at onboarding (services/identity.py): the date of birth is read from a
    photo ID and the face on it is matched to a live selfie.

    Privacy: the ID photo is kept only while the check is open; the selfie only if it goes to a
    person for review. Both are deleted once a decision is made. id_face is the face embedding
    (512 bytes) carried from the ID step to the selfie step, cleared at the end too."""
    __tablename__ = "identity_verifications"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        unique=True, nullable=False)
    status = db.Column(enum(*VERIFICATION_STATUSES, name="verification_status"),
                       nullable=False, default="pending")
    document_type = db.Column(enum(*DOCUMENT_TYPES, name="document_type"))
    dob_source = db.Column(enum("mrz", "label", "date", name="dob_source"))
    id_face = db.Column(db.LargeBinary)
    document_key = db.Column(db.String(255))
    selfie_key = db.Column(db.String(255))
    face_score = db.Column(db.Float)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.String(255))
    decided_at = db.Column(db.DateTime(timezone=True))
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))

    user = db.relationship("User", back_populates="verification", foreign_keys=[user_id])


class Block(Model):
    __tablename__ = "blocks"
    __table_args__ = (
        db.UniqueConstraint("blocker_id", "blocked_id"),
        db.CheckConstraint("blocker_id <> blocked_id", name="ck_blocks_not_self"),
    )

    blocker_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
