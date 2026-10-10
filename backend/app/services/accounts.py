"""Closing an account for good: the member's own "delete my account" (api/users.py) and the team's
(api/admin.py) both end up here.

Two ways out, because money has to stay on the books:
  erase()  nothing financial on the account: the row and everything hanging off it are deleted.
  close()  sessions or payments exist: those records are kept, and every personal thing on the
           account is wiped. The account is marked "closed" and cannot be signed into again.
Either way the person is gone from the site: nothing of theirs is left to read.
"""
from ..extensions import db
from ..models import (BlogPost, Booking, Comment, IdentityVerification, MentorApplication, MentorMessage,
                      MentorProfile, MentorReview, MentorThread, Payment, Post, Report, User, Vote)
from ..models.base import utcnow
from . import storage

MEDIA = "/api/media/"


def _count(*where):
    return db.session.scalar(db.select(db.func.count()).where(*where)) or 0


def has_records(u):
    """True when sessions or payments are attached, so the account cannot simply be deleted."""
    mentor_id = db.session.scalar(db.select(MentorProfile.id).where(MentorProfile.user_id == u.id))
    return bool(_count(Booking.student_id == u.id) or _count(Payment.user_id == u.id)
                or (mentor_id and _count(Booking.mentor_id == mentor_id)))


def _pictures(u):
    """Storage keys for their photos, to delete once the database work has gone through."""
    return [url[len(MEDIA):] for url in (u.avatar_url, u.cover_url) if url and url.startswith(MEDIA)]


def erase(u, blog_author_id):
    """Delete the account and everything it posted. Returns the stored files to remove after the
    commit: nothing is deleted from storage until the database agrees it is gone."""
    # Their votes come off the tallies, and questions they answered are recounted once the answers are gone
    for model, kind in ((Post, "post"), (Comment, "comment")):
        for value, tally in ((1, model.upvotes), (-1, model.downvotes)):
            voted = db.select(Vote.target_id).where(Vote.user_id == u.id, Vote.target_type == kind, Vote.value == value)
            db.session.execute(db.update(model).where(model.id.in_(voted))
                               .values({tally: tally - 1, model.score: model.score - value}))
    answered = db.session.scalars(db.select(Comment.post_id).where(Comment.author_id == u.id).distinct()).all()
    files = [key for keys in db.session.execute(
        db.select(MentorApplication.cv_key, MentorApplication.proof_key).where(MentorApplication.user_id == u.id))
        for key in keys] + _pictures(u)
    # Only someone who was once on the team has these: their decisions stay, without a name on them
    for model, column in ((MentorApplication, MentorApplication.reviewed_by_id), (Report, Report.resolved_by_id),
                          (IdentityVerification, IdentityVerification.reviewed_by_id)):
        db.session.execute(db.update(model).where(column == u.id).values({column: None}))
    if blog_author_id:  # the team keeps the articles, under the name of whoever deleted the account
        db.session.execute(db.update(BlogPost).where(BlogPost.author_id == u.id).values(author_id=blog_author_id))
    else:  # a member closing their own account: what they wrote goes with them
        files += [key for key in db.session.scalars(
            db.select(BlogPost.cover_key).where(BlogPost.author_id == u.id)) if key]
        db.session.execute(db.delete(BlogPost).where(BlogPost.author_id == u.id))
    db.session.execute(db.delete(MentorReview).where(MentorReview.author_id == u.id))

    db.session.execute(db.delete(User).where(User.id == u.id))  # the database removes what hangs off the account
    live = db.select(db.func.count(Comment.id)).where(Comment.post_id == Post.id, ~Comment.is_deleted).scalar_subquery()
    db.session.execute(db.update(Post).where(Post.id.in_(answered)).values(comment_count=live))
    return files


def close(u):
    """Keep the row, because sessions and payments point at it, and wipe the person off it.
    Their questions and answers come down with them. Returns files to remove after the commit."""
    files = _pictures(u)
    # Their private chats go, both as a student and as a mentor: nothing of theirs is left to read
    mentor_id = db.session.scalar(db.select(MentorProfile.id).where(MentorProfile.user_id == u.id))
    for model in (MentorMessage, MentorThread):
        where = model.student_id == u.id
        db.session.execute(db.delete(model).where(db.or_(where, model.mentor_id == mentor_id) if mentor_id else where))
    answered = db.session.scalars(db.select(Comment.post_id).where(Comment.author_id == u.id).distinct()).all()
    for model in (Post, Comment):
        db.session.execute(db.update(model).where(model.author_id == u.id, ~model.is_deleted)
                           .values(is_deleted=True))
    live = db.select(db.func.count(Comment.id)).where(Comment.post_id == Post.id, ~Comment.is_deleted).scalar_subquery()
    db.session.execute(db.update(Post).where(Post.id.in_(answered)).values(comment_count=live))
    db.session.execute(db.delete(MentorReview).where(MentorReview.author_id == u.id))

    u.email = f"deleted-{u.id}@deleted.invalid"
    u.username = f"deleted{u.id}"
    u.display_name = "Deleted member"
    u.password_hash = u.google_id = None
    u.avatar_url = u.cover_url = u.bio = None
    u.date_of_birth = u.study_level = u.university = u.course = u.intake = None
    u.target_country_id = None
    u.email_code_hash = u.email_code_expires_at = None
    u.email_verified = False
    u.status = "closed"
    u.tokens_valid_after = utcnow()  # every device signed in as them stops working
    return files


def remove_files(keys):
    for key in keys:
        storage.delete(key)
