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
    # Set when the password changes: sign-ins from before then stop working (see api/auth.py)
    tokens_valid_after = db.Column(db.DateTime(timezone=True))

    role = db.Column(enum(*ROLES, name="user_role"), nullable=False, default="student")
    # pending until the identity check passes, then active
    status = db.Column(enum(*STATUSES, name="user_status"), nullable=False, default="pending")
    muted_until = db.Column(db.DateTime(timezone=True))  # set by strike 2
    # Admins only: the parts of the admin panel this person may open, e.g. ["support"]. ["*"] = all.
    # The owner (ADMIN_EMAIL in .env) always has everything, whatever is stored here.
    admin_access = db.Column(db.JSON)

    date_of_birth = db.Column(db.Date)  # read from the photo ID during verification
    display_name = db.Column(db.String(80), nullable=False)
    avatar_url = db.Column(db.String(255))  # profile photo: a site path or /api/media/... for uploads
    cover_url = db.Column(db.String(255))   # wide banner on the profile page
    bio = db.Column(db.String(500))
    target_country_id = db.Column(db.Integer, db.ForeignKey("countries.id"))
    study_level = db.Column(enum(*STUDY_LEVELS, name="study_level"))
    # Where they are going: shown on their profile so answers can be specific
    university = db.Column(db.String(120))
    course = db.Column(db.String(120))
    intake = db.Column(db.String(40))  # e.g. "September 2026"

    last_seen_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    target_country = db.relationship("Country")
    verification = db.relationship("IdentityVerification", back_populates="user", uselist=False,
                                   foreign_keys="IdentityVerification.user_id")

    @staticmethod
    def age_on(dob, today=None):
        today = today or date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


class IdentityVerification(Model):
    """Age check at onboarding (api/verify.py): the date of birth is read from a photo ID.
    Privacy: the photo itself is never stored, only which document was used and how the date was read."""
    __tablename__ = "identity_verifications"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        unique=True, nullable=False)
    status = db.Column(enum(*VERIFICATION_STATUSES, name="verification_status"),
                       nullable=False, default="pending")
    document_type = db.Column(enum(*DOCUMENT_TYPES, name="document_type"))
    dob_source = db.Column(enum("mrz", "label", "date", name="dob_source"))
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
