"""Model -> JSON dicts. Kept in one place so every endpoint returns the same shapes."""


def user_brief(u):
    return {"id": u.id, "username": u.username, "displayName": u.display_name, "role": u.role,
            "avatar": u.avatar_url}


def me(u):
    """The signed-in account. verification is the step sign-up is on:
    document -> selfie -> verified, or review / rejected when a person has to look at it."""
    v = u.verification
    if u.status == "active":
        step = "verified"
    elif v and v.status in ("review", "rejected"):
        step = v.status
    else:
        step = "selfie" if v and v.id_face else "document"
    return {**user_brief(u), "email": u.email, "emailVerified": u.email_verified, "status": u.status,
            "verification": step, "dateOfBirth": u.date_of_birth.isoformat() if u.date_of_birth else None}


def subject(s):
    return {"id": s.id, "slug": s.slug, "name": s.name, "description": s.description,
            "isActive": s.is_active}


def community(c):
    return {
        "id": c.id,
        "subject": {"slug": c.subject.slug, "name": c.subject.name},
        "country": {"slug": c.country.slug, "name": c.country.name, "isoCode": c.country.iso_code},
        "description": c.description,
    }


def category(c):
    return {"id": c.id, "slug": c.slug, "name": c.name}


def post(p, with_body=False):
    data = {
        "id": p.id,
        "title": p.title,
        "author": user_brief(p.author),
        "community": community(p.community),
        "category": category(p.category) if p.category else None,
        "score": p.score,
        "commentCount": p.comment_count,
        "isPinned": p.is_pinned,
        "createdAt": p.created_at.isoformat(),
    }
    if with_body:
        data["body"] = p.body
    return data


def comment(c):
    return {
        "id": c.id,
        "parentId": c.parent_id,
        "author": user_brief(c.author),
        "body": "[deleted]" if c.is_deleted else c.body,
        "score": c.score,
        "createdAt": c.created_at.isoformat(),
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
        "priceMinor": m.price_minor,
        "currency": m.currency,
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


def slot(sl):
    return {"id": sl.id, "startsAt": sl.starts_at.isoformat(), "endsAt": sl.ends_at.isoformat()}


def booking(b):
    m = b.mentor
    return {
        "id": b.id,
        "status": b.status,
        "startsAt": b.slot.starts_at.isoformat(),
        "endsAt": b.slot.ends_at.isoformat(),
        "topic": b.topic,
        "meetingUrl": b.meeting_url if b.status == "confirmed" else None,
        "holdExpiresAt": b.hold_expires_at.isoformat() if b.hold_expires_at else None,
        "mentor": {"id": m.id, "user": user_brief(m.user), "university": m.university, "course": m.course,
                   "timezone": m.timezone},
        "amountMinor": b.payment.amount_minor if b.payment else m.price_minor,
        "currency": b.payment.currency if b.payment else m.currency,
        "paymentStatus": b.payment.status if b.payment else None,
        "invoiceNumber": b.payment.invoice_number if b.payment else None,
        "reviewed": b.review is not None,
        "note": b.note,
    }
