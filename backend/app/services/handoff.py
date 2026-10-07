"""A person from the team stepping into an Ask TYM AI conversation.

    ai       TYMAi answers.
    waiting  The student asked for a person. TYMAi keeps answering so they are not left stuck.
    human    A team member is in the conversation. TYMAi stays quiet until it is handed back.

Both sides hear about it by email (Resend): the team when a student is waiting, the student when a
person replies. Emails are held to one per conversation every ALERT_EVERY so a chat is not a flood.
"""
from datetime import timedelta

from flask import current_app, request
from markupsafe import escape

from ..extensions import db
from ..models import AiMessage, User
from ..models.base import utcnow
from . import mailer, staff

ALERT_EVERY = timedelta(minutes=10)


def add_message(conversation, role, content, author=None, sources=None):
    m = AiMessage(conversation_id=conversation.id, role=role, content=content, sources=sources,
                  author_id=author.id if author else None)
    db.session.add(m)
    conversation.last_message_at, conversation.last_role = utcnow(), role
    conversation.last_preview = " ".join(content.split())[:160]
    return m


def message_json(m):
    data = {"id": m.id, "role": m.role, "content": m.content, "sources": m.sources or [],
            "createdAt": m.created_at.isoformat()}
    if m.role == "human":
        data["author"] = {"name": m.author.display_name if m.author else "TYM team"}
    return data


def as_history(messages):
    """Earlier turns for Claude. What a team member said counts as an answer already given."""
    return [{"role": "user" if m.role == "user" else "assistant",
             "content": m.content if m.role != "human" else f"(A person from the TYM team replied:) {m.content}"}
            for m in messages]


def site_url():
    """Where links in emails point. Never taken from the request on a live site: whoever sends the
    request chooses its Origin and Host, and the link would go wherever they liked."""
    cfg = current_app.config
    if cfg["SITE_URL"]:
        return cfg["SITE_URL"]
    if current_app.debug:
        return (request.headers.get("Origin") or request.host_url).rstrip("/")
    return cfg["CORS_ORIGINS"][0].rstrip("/")


def support_team():
    admins = db.session.scalars(db.select(User).where(User.role == "admin", User.status == "active"))
    return [u for u in admins if staff.can(u, "support")]


def alert_team(conversation, heading):
    """Email everyone with support access that a student is waiting, at most once per ALERT_EVERY."""
    now = utcnow()
    if conversation.staff_alerted_at and now - conversation.staff_alerted_at < ALERT_EVERY:
        return
    conversation.staff_alerted_at = now
    student = conversation.user
    link = f"{site_url()}/admin/support?c={conversation.id}"
    html = (f"<p><b>{escape(student.display_name)}</b> ({escape(student.email)}) {escape(heading)}.</p>"
            f"<p><b>{escape(conversation.title)}</b></p>"
            f"<blockquote>{escape(conversation.last_preview or '')}</blockquote>"
            f"<p><a href='{link}'>Open the conversation</a></p>")
    for member in support_team():
        mailer.send_quietly(member.email, f"A student is waiting: {conversation.title}", html, reply_to=student.email)


def tell_student(conversation, member, text):
    """Email the student that a person replied, unless one went out in the last ALERT_EVERY."""
    student = conversation.user
    earlier = db.session.scalar(
        db.select(AiMessage.created_at).where(AiMessage.conversation_id == conversation.id, AiMessage.role == "human")
        .order_by(AiMessage.id.desc()).limit(1))
    conversation.user_unread = True
    if earlier and utcnow() - earlier < ALERT_EVERY:
        return
    first = member.display_name.split()[0]
    excerpt = text if len(text) <= 400 else text[:400].rsplit(" ", 1)[0] + "..."
    link = f"{site_url()}/ai?c={conversation.id}"
    mailer.send_quietly(
        student.email, f"{first} from The Youth Matters replied to you",
        f"<p>Hi {escape(student.display_name.split()[0])},</p>"
        f"<p>{escape(first)} from our team replied in your conversation \"{escape(conversation.title)}\":</p>"
        f"<blockquote>{escape(excerpt)}</blockquote>"
        f"<p><a href='{link}'>Read and reply</a></p>")
