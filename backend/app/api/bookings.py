"""Paid mentor sessions (Module 10): hold a slot, pay with Razorpay, confirm.

    POST /bookings                       hold a slot for HOLD and open a Razorpay order
    POST /bookings/<id>/verify           Checkout's success callback: check the signature, confirm
    POST /payments/razorpay/webhook      the same confirmation from Razorpay (browser closed early)
    GET  /bookings                       my sessions
    POST /bookings/<id>/cancel           free cancellation until FREE_CANCEL before, fully refunded
    POST /bookings/<id>/review           rate a session after it happened
"""
import secrets
from datetime import timedelta
from zoneinfo import ZoneInfo

from flask import Blueprint, abort, current_app, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from ..extensions import db, limiter
from ..models import AvailabilitySlot, Booking, MentorProfile, MentorReview, Payment
from ..models.base import utcnow
from ..services import availability, mailer, payments
from . import serializers as s

bp = Blueprint("bookings", __name__)

HOLD = timedelta(minutes=15)
FREE_CANCEL = timedelta(hours=24)
TAKEN = "Someone has just booked this time. Pick another one."


def _body():
    return request.get_json(silent=True) or {}


def _member():
    if current_user.status != "active":
        abort(403, "Finish verifying your account to book a session.")


def _mine(booking_id):
    b = db.session.get(Booking, booking_id)
    if not b or b.student_id != current_user.id:
        abort(404, "We could not find that booking.")
    return b


def _checkout(b):
    """What the browser needs to open Razorpay Checkout for this booking."""
    m, p = b.mentor, b.payment
    return {"key": payments.key_id(), "orderId": p.razorpay_order_id, "amount": p.amount_minor,
            "currency": p.currency, "name": "The Youth Matters",
            "description": f"{m.session_minutes} min session with {m.user.display_name}",
            "prefill": {"name": current_user.display_name, "email": current_user.email}}


def _when(b, tz_name):
    start = b.slot.starts_at.astimezone(ZoneInfo(tz_name or "UTC"))
    return f"{start:%A} {start.day} {start:%B %Y}, {start:%H:%M} ({tz_name or 'UTC'})"


def _email_confirmation(b):
    m = b.mentor
    topic = f"<p>What {b.student.display_name} wants to cover:<br>{b.topic}</p>" if b.topic else ""
    mailer.send(b.student.email, f"Booked: your session with {m.user.display_name}",
                f"<p>You are booked with {m.user.display_name} on {_when(b, b.student_timezone)}.</p>"
                f"<p>Join here at the time: {b.meeting_url}</p>"
                f"<p>Need to change plans? Cancel from My TYM up to 24 hours before for a full refund.</p>")
    mailer.send(m.user.email, f"New session: {b.student.display_name}",
                f"<p>{b.student.display_name} booked a {m.session_minutes} minute session on "
                f"{_when(b, m.timezone)}.</p>{topic}<p>Meeting link: {b.meeting_url}</p>")


def confirm(payment, razorpay_payment_id):
    """Mark a payment paid and its booking confirmed. Idempotent: Checkout and the webhook both call it.
    If the hold ran out and someone else took the slot meanwhile, the money goes straight back."""
    if payment.status in ("paid", "refunded"):
        return
    payment.status, payment.razorpay_payment_id = "paid", razorpay_payment_id
    b = payment.booking
    try:
        with db.session.begin_nested():
            b.status = "confirmed"
            b.meeting_url = f"https://meet.jit.si/TYM-{secrets.token_urlsafe(10)}"
    except IntegrityError:  # the partial unique index: another active booking holds this slot
        refund = payments.refund(razorpay_payment_id, payment.amount_minor)
        payment.status, payment.razorpay_refund_id = "refunded", refund["id"]
        b.status, b.note = "cancelled", "The time was taken while the payment was pending. Refunded in full."
        return
    db.session.flush()
    payment.invoice_number = f"TYM-{utcnow():%Y}-{payment.id:06d}"
    try:
        _email_confirmation(b)
    except Exception:  # a mail outage must never undo a paid booking
        current_app.logger.exception("Booking %s confirmed but the emails failed", b.id)


