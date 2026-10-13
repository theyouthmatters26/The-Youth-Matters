"""Contact form: every message is kept for the inbox in the admin panel, emailed to the team, and
acknowledged to the sender so they know it arrived. The sender's address goes in Reply-To, so the
team can answer straight from their inbox."""
from flask import Blueprint, abort, current_app, jsonify, request
from markupsafe import escape

from ..extensions import db, limiter
from ..models import ContactMessage
from ..services import mailer
from .auth import EMAIL

bp = Blueprint("contact", __name__)

TOPICS = ("My account", "Mentor application", "Mentorship session", "Partnerships", "Payments",
          "Safety", "Something else")

# What the sender gets back. A booking is the one the wait matters for, so it says what happens next.
ACK = {"Mentorship session": (
    "We have your session request",
    "<p>Thanks {name}, we have your mentorship session request.</p>"
    "<p>Our team is matching you with the mentor who fits your plans. We will email you and message "
    "you on WhatsApp with your mentor and a confirmed time, usually within a day.</p>"
    "<p>Your session is not confirmed until that confirmation reaches you.</p>")}
DEFAULT_ACK = ("We have your message",
               "<p>Thanks {name}, your message reached our team and we will reply within a day.</p>")


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
    rows = "".join(f"<p><b>{escape(str(k))[:60]}:</b> {escape(str(v))[:500]}</p>" for k, v in list(details.items())[:30])
    kept = {str(k)[:60]: str(v)[:500] for k, v in list(details.items())[:30]}
    db.session.add(ContactMessage(name=name, email=email.lower(), topic=topic, message=message, details=kept or None))
    db.session.commit()
    mailer.send_quietly(current_app.config["CONTACT_EMAIL"], f"[{topic}] {name}",
                f"<p>From {escape(name)} &lt;{escape(email)}&gt;</p>{rows}<p>{escape(message)}</p>", reply_to=email)
    subject, body = ACK.get(topic, DEFAULT_ACK)
    mailer.send_quietly(email, subject, body.format(name=escape(name.split()[0])),
                        reply_to=current_app.config["CONTACT_EMAIL"])
    return jsonify(ok=True)
