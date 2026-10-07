"""Razorpay through its REST API (no SDK needed): orders, signature checks and refunds.

Flow: create an order on our server -> the browser opens Razorpay Checkout with it -> Checkout
returns order_id, payment_id and a signature -> we check the signature with our secret before
confirming anything. The webhook confirms the same payment if the browser never comes back.
"""
import hashlib
import hmac

import requests
from flask import current_app

API = "https://api.razorpay.com/v1"


class PaymentError(Exception):
    pass


def configured():
    cfg = current_app.config
    return bool(cfg["RAZORPAY_KEY_ID"] and cfg["RAZORPAY_KEY_SECRET"])


def key_id():
    return current_app.config["RAZORPAY_KEY_ID"]


def _call(method, path, payload):
    cfg = current_app.config
    try:
        res = requests.request(method, f"{API}{path}", json=payload, timeout=15,
                               auth=(cfg["RAZORPAY_KEY_ID"], cfg["RAZORPAY_KEY_SECRET"]))
    except requests.RequestException as e:
        raise PaymentError(str(e)) from e
    if not res.ok:
        current_app.logger.error("Razorpay %s %s failed: %s", method, path, res.text[:500])
        raise PaymentError(res.text)
    return res.json()


def create_order(amount_minor, currency, receipt, notes):
    return _call("POST", "/orders", {"amount": amount_minor, "currency": currency,
                                     "receipt": receipt, "notes": notes})


def refund(payment_id, amount_minor):
    return _call("POST", f"/payments/{payment_id}/refund", {"amount": amount_minor, "speed": "normal"})


def _signed(secret, message: bytes):
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def valid_payment(order_id, payment_id, signature):
    """Checkout's success signature: HMAC-SHA256 of "order_id|payment_id" with our key secret."""
    expected = _signed(current_app.config["RAZORPAY_KEY_SECRET"], f"{order_id}|{payment_id}".encode())
    return isinstance(signature, str) and hmac.compare_digest(expected, signature)


def valid_webhook(body: bytes, signature):
    """Webhook signature: HMAC-SHA256 of the raw request body with the webhook secret."""
    secret = current_app.config["RAZORPAY_WEBHOOK_SECRET"]
    return bool(secret) and hmac.compare_digest(_signed(secret, body), signature or "")