@bp.post("/bookings")
@jwt_required()
@limiter.limit("30 per hour")
def create():
    _member()
    if not payments.configured():
        abort(503, "Payments are not switched on yet. Please try again soon.")
    data = _body()
    slot_id = data.get("slotId")
    slot = db.session.get(AvailabilitySlot, slot_id, with_for_update=True) if isinstance(slot_id, int) else None
    if not slot or slot.starts_at < utcnow() + availability.MIN_NOTICE:
        abort(409, "That time is no longer available. Pick another one.")
    mentor = db.session.get(MentorProfile, slot.mentor_id)
    if mentor.user_id == current_user.id:
        abort(400, "You cannot book a session with yourself.")

    # Came back to the same time after closing Checkout: reuse the hold and the order
    mine = db.session.scalar(db.select(Booking).where(
        Booking.slot_id == slot.id, Booking.student_id == current_user.id,
        Booking.status == "pending_payment", Booking.hold_expires_at > utcnow()))
    if mine:
        return jsonify(booking=s.booking(mine), checkout=_checkout(mine))

    # Holds that ran out no longer count, so the slot can be taken again
    db.session.execute(update(Booking).where(
        Booking.slot_id == slot.id, Booking.status == "pending_payment",
        Booking.hold_expires_at <= utcnow()).values(status="expired"))
    b = Booking(slot=slot, mentor=mentor, student=current_user, hold_expires_at=utcnow() + HOLD,
                topic=str(data.get("topic") or "").strip()[:1000] or None,
                student_timezone=str(data.get("timezone") or "")[:64] or None)
    db.session.add(b)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        abort(409, TAKEN)

    try:
        order = payments.create_order(mentor.price_minor, mentor.currency, receipt=f"booking-{b.id}",
                                      notes={"booking_id": str(b.id), "mentor": mentor.user.display_name})
    except payments.PaymentError:
        db.session.rollback()
        abort(502, "We could not reach the payment provider. Try again in a moment.")
    db.session.add(Payment(user_id=current_user.id, booking=b, kind="session", amount_minor=mentor.price_minor,
                           currency=mentor.currency, razorpay_order_id=order["id"]))
    db.session.commit()
    return jsonify(booking=s.booking(b), checkout=_checkout(b)), 201


@bp.post("/bookings/<int:booking_id>/verify")
@jwt_required()
@limiter.limit("30 per hour")
def verify(booking_id):
    b = _mine(booking_id)
    data = _body()
    order_id, payment_id = data.get("razorpay_order_id"), data.get("razorpay_payment_id")
    if not b.payment or order_id != b.payment.razorpay_order_id or not payments.valid_payment(
            order_id, payment_id, data.get("razorpay_signature")):
        abort(400, "We could not confirm this payment. If money left your account, write to "
                   "support@theyouthmatters.org with your payment ID and we will sort it out.")
    try:
        confirm(b.payment, payment_id)
    except payments.PaymentError:
        abort(502, "Your payment went through, but we could not finish the booking. Our team has been "
                   "alerted and will confirm or refund it within a day.")
    db.session.commit()
    return jsonify(booking=s.booking(b))


@bp.post("/payments/razorpay/webhook")
@limiter.exempt
def webhook():
    if not payments.valid_webhook(request.get_data(), request.headers.get("X-Razorpay-Signature")):
        abort(400, "Invalid signature.")
    event = request.get_json(silent=True) or {}
    if event.get("event") in ("payment.captured", "order.paid"):
        entity = event["payload"]["payment"]["entity"]
        payment = db.session.scalar(db.select(Payment).where(Payment.razorpay_order_id == entity["order_id"]))
        if payment:
            confirm(payment, entity["id"])
            db.session.commit()
    return jsonify(ok=True)


@bp.get("/bookings")
@jwt_required()
def mine():
    rows = db.session.scalars(
        db.select(Booking).join(AvailabilitySlot)
        .where(Booking.student_id == current_user.id, Booking.status.in_(("confirmed", "cancelled")))
        .order_by(AvailabilitySlot.starts_at.desc())).all()
    return jsonify([s.booking(b) for b in rows])


@bp.post("/bookings/<int:booking_id>/cancel")
@jwt_required()
@limiter.limit("20 per hour")
def cancel(booking_id):
    b = _mine(booking_id)
    if b.status == "pending_payment":
        b.status = "cancelled"
        db.session.commit()
        return jsonify(booking=s.booking(b))
    if b.status != "confirmed" or b.slot.starts_at <= utcnow():
        abort(409, "This session can no longer be cancelled.")
    if b.slot.starts_at - utcnow() < FREE_CANCEL:
        abort(409, "Sessions can be cancelled up to 24 hours before they start. "
                   "If something urgent came up, write to support@theyouthmatters.org.")
    try:
        refund = payments.refund(b.payment.razorpay_payment_id, b.payment.amount_minor)
    except payments.PaymentError:
        abort(502, "We could not start the refund just now. Try again in a few minutes.")
    b.payment.status, b.payment.razorpay_refund_id = "refunded", refund["id"]
    b.status = "cancelled"
    db.session.commit()
    mailer.send(b.mentor.user.email, f"Cancelled: session with {current_user.display_name}",
                f"<p>{current_user.display_name} cancelled the session on {_when(b, b.mentor.timezone)}. "
                "The time is open for booking again.</p>")
    return jsonify(booking=s.booking(b))


@bp.post("/bookings/<int:booking_id>/review")
@jwt_required()
@limiter.limit("20 per hour")
def review(booking_id):
    b = _mine(booking_id)
    if b.status != "confirmed" or b.slot.ends_at > utcnow():
        abort(409, "You can review a session once it has happened.")
    if b.review:
        abort(409, "You have already reviewed this session.")
    data = _body()
    rating, body = data.get("rating"), str(data.get("body") or "").strip()
    if rating not in (1, 2, 3, 4, 5) or not 10 <= len(body) <= 1000:
        abort(400, "Choose a rating and write a few words (10 to 1000 characters).")
    db.session.add(MentorReview(mentor_id=b.mentor_id, booking=b, author=current_user, rating=rating, body=body))
    db.session.commit()
    return jsonify(booking=s.booking(b)), 201
