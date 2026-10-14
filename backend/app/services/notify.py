"""Notifications: the bell on every page, and an email for the few that are worth an inbox.

The bell row is written straight away. The email waits: notify() only queues it, and send_pending()
sends once the request has committed, so nothing is emailed about an answer that never saved.

Only an answer to your own question, a direct reply and an @mention are emailed. Votes and the rest
stay on the bell: a mail per upvote is how a community teaches people to filter it out. The switch
in Profile settings is the way out; there is no clever guessing about who is "probably still here".

One email per run, not one per event: while an emailed notification sits unread, the next one only
reaches the bell. Reading the bell starts the next run, so a busy thread cannot fill an inbox.
"""
from flask import g
from markupsafe import escape

from ..extensions import db
from ..models import Notification, User
from . import mailer

# The three worth leaving the site for
EMAILED = ("answer", "reply", "mention")
LINE = {"answer": "answered your question", "reply": "replied to you", "mention": "mentioned you"}


def notify(user_id, actor, kind, post=None, comment=None, message=None):
    if not user_id or (actor and actor.id == user_id):
        return
    db.session.add(Notification(user_id=user_id, actor_id=actor.id if actor else None, kind=kind,
                                post_id=post.id if post else None,
                                comment_id=comment.id if comment else None,
                                message=message[:255] if message else None))
    if kind in EMAILED and post is not None and not _waiting(user_id):
        g.setdefault("pending_notices", []).append({
            "user_id": user_id, "kind": kind,
            "actor": actor.display_name if actor else "Someone",
            "post_id": post.id, "title": post.title,
            "excerpt": (comment.body if comment else "")[:280],
        })


def _waiting(user_id):
    """True if something we already emailed them about is still unread: the run has started."""
    with db.session.no_autoflush:  # the rows this request queued must not count as waiting
        return db.session.scalar(db.select(db.exists().where(
            Notification.user_id == user_id, Notification.kind.in_(EMAILED), ~Notification.is_read)))


def notify_mentions(usernames, actor, post, comment=None, already=()):
    """@username in a post or answer. Skips people who already get a notification for it."""
    if not usernames:
        return
    for user in db.session.scalars(db.select(User).where(db.func.lower(User.username).in_(usernames))):
        if user.id not in already:
            notify(user.id, actor, "mention", post, comment)


def _email(person, notice, link, home):
    first = escape(person.display_name.split()[0]) if person.display_name else "there"
    excerpt = (f"<blockquote style='margin:16px 0;padding:0 0 0 14px;border-left:3px solid #e5e5e5;color:#444'>"
               f"{escape(notice['excerpt'])}</blockquote>") if notice["excerpt"] else ""
    button = ("display:inline-block;padding:11px 20px;border-radius:999px;"
              "background:#09090a;color:#fff;text-decoration:none;font-weight:500")
    return (f"<p>Hi {first},</p>"
            f"<p><strong>{escape(notice['actor'])}</strong> {LINE[notice['kind']]} on "
            f"<strong>{escape(notice['title'])}</strong>.</p>"
            f"{excerpt}"
            f"<p><a href='{link}' style='{button}'>Read the reply</a></p>"
            f"<p>Or open the website: <a href='{home}'>{escape(home.split('//')[-1])}</a></p>"
            f"<hr style='border:0;border-top:1px solid #eee;margin:24px 0'>"
            f"<p style='font-size:12px;color:#777'>You get these because email notifications are on. "
            f"<a href='{home}/settings' style='color:#777'>Turn them off in Profile settings</a>.</p>")


def send_pending():
    """Send what this request queued. Call it after the commit, never before."""
    notices = g.pop("pending_notices", None)
    if not notices:
        return
    from .handoff import site_url  # here, not at the top: handoff imports this module

    people = {u.id: u for u in db.session.scalars(
        db.select(User).where(User.id.in_({n["user_id"] for n in notices})))}
    for notice in notices:
        person = people.get(notice["user_id"])
        if not person or not person.notify_email or person.status != "active":
            continue
        home = site_url()
        mailer.send_quietly(person.email, f"{notice['actor']} {LINE[notice['kind']]}",
                            _email(person, notice, f"{home}/p/{notice['post_id']}", home))
