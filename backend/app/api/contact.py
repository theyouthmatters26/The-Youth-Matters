"""Contact form: every message is kept for the inbox in the admin panel, and also emailed to the team.
The sender's address goes in Reply-To, so the team can answer straight from their inbox."""
from flask import Blueprint, abort, current_app, jsonify, request
from markupsafe import escape

from ..extensions import db, limiter
from ..models import ContactMessage
from ..services import mailer
from .auth import EMAIL

bp = Blueprint("contact", __name__)

TOPICS = ("My account", "Mentor application", "Partnerships", "Payments", "Safety", "Something else")


@bp.post("/contact")
@limiter.limit("5 per hour")
def contact():
    data = request.get_json(silent=True) or {}
    name, email, topic, message = (str(data.get(k) or "").strip() for k in ("name", "email", "topic", "message"))
    details = data.get("details") if isinstance(data.get("details"), dict) else {}
    if not 2 <= len(name) <= 80:
        abort(400, "Enter your name.")
    if not EMAIL.match(email):
        abort(400, "Enter a valid email address so we can reply.")
    if topic not in TOPICS:
        abort(400, "Choose a topic.")
    if not 10 <= len(message) <= 4000:
        abort(400, "Write a few words about what you need (10 to 4000 characters).")

    # Everything the visitor typed is escaped: this HTML goes into the team's inbox
    rows = "".join(f"<p><b>{escape(str(k))[:40]}:</b> {escape(str(v))[:300]}</p>" for k, v in list(details.items())[:12])
    kept = {str(k)[:40]: str(v)[:300] for k, v in list(details.items())[:12]}
    db.session.add(ContactMessage(name=name, email=email.lower(), topic=topic, message=message, details=kept or None))
    db.session.commit()
    mailer.send_quietly(current_app.config["CONTACT_EMAIL"], f"[{topic}] {name}",
                f"<p>From {escape(name)} &lt;{escape(email)}&gt;</p>{rows}<p>{escape(message)}</p>", reply_to=email)
    return jsonify(ok=True)
