"""In-app notifications. Never notifies people about their own actions."""
from ..extensions import db
from ..models import Notification, User


def notify(user_id, actor, kind, post=None, comment=None, message=None):
    if not user_id or (actor and actor.id == user_id):
        return
    db.session.add(Notification(user_id=user_id, actor_id=actor.id if actor else None, kind=kind,
                                post_id=post.id if post else None,
                                comment_id=comment.id if comment else None,
                                message=message[:255] if message else None))


def notify_mentions(usernames, actor, post, comment=None, already=()):
    """@username in a post or answer. Skips people who already get a notification for it."""
    if not usernames:
        return
    for user in db.session.scalars(db.select(User).where(db.func.lower(User.username).in_(usernames))):
        if user.id not in already:
            notify(user.id, actor, "mention", post, comment)
