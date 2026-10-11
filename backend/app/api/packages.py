"""Counselling hours: fixed packages bought with Cashfree and spent on sessions with any mentor.

    GET  /packages                        what is on sale
    POST /packages/<id>/order             open a Cashfree order for one
    POST /packages/payments/<id>/verify   after checkout: ask Cashfree whether it was paid, add the hours
    POST /payments/cashfree/webhook       the same from Cashfree (the browser closed early)

Nothing the browser reports is believed. Both routes ask Cashfree for the order's status and only
"PAID" adds hours, so a forged callback buys nothing.

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


def credit(payment, gateway_payment_id):
    """Mark a package payment paid and add its hours. True when this call did it. Checkout and two
    webhooks can arrive in the same second: one statement claims the payment, and only the call that
    changed the row adds the hours, so they are added once."""
    claimed = db.session.execute(update(Payment).where(Payment.id == payment.id, Payment.status == "created")
                                 .values(status="paid", gateway_payment_id=gateway_payment_id)).rowcount
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
    order_id = f"tym-{pay.id}"  # ours, and unique: Cashfree allows letters, numbers, _ and -
    try:
        created = payments.create_order(
            order_id, p.price_minor, p.currency,
            customer={"id": current_user.id, "name": current_user.display_name, "email": current_user.email},
            note=f"{p.title}: {hours_text(pay.minutes)} of counselling")
    except payments.PaymentError:
        db.session.rollback()
        abort(502, "We could not reach the payment provider. Try again in a moment.")
    pay.gateway_order_id = created["order_id"]
    db.session.commit()
    return jsonify(paymentId=pay.id, checkout={
        "paymentSessionId": created["payment_session_id"], "mode": payments.mode(),
        "orderId": pay.gateway_order_id, "amount": pay.amount_minor, "currency": pay.currency,
        "description": f"{p.title}: {hours_text(pay.minutes)} of counselling"}), 201


def _settle(pay, gateway_payment_id):
    """Ask Cashfree whether this order was paid, and if so add the hours once. True when they went on."""
    try:
        if payments.order_status(pay.gateway_order_id) != "PAID":
            return None
    except payments.PaymentError:
        return False
    credited = credit(pay, gateway_payment_id or pay.gateway_order_id)
    db.session.commit()
    if credited:
        _receipt(pay)
    return True


@bp.post("/packages/payments/<int:payment_id>/verify")
@jwt_required()
@limiter.limit("30 per hour")
def verify(payment_id):
    """Checkout has closed. Cashfree hands the browser no signature to pass on, so the only thing
    worth believing is Cashfree's own answer, asked for here."""
    pay = db.session.get(Payment, payment_id)
    if not pay or pay.user_id != current_user.id or pay.kind != "package":
        abort(404, "We could not find that payment.")
    settled = _settle(pay, (request.get_json(silent=True) or {}).get("cfPaymentId"))
    if settled is False:
        abort(502, "We could not reach the payment provider to confirm this. Your hours will appear "
                   "shortly; write to support@theyouthmatters.com if they do not.")
    if settled is None:
        abort(400, "This payment has not gone through. If money left your account, write to "
                   "support@theyouthmatters.com with your payment ID and we will sort it out.")
    db.session.refresh(current_user)
    return jsonify(counselingMinutes=current_user.counseling_minutes, invoiceNumber=pay.invoice_number)


@bp.post("/payments/cashfree/webhook")
@limiter.exempt
def webhook():
    """Cashfree signs the timestamp and the raw body with our secret key (services/payments.py)."""
    if not payments.valid_webhook(request.headers.get("x-webhook-timestamp"), request.get_data(),
                                  request.headers.get("x-webhook-signature")):
        abort(400, "Invalid signature.")
    event = request.get_json(silent=True) or {}
    if event.get("type") == "PAYMENT_SUCCESS_WEBHOOK":
        data = event.get("data") or {}
        order_id = (data.get("order") or {}).get("order_id")
        pay = db.session.scalar(db.select(Payment).where(Payment.gateway_order_id == order_id)) if order_id else None
        if pay and pay.kind == "package":
            # The payload is only a nudge: _settle asks Cashfree what really happened
            _settle(pay, str((data.get("payment") or {}).get("cf_payment_id") or "") or None)
    return jsonify(ok=True)
