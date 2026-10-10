"""Model -> JSON dicts. Kept in one place so every endpoint returns the same shapes."""
from ..models.base import utcnow


def user_brief(u):
    return {"id": u.id, "username": u.username, "displayName": u.display_name, "role": u.role,
            "avatar": u.avatar_url}


def me(u):
    """The signed-in account. verification is where sign-up is: document (photo ID still to do),
    verified, or review / rejected when a person has to look at it."""
    v = u.verification
    if u.status == "active":
        step = "verified"
    elif v and v.status in ("review", "rejected"):
        step = v.status
    else:
        step = "document"
    return {**user_brief(u), "email": u.email, "emailVerified": u.email_verified, "status": u.status,
            "verification": step, "dateOfBirth": u.date_of_birth.isoformat() if u.date_of_birth else None,
            "counselingMinutes": u.counseling_minutes or 0,
            # Google-only accounts have none, so the website knows not to ask for one
            "hasPassword": bool(u.password_hash)}


def subject(s):
    return {"id": s.id, "slug": s.slug, "name": s.name, "description": s.description,
            "isActive": s.is_active}


def community(c):
    return {
        "id": c.id,
        "subject": {"slug": c.subject.slug, "name": c.subject.name},
        "country": {"slug": c.country.slug, "name": c.country.name, "isoCode": c.country.iso_code,
                    # the photo the team uploaded, if there is one; the website falls back to its own
                    "image": media_url(c.country.image_key) if c.country.image_key else None},
        "description": c.description,
    }


def category(c):
    return {"id": c.id, "slug": c.slug, "name": c.name}


def _edited(obj):
    return bool(obj.updated_at and (obj.updated_at - obj.created_at).total_seconds() > 60)


def media_url(key):
    return f"/api/media/{key}"


def post(p, with_body=False, state=None):
    """state: the viewer's {"vote": -1|0|1, "saved": bool} for this post, when logged in."""
    state = state or {}
    data = {
        "id": p.id,
        "title": p.title,
        "excerpt": p.body[:280],
        "author": user_brief(p.author),
        "community": community(p.community),
        "category": category(p.category) if p.category else None,
        "images": [media_url(i.storage_key) for i in p.images],
        "score": p.score,
        "commentCount": p.comment_count,
        "hasHelpful": p.helpful_comment_id is not None,
        "isPinned": p.is_pinned,
        "edited": _edited(p),
        "createdAt": p.created_at.isoformat(),
        "myVote": state.get("vote", 0),
        "saved": state.get("saved", False),
    }
    if with_body:
        data["body"] = p.body
        data["helpfulCommentId"] = p.helpful_comment_id
    return data


def comment(c, my_vote=0):
    return {
        "id": c.id,
        "postId": c.post_id,
        "parentId": c.parent_id,
        "depth": c.depth,
        "author": user_brief(c.author),
        "body": "" if c.is_deleted else c.body,
        "isDeleted": c.is_deleted,
        "score": c.score,
        "edited": _edited(c),
        "createdAt": c.created_at.isoformat(),
        "myVote": my_vote,
    }


def profile(u, stats, mentor_id=None):
    """Public profile. stats: {"posts", "answers", "karma"}."""
    return {
        **user_brief(u),
        "cover": u.cover_url,
        "bio": u.bio,
        "targetCountry": {"slug": u.target_country.slug, "name": u.target_country.name} if u.target_country else None,
        "studyLevel": u.study_level,
        "university": u.university,
        "course": u.course,
        "intake": u.intake,
        "joinedAt": u.created_at.isoformat(),
        "stats": stats,
        "mentorId": mentor_id,
    }


def notification(n):
    return {
        "id": n.id,
        "kind": n.kind,
        "actor": user_brief(n.actor) if n.actor else None,
        "post": {"id": n.post.id, "title": n.post.title} if n.post else None,
        "commentId": n.comment_id,
        "message": n.message,
        "isRead": n.is_read,
        "createdAt": n.created_at.isoformat(),
    }


def mentor(m, stats=(None, 0), reviews=None):
    """stats: (average rating, review count). reviews: include the latest reviews (profile page)."""
    rating, count = stats
    data = {
        "id": m.id,
        "user": user_brief(m.user),
        "community": community(m.community),
        "university": m.university,
        "course": m.course,
        "graduationYear": m.graduation_year,
        "headline": m.headline,
        "experience": m.experience,
        "about": m.about,
        "topics": m.topics or [],
        "languages": m.languages or [],
        "links": m.links or {},
        "sessionMinutes": m.session_minutes,
        "timezone": m.timezone,
        "isVerified": m.is_verified,
        "rating": round(float(rating), 1) if rating else None,
        "reviewCount": count,
    }
    if reviews is not None:
        data["reviews"] = [review(r) for r in reviews]
    return data


def review(r):
    return {"id": r.id, "rating": r.rating, "body": r.body, "author": user_brief(r.author),
            "createdAt": r.created_at.isoformat()}


def package(p):
    return {"id": p.id, "title": p.title, "hours": p.hours, "priceMinor": p.price_minor, "currency": p.currency}


def slot(sl):
    return {"id": sl.id, "startsAt": sl.starts_at.isoformat(), "endsAt": sl.ends_at.isoformat()}


def session_state(b, now):
    """Where a booked chat session stands: before it, in it, past its time, or finished."""
    if b.status in ("cancelled", "expired"):
        return b.status
    if getattr(b, "ended_at", None) or b.status == "completed":
        return "ended"
    starts, ends = b.slot.starts_at, b.slot.ends_at
    if starts.tzinfo is None:  # SQLite hands times back without a zone; PostgreSQL keeps it
        now = now.replace(tzinfo=None)
    if now < starts:
        return "upcoming"
    return "live" if now < ends else "overtime"


def booking(b, now=None):
    m = b.mentor
    return {
        "id": b.id,
        "status": b.status,
        "session": session_state(b, now or utcnow()),
        "endedAt": getattr(b, "ended_at", None) and b.ended_at.isoformat(),
        "startsAt": b.slot.starts_at.isoformat(),
        "endsAt": b.slot.ends_at.isoformat(),
        "topic": b.topic,
        "meetingUrl": b.meeting_url if b.status == "confirmed" else None,
        "holdExpiresAt": b.hold_expires_at.isoformat() if b.hold_expires_at else None,
        "mentor": {"id": m.id, "user": user_brief(m.user), "university": m.university, "course": m.course,
                   "timezone": m.timezone},
        "minutes": b.minutes_deducted or m.session_minutes,
        "reviewed": b.review is not None,
        "note": b.note,
    }
