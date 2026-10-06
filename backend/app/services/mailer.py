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
