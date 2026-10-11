"""Cashfree Payment Gateway through its REST API (no SDK needed): orders, status and refunds.

Flow: create an order on our server -> the browser opens Cashfree Checkout with the payment session
it hands back -> when checkout finishes we ask Cashfree what the order's status is. Nothing the
browser says is trusted: "paid" only ever comes from asking Cashfree ourselves. The webhook asks the
same question if the browser never comes back.

Amounts are kept in minor units everywhere on our side (paise). Cashfree works in rupees, so the
two conversions live here and nowhere else.
"""
import base64
import hashlib
import hmac

import requests
from flask import current_app

LIVE = "https://api.cashfree.com/pg"
SANDBOX = "https://sandbox.cashfree.com/pg"
API_VERSION = "2026-01-01"
# Cashfree insists on a 10-digit number and we do not ask students for one.
# ponytail: a real number only matters for Cashfree's own SMS receipts; collect one at checkout if that is wanted.
NO_PHONE = "9999999999"


class PaymentError(Exception):
    pass


def configured():
    cfg = current_app.config
    return bool(cfg["CASHFREE_APP_ID"] and cfg["CASHFREE_SECRET_KEY"])


def live():
    return current_app.config["CASHFREE_ENV"] == "production"


def mode():
    """What the browser's Cashfree SDK is opened with."""
    return "production" if live() else "sandbox"


def _call(method, path, payload=None):
    cfg = current_app.config
    headers = {"x-api-version": API_VERSION, "x-client-id": cfg["CASHFREE_APP_ID"],
               "x-client-secret": cfg["CASHFREE_SECRET_KEY"], "Content-Type": "application/json"}
    try:
        res = requests.request(method, f"{LIVE if live() else SANDBOX}{path}", json=payload,
                               headers=headers, timeout=15)
    except requests.RequestException as e:
        raise PaymentError(str(e)) from e
    if not res.ok:
        current_app.logger.error("Cashfree %s %s failed: %s", method, path, res.text[:500])
        raise PaymentError(res.text)
    return res.json()


def rupees(amount_minor):
    """Paise to the rupees Cashfree wants, to two decimals: 85000 -> 850.0"""
    return round(amount_minor / 100, 2)


def create_order(order_id, amount_minor, currency, customer, note=None):
    """customer: {"id", "name", "email", "phone"}. Returns Cashfree's order, with payment_session_id."""
    body = {
        "order_id": order_id,
        "order_amount": rupees(amount_minor),
        "order_currency": currency,
        "customer_details": {
            "customer_id": str(customer["id"]),
            "customer_name": customer.get("name") or "TYM member",
            "customer_email": customer["email"],
            "customer_phone": customer.get("phone") or NO_PHONE,
        },
    }
    if note:
        body["order_note"] = note[:200]
    return _call("POST", "/orders", body)


def order_status(order_id):
    """What Cashfree says about this order now: ACTIVE, PAID, EXPIRED, TERMINATED..."""
    return _call("GET", f"/orders/{order_id}").get("order_status")


def refund(order_id, amount_minor, refund_id):
    """Nothing calls this yet: money is refunded from the Cashfree dashboard, as it was before."""
    return _call("POST", f"/orders/{order_id}/refunds",
                 {"refund_amount": rupees(amount_minor), "refund_id": refund_id, "refund_speed": "STANDARD"})


def valid_webhook(timestamp, body: bytes, signature):
    """Cashfree signs the timestamp followed by the raw body with the secret key, base64 encoded.

    The body has to be the bytes that arrived: parsing the JSON first turns 170.00 into 170 and the
    signature stops matching."""
    secret = current_app.config["CASHFREE_SECRET_KEY"]
    if not (secret and timestamp and signature):
        return False
    digest = hmac.new(secret.encode(), f"{timestamp}".encode() + body, hashlib.sha256).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)
