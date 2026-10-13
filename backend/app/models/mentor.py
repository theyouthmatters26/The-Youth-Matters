from ..extensions import db
from .base import Model, enum

# Active bookings hold their slot; the partial unique index below lets a slot be booked again
# once an earlier booking was cancelled or its payment hold expired.
ACTIVE_BOOKING = "status IN ('pending_payment', 'confirmed')"


class MentorProfile(Model):
    __tablename__ = "mentor_profiles"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        unique=True, nullable=False)
    community_id = db.Column(db.Integer, db.ForeignKey("communities.id"), nullable=False)
    university = db.Column(db.String(120), nullable=False)
    course = db.Column(db.String(120), nullable=False)  # major
    graduation_year = db.Column(db.SmallInteger)
    headline = db.Column(db.String(160), nullable=False)
    about = db.Column(db.Text)  # short biography
    experience = db.Column(db.String(255))
    links = db.Column(db.JSON)  # e.g. {"linkedin": "..."}
    topics = db.Column(db.JSON)  # what they help with, shown as a list
    languages = db.Column(db.JSON)
    # No price of their own: students spend counselling hours (CounselingPackage) on any mentor
    session_minutes = db.Column(db.SmallInteger, nullable=False, default=30)
    # Bookable hours in the mentor's own time zone, e.g. {"mon": ["18:00", "19:00"], "sat": ["10:30"]}
    timezone = db.Column(db.String(64), nullable=False, default="Europe/London")
    weekly_hours = db.Column(db.JSON)
    is_verified = db.Column(db.Boolean, nullable=False, default=False)

    user = db.relationship("User")
    community = db.relationship("Community")


class AvailabilitySlot(Model):
    """One bookable session time, created from the mentor's weekly hours (services/availability.py)."""
    __tablename__ = "availability_slots"
    __table_args__ = (
        db.UniqueConstraint("mentor_id", "starts_at"),
        db.CheckConstraint("ends_at > starts_at", name="ck_slots_order"),
    )

    mentor_id = db.Column(db.Integer, db.ForeignKey("mentor_profiles.id", ondelete="CASCADE"),
                          nullable=False)
    starts_at = db.Column(db.DateTime(timezone=True), nullable=False)
    ends_at = db.Column(db.DateTime(timezone=True), nullable=False)


