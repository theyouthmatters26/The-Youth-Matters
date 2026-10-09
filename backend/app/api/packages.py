"""Counselling hours: fixed packages bought with Razorpay and spent on sessions with any mentor.

    GET  /packages                        what is on sale
    POST /packages/<id>/order             open a Razorpay order for one
    POST /packages/payments/<id>/verify   Checkout's success callback: check the signature, add the hours
    POST /payments/razorpay/webhook       the same from Razorpay (the browser closed early)

Hours are kept as whole minutes on the member (User.counseling_minutes). Buying adds them here;
booking takes them and a cancellation in time gives them back (api/bookings.py).
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from markupsafe import escape
from sqlalchemy import update

from ..extensions import db, limiter
from ..models import CounselingPackage, Payment, User
from ..models.base import utcnow
from ..services import mailer, payments
from . import serializers as s

bp = Blueprint("packages", __name__)


def hours_text(minutes):
    """90 -> '1.5 hours', 60 -> '1 hour', 30 -> '30 minutes'."""
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes / 60
    return f"{hours:g} hour{'' if hours == 1 else 's'}"


def add_minutes(user_id, minutes):
    """Change a balance in one statement, so two things happening at once cannot lose either."""
    db.session.execute(update(User).where(User.id == user_id)
                       .values(counseling_minutes=User.counseling_minutes + minutes))


def take_minutes(user_id, minutes):
    """Spend from a balance. False when there is not enough: the check and the change are one statement,
    so two bookings at the same moment cannot both spend the last hour."""
    return bool(db.session.execute(
        update(User).where(User.id == user_id, User.counseling_minutes >= minutes)
        .values(counseling_minutes=User.counseling_minutes - minutes)).rowcount)


def credit(payment, razorpay_payment_id):
    """Mark a package payment paid and add its hours. True when this call did it. Checkout and two
    webhooks can arrive in the same second: one statement claims the payment, and only the call that
    changed the row adds the hours, so they are added once."""
    claimed = db.session.execute(update(Payment).where(Payment.id == payment.id, Payment.status == "created")
                                 .values(status="paid", razorpay_payment_id=razorpay_payment_id)).rowcount
    if not claimed:
        return False
    add_minutes(payment.user_id, payment.minutes)
    db.session.refresh(payment)
    payment.invoice_number = f"TYM-{utcnow():%Y}-{payment.id:06d}"
    return True


def _receipt(payment):
    member = db.session.get(User, payment.user_id)
    mailer.send_quietly(member.email, f"Receipt {payment.invoice_number}: {hours_text(payment.minutes)} of counselling",
                        f"<p>Hi {escape(member.display_name.split()[0])},</p>"
                        f"<p>Thank you. {hours_text(payment.minutes)} of counselling have been added to your account. "
                        f"You now have {hours_text(member.counseling_minutes)} to book with any TYM mentor.</p>"
                        f"<p>Amount paid: {payment.currency} {payment.amount_minor / 100:.2f}<br>Receipt: {payment.invoice_number}</p>")


@bp.get("/packages")
def list_packages():
    rows = db.session.scalars(db.select(CounselingPackage).where(CounselingPackage.is_active)
                              .order_by(CounselingPackage.sort_order, CounselingPackage.hours))
    return jsonify([s.package(p) for p in rows])


@bp.post("/packages/<int:package_id>/order")
@jwt_required()
@limiter.limit("30 per hour")
def order(package_id):
    if current_user.status != "active":
        abort(403, "Finish verifying your account to buy counselling hours.")
    if not payments.configured():
        abort(503, "Payments are not switched on yet. Please try again soon.")
    p = db.session.get(CounselingPackage, package_id)
    if not p or not p.is_active:
        abort(404, "That package is no longer on sale. Reload the page to see the current ones.")
    pay = Payment(user_id=current_user.id, kind="package", package=p, minutes=p.hours * 60,
                  amount_minor=p.price_minor, currency=p.currency)
    db.session.add(pay)
    db.session.flush()
    try:
        created = payments.create_order(p.price_minor, p.currency, receipt=f"package-{pay.id}",
                                        notes={"payment_id": str(pay.id), "package": p.title})
    except payments.PaymentError:
        db.session.rollback()
        abort(502, "We could not reach the payment provider. Try again in a moment.")
    pay.razorpay_order_id = created["id"]
    db.session.commit()
    return jsonify(paymentId=pay.id, checkout={
        "key": payments.key_id(), "orderId": pay.razorpay_order_id, "amount": pay.amount_minor, "currency": pay.currency,
        "name": "The Youth Matters", "description": f"{p.title}: {hours_text(pay.minutes)} of counselling",
        "prefill": {"name": current_user.display_name, "email": current_user.email}}), 201


@bp.post("/packages/payments/<int:payment_id>/verify")
@jwt_required()
@limiter.limit("30 per hour")
def verify(payment_id):
    pay = db.session.get(Payment, payment_id)
    if not pay or pay.user_id != current_user.id or pay.kind != "package":
        abort(404, "We could not find that payment.")
    data = request.get_json(silent=True) or {}
    order_id, rp_payment = data.get("razorpay_order_id"), data.get("razorpay_payment_id")
    if order_id != pay.razorpay_order_id or not payments.valid_payment(order_id, rp_payment, data.get("razorpay_signature")):
        abort(400, "We could not confirm this payment. If money left your account, write to "
                   "support@theyouthmatters.com with your payment ID and we will sort it out.")
    credited = credit(pay, rp_payment)
    db.session.commit()
    if credited:
        _receipt(pay)
    db.session.refresh(current_user)
    return jsonify(counselingMinutes=current_user.counseling_minutes, invoiceNumber=pay.invoice_number)


@bp.post("/payments/razorpay/webhook")
@limiter.exempt
def webhook():
    if not payments.valid_webhook(request.get_data(), request.headers.get("X-Razorpay-Signature")):
        abort(400, "Invalid signature.")
    event = request.get_json(silent=True) or {}
    if event.get("event") in ("payment.captured", "order.paid"):
        entity = event["payload"]["payment"]["entity"]
        pay = db.session.scalar(db.select(Payment).where(Payment.razorpay_order_id == entity["order_id"]))
        if pay and pay.kind == "package":
            credited = credit(pay, entity["id"])
            db.session.commit()
            if credited:
                _receipt(pay)
    return jsonify(ok=True)
