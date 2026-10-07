"""Transactional email through Resend's HTTP API (OTP codes, booking confirmations, digests)."""
import requests
from flask import current_app


def send(to: str, subject: str, html: str, reply_to: str | None = None) -> None:
    key = current_app.config["RESEND_API_KEY"]
    if not key:
        current_app.logger.info("Email to %s skipped (no RESEND_API_KEY): %s", to, subject)
        return
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {key}"},
        json={"from": current_app.config["MAIL_FROM"], "to": [to], "subject": subject, "html": html,
              **({"reply_to": reply_to} if reply_to else {})},
        timeout=10,
    )
    resp.raise_for_status()


def send_quietly(to: str, subject: str, html: str, reply_to: str | None = None) -> None:
    """For notifications: a failed email is logged, it never fails the request that caused it."""
    try:
        send(to, subject, html, reply_to)
    except Exception as e:  # noqa: BLE001  any provider or network failure
        current_app.logger.warning("Email to %s failed (%s): %s", to, subject, e)