class Booking(Model):
    __tablename__ = "bookings"
    __table_args__ = (
        db.Index("uq_bookings_active_slot", "slot_id", unique=True, postgresql_where=db.text(ACTIVE_BOOKING),
                 sqlite_where=db.text(ACTIVE_BOOKING)),  # the same rule in the tests' database
    )

    slot_id = db.Column(db.Integer, db.ForeignKey("availability_slots.id"), nullable=False)
    # Where the session ends. A booking can run across several of the mentor's slots now, so the
    # starting slot's own end is not the session's end (services/availability.py).
    ends_at = db.Column(db.DateTime(timezone=True))
    mentor_id = db.Column(db.Integer, db.ForeignKey("mentor_profiles.id"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(enum("pending_payment", "confirmed", "cancelled", "completed", "expired",
                            name="booking_status"), nullable=False, default="pending_payment")
    topic = db.Column(db.Text)  # what the student wants to cover, shared with the mentor
    student_timezone = db.Column(db.String(64))  # for showing times in emails
    hold_expires_at = db.Column(db.DateTime(timezone=True))  # slot is held while the student pays
    # The session itself happens in their chat (api/mentor_chat.py). A video call link only exists
    # when the mentor shares one, and lives on the conversation, not here.
    meeting_url = db.Column(db.String(255))
    time_up_at = db.Column(db.DateTime(timezone=True))  # when the mentor was told the time was up
    ended_at = db.Column(db.DateTime(timezone=True))    # when the mentor closed the session
    note = db.Column(db.String(255))
    # Counselling time taken from the student's balance for this session; goes back if it is cancelled in time
    minutes_deducted = db.Column(db.SmallInteger)

    slot = db.relationship("AvailabilitySlot")
    mentor = db.relationship("MentorProfile")
    student = db.relationship("User")
    payment = db.relationship("Payment", back_populates="booking", uselist=False)
    review = db.relationship("MentorReview", back_populates="booking", uselist=False)


class CounselingPackage(Model):
    """A block of counselling hours at a fixed price, the same for every mentor. Students buy one with
    Cashfree; the hours are added to User.counseling_minutes and spent by booking sessions."""
    __tablename__ = "counseling_packages"

    title = db.Column(db.String(80), nullable=False)
    hours = db.Column(db.SmallInteger, nullable=False)
    price_minor = db.Column(db.Integer, nullable=False)  # paise
    currency = db.Column(db.String(3), nullable=False, default="INR")
    is_active = db.Column(db.Boolean, nullable=False, default=True)  # off = no longer sold; old payments keep it
    sort_order = db.Column(db.Integer, nullable=False, default=0)


class Payment(Model):
    __tablename__ = "payments"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"))  # only on payments from before packages
    kind = db.Column(enum("session", "subscription", "package", name="payment_kind"), nullable=False)
    package_id = db.Column(db.Integer, db.ForeignKey("counseling_packages.id"))
    minutes = db.Column(db.Integer)  # counselling time this payment adds to the member's balance
    amount_minor = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="INR")
    # What the payment gateway calls this payment. Named for the job, not the provider.
    gateway_order_id = db.Column(db.String(64), unique=True)
    gateway_payment_id = db.Column(db.String(64), unique=True)
    gateway_refund_id = db.Column(db.String(64))
    status = db.Column(enum("created", "paid", "failed", "refunded", name="payment_status"),
                       nullable=False, default="created")
    invoice_number = db.Column(db.String(32), unique=True)

    booking = db.relationship("Booking", back_populates="payment")
    package = db.relationship("CounselingPackage")


class MentorReview(Model):
    """Left by a student after their session. Mentor ratings are the average of these."""
    __tablename__ = "mentor_reviews"
    __table_args__ = (db.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating"),)

    mentor_id = db.Column(db.Integer, db.ForeignKey("mentor_profiles.id", ondelete="CASCADE"), nullable=False)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"), unique=True)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    rating = db.Column(db.SmallInteger, nullable=False)
    body = db.Column(db.Text, nullable=False)

    author = db.relationship("User")
    booking = db.relationship("Booking", back_populates="review")


class SessionRequest(Model):
    """A session asked for through the booking form, while payments are arranged by hand.

    Anyone can send one, with or without an account. The team assigns a mentor and confirms it in
    the admin panel (api/session_requests.py); confirming opens the student's private chat with
    that mentor, which is where the session itself happens (api/mentor_chat.py)."""
    __tablename__ = "session_requests"

    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(255), nullable=False, index=True)
    whatsapp = db.Column(db.String(30))
    # Set when the email belongs to an account. Without one there is nobody to open a chat with,
    # so the team tells them to sign up: everything else about the request still works.
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    # Who they asked for, from that mentor's page. NULL when they came through /book-a-session.
    wanted_mentor_id = db.Column(db.Integer, db.ForeignKey("mentor_profiles.id", ondelete="SET NULL"))
    mentor_id = db.Column(db.Integer, db.ForeignKey("mentor_profiles.id", ondelete="SET NULL"))
    package_id = db.Column(db.Integer, db.ForeignKey("counseling_packages.id", ondelete="SET NULL"))
    status = db.Column(enum("new", "assigned", "confirmed", "cancelled", name="session_request_status"),
                       nullable=False, default="new", server_default="new")
    # When the session runs, and for how long. The team agrees both with the student, so these are
    # what the countdown in the chat is drawn from. Ending it early is what ended_at records.
    starts_at = db.Column(db.DateTime(timezone=True))
    minutes = db.Column(db.SmallInteger)
    ended_at = db.Column(db.DateTime(timezone=True))
    message = db.Column(db.Text)      # what they want to cover, passed to the mentor
    answers = db.Column(db.JSON)      # the rest of the booking form, for the team
    note = db.Column(db.String(500))  # the team's own note: the time agreed, how they paid
    confirmed_at = db.Column(db.DateTime(timezone=True))
    handled_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))

    student = db.relationship("User", foreign_keys=[student_id])
    wanted_mentor = db.relationship("MentorProfile", foreign_keys=[wanted_mentor_id])
    mentor = db.relationship("MentorProfile", foreign_keys=[mentor_id])
    package = db.relationship("CounselingPackage")


class MentorApplication(Model):
    """Everything a mentor profile needs, held for the team to review. Approving it creates the
    MentorProfile (api/mentor_applications.py). CV and proof of study are private files."""
    __tablename__ = "mentor_applications"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = db.Column(enum("pending", "approved", "rejected", name="mentor_application_status"),
                       nullable=False, default="pending")
    community_id = db.Column(db.Integer, db.ForeignKey("communities.id"), nullable=False)
    university = db.Column(db.String(120), nullable=False)
    course = db.Column(db.String(120), nullable=False)
    graduation_year = db.Column(db.SmallInteger, nullable=False)
    graduated = db.Column(db.Boolean, nullable=False, default=False)
    headline = db.Column(db.String(160), nullable=False)
    about = db.Column(db.Text, nullable=False)
    experience = db.Column(db.String(255))
    topics = db.Column(db.JSON, nullable=False)
    languages = db.Column(db.JSON, nullable=False)
    linkedin = db.Column(db.String(255))
    session_minutes = db.Column(db.SmallInteger, nullable=False)
    timezone = db.Column(db.String(64), nullable=False)
    weekly_hours = db.Column(db.JSON, nullable=False)
    details = db.Column(db.JSON)  # the rest of the registration form's answers, for the review team only
    cv_key = db.Column(db.String(255), nullable=False)
    proof_key = db.Column(db.String(255), nullable=False)
    note = db.Column(db.String(500))  # the team's reason when they turn an application down
    decided_at = db.Column(db.DateTime(timezone=True))
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))

    user = db.relationship("User", foreign_keys=[user_id])
    community = db.relationship("Community")
