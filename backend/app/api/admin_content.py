"""The parts of the admin panel that manage what is on the site (see admin.py for the rest).

Blog (area "blog")
    GET    /admin/blog                       every article, drafts included
    GET    /admin/blog/<id>                  one article, for the editor
    POST   /admin/blog                       PATCH and DELETE /admin/blog/<id>
    POST   /admin/blog/image                 upload a cover photo -> {url}
Community (area "community")
    GET    /admin/questions?q=&filter=&page= POST /admin/questions/<id> {pinned, removed}
    GET    /admin/questions/<id>             the question with its answers; DELETE /admin/answers/<id> removes one
    GET    /admin/chat/rooms                 POST {name, description}; PATCH and DELETE /admin/chat/rooms/<id>
    GET    /admin/chat/rooms/<id>/messages   DELETE /admin/chat/messages/<id>
    GET    /admin/topics                     POST, PATCH and DELETE /admin/topics/<id>
    GET    /admin/communities                POST {name, isoCode, description}: a new country and its community
    PATCH  /admin/communities/<id>           {description, isActive}
    POST   /admin/communities/<id>/image     the country's photo (multipart "image")
FAQ (area "faq")
    GET    /admin/faqs                       every question: published, hidden and the ones members sent in
    POST   /admin/faqs                       {question, answer}: write one
    PATCH  /admin/faqs/<id>                  {question, answer, status, sortOrder}: answering publishes it
    DELETE /admin/faqs/<id>
Contact form (area "support")
    GET    /admin/contact?status=&page=      POST /admin/contact/<id> {status: new | done}, DELETE /admin/contact/<id>
Exports
    GET    /admin/members.csv                GET /admin/payments.csv
"""
import csv
import io
import re

from flask import Blueprint, Response, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db
from ..models import (BlogPost, Category, ChatMessage, ChatRoom, Comment, Community, ContactMessage, Country, Faq,
                      Follow, Payment, Post, Subject, User)
from ..models.base import utcnow
from ..services import images, storage
from . import serializers as s
from .admin import _remove, paged, record, team_member
from .blogs import article, card
from .faqs import answered

bp = Blueprint("admin_content", __name__)

SITE_PATH = re.compile(r"^/(?!/)(?!.*\.\.)[\w\-./%]+$")  # a path on this site: no other address, no ../


def _text(value, limit):
    return str(value or "").replace("\r\n", "\n").strip()[:limit]


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("'", "")).strip("-")


# ---------------------------------------------------------------- blog

def _row(b):
    return {**card(b), "id": b.id, "status": "published" if b.published_at else "draft"}


def _post(post_id):
    return db.session.get(BlogPost, post_id) or abort(404, "We could not find that article.")


def _strings(items, most, longest):
    return [t for t in (_text(i, longest) for i in (items if isinstance(items, list) else [])) if t][:most]


def _fill(b, data):
    """Copy the editor's form into the article. Publishing needs the pieces the page cannot do without."""
    b.title = _text(data.get("title"), 200)
    if len(b.title) < 5:
        abort(400, "Give the article a title.")
    slug = slugify(_text(data.get("slug"), 160) or b.title)[:160]
    clash = db.session.scalar(db.select(BlogPost.id).where(BlogPost.slug == slug, BlogPost.id != (b.id or 0)))
    if not slug or clash:
        abort(400, "Another article already uses that web address. Change the title or the address.")
    b.slug, b.excerpt, b.body = slug, _text(data.get("excerpt"), 300), _text(data.get("source"), 200_000)

    image = _text(data.get("image"), 255)
    if image and not SITE_PATH.match(image):
        abort(400, "Upload the cover photo here, or use a picture already on the site (a path starting with /).")
    author = data.get("author") if isinstance(data.get("author"), dict) else {}
    pairs = [[_text(q, 300), _text(a, 2000)] for q, a in (x for x in (data.get("faqs") or []) if isinstance(x, list) and len(x) == 2)]
    links = [{"label": _text(x.get("label"), 200), "url": _text(x.get("url"), 500)}
             for x in (data.get("sources") or []) if isinstance(x, dict)]
    b.meta = {
        "seoTitle": _text(data.get("seoTitle"), 120), "description": _text(data.get("description"), 320),
        "topic": _text(data.get("topic"), 60), "keywords": _strings(data.get("keywords"), 25, 80),
        "image": image, "imageAlt": _text(data.get("imageAlt"), 200),
        "author": {"name": _text(author.get("name"), 80) or "TYM Team", "username": _text(author.get("username"), 32),
                   "role": _text(author.get("role"), 160), "bio": _text(author.get("bio"), 500)},
        "takeaways": _strings(data.get("takeaways"), 8, 400),
        "faqs": [p for p in pairs if all(p)][:15],
        "sources": [x for x in links if x["label"] and x["url"].startswith(("https://", "http://"))][:25],
        "readMins": max(1, round(len(b.body.split()) / 220)),
    }
    b.updated_at = utcnow()

    if data.get("publish"):
        missing = [name for name, ok in (("a summary of at least 20 characters", len(b.excerpt) >= 20),
                                         ("the article itself", len(b.body) >= 200),
                                         ("a cover photo", bool(image))) if not ok]
        if missing:
            abort(400, f"Before publishing, add {' and '.join(missing)}.")
        b.published_at = b.published_at or utcnow()
    else:
        b.published_at = None


@bp.get("/admin/blog")
@jwt_required()
def articles():
    team_member("blog")
    rows = db.session.scalars(db.select(BlogPost).order_by(BlogPost.published_at.is_(None).desc(), BlogPost.published_at.desc(),
                                                           BlogPost.id.desc()))
    return jsonify([_row(b) for b in rows])


@bp.get("/admin/blog/<int:post_id>")
@jwt_required()
def get_article(post_id):
    team_member("blog")
    b = _post(post_id)
    return jsonify({**article(b), "id": b.id, "status": "published" if b.published_at else "draft"})


@bp.post("/admin/blog")
@jwt_required()
def create_article():
    me = team_member("blog")
    subject = db.session.scalar(db.select(Subject).where(Subject.slug == "study-abroad"))
    b = BlogPost(subject_id=subject.id, author_id=me.id)
    _fill(b, request.get_json(silent=True) or {})
    db.session.add(b)
    db.session.commit()
    return jsonify({**article(b), "id": b.id, "status": "published" if b.published_at else "draft"}), 201


@bp.patch("/admin/blog/<int:post_id>")
@jwt_required()
def update_article(post_id):
    team_member("blog")
    b = _post(post_id)
    _fill(b, request.get_json(silent=True) or {})
    db.session.commit()
    return jsonify({**article(b), "id": b.id, "status": "published" if b.published_at else "draft"})


@bp.delete("/admin/blog/<int:post_id>")
@jwt_required()
def delete_article(post_id):
    team_member("blog")
    b = _post(post_id)
    image = (b.meta or {}).get("image") or ""
    db.session.delete(b)
    db.session.commit()
    if image.startswith("/api/media/blog/"):  # a cover uploaded for this article, not a shared site picture
        storage.delete(image.removeprefix("/api/media/"))
    return jsonify(deleted=True)


@bp.post("/admin/blog/image")
@jwt_required()
def upload_cover():
    team_member("blog")
    upload = request.files.get("image") or abort(400, "Choose a picture.")
    try:
        key = storage.upload(images.prepare(upload, max_side=2000), "blog", "image/jpeg")
    except images.ImageError as e:
        abort(400, str(e))
    return jsonify(url=s.media_url(key)), 201


# ---------------------------------------------------------------- community: questions

@bp.get("/admin/questions")
@jwt_required()
def questions():
    team_member("community")
    q = db.select(Post)
    chosen = request.args.get("filter", "live")
    q = {"live": q.where(~Post.is_deleted), "pinned": q.where(Post.is_pinned, ~Post.is_deleted),
         "unanswered": q.where(~Post.is_deleted, Post.comment_count == 0), "removed": q.where(Post.is_deleted)}.get(chosen, q)
    term = request.args.get("q", "").strip()
    if term:
        q = q.where(Post.title.ilike(f"%{term}%") | Post.body.ilike(f"%{term}%"))

    def row(p):
        return {"id": p.id, "title": p.title, "excerpt": p.body[:200], "author": s.user_brief(p.author),
                "country": p.community.country.name, "topic": p.category.name if p.category else None, "score": p.score,
                "answers": p.comment_count, "pinned": p.is_pinned, "removed": p.is_deleted, "at": p.created_at.isoformat()}

    return jsonify(paged(q.order_by(Post.is_pinned.desc(), Post.id.desc()), row))


@bp.post("/admin/questions/<int:post_id>")
@jwt_required()
def change_question(post_id):
    """Pin a question to the top of its community, or take it off the site (and put it back)."""
    team_member("community")
    p = db.session.get(Post, post_id) or abort(404, "We could not find that question.")
    data = request.get_json(silent=True) or {}
    if "pinned" in data:
        p.is_pinned = bool(data["pinned"])
    if "removed" in data and bool(data["removed"]) != p.is_deleted:
        p.is_deleted = bool(data["removed"])
        record("removed" if p.is_deleted else "restored", "post", p.id, name=p.author.display_name)
    db.session.commit()
    return jsonify(pinned=p.is_pinned, removed=p.is_deleted)


@bp.get("/admin/questions/<int:post_id>")
@jwt_required()
def question(post_id):
    """One question in full, with every answer and reply under it, removed ones included."""
    team_member("community")
    p = db.session.get(Post, post_id) or abort(404, "We could not find that question.")
    answers = db.session.scalars(db.select(Comment).where(Comment.post_id == p.id).order_by(Comment.id))
    return jsonify(id=p.id, title=p.title, body=p.body, author=s.user_brief(p.author), removed=p.is_deleted,
                   answers=[{"id": c.id, "author": s.user_brief(c.author), "body": c.body, "removed": c.is_deleted,
                             "reply": c.parent_id is not None, "score": c.score, "at": c.created_at.isoformat()}
                            for c in answers])


@bp.delete("/admin/answers/<int:comment_id>")
@jwt_required()
def remove_answer(comment_id):
    team_member("community")
    author = _remove("comment", comment_id) or abort(404, "That answer is already gone.")
    record("removed", "comment", comment_id, name=author.display_name)
    db.session.commit()
    return jsonify(removed=True)


# ---------------------------------------------------------------- community: chat rooms

@bp.get("/admin/chat/rooms")
@jwt_required()
def chat_rooms():
    team_member("community")
    counts = dict(db.session.execute(db.select(ChatMessage.room_id, db.func.count(ChatMessage.id))
                                     .where(~ChatMessage.is_deleted).group_by(ChatMessage.room_id)).all())
    rooms = db.session.scalars(db.select(ChatRoom).order_by(ChatRoom.id))
    return jsonify([{"id": r.id, "slug": r.slug, "name": r.name, "description": r.description, "isActive": r.is_active,
                     "messages": counts.get(r.id, 0)} for r in rooms])


@bp.post("/admin/chat/rooms")
@jwt_required()
def add_room():
    team_member("community")
    data = request.get_json(silent=True) or {}
    name = _text(data.get("name"), 80)
    slug = slugify(name)[:40]
    if len(name) < 2 or not slug:
        abort(400, "Give the room a name.")
    if db.session.scalar(db.select(ChatRoom.id).where((ChatRoom.slug == slug) | (db.func.lower(ChatRoom.name) == name.lower()))):
        abort(409, "There is already a room with that name.")
    subject = db.session.scalar(db.select(Subject).where(Subject.slug == "study-abroad"))
    r = ChatRoom(slug=slug, name=name, description=_text(data.get("description"), 255) or None, subject_id=subject.id)
    db.session.add(r)
    db.session.commit()
    return jsonify(id=r.id, slug=r.slug, name=r.name), 201


@bp.delete("/admin/chat/rooms/<int:room_id>")
@jwt_required()
def delete_room(room_id):
    team_member("community")
    r = db.session.get(ChatRoom, room_id) or abort(404, "That room is already gone.")
    db.session.execute(db.delete(ChatRoom).where(ChatRoom.id == r.id))  # its messages go with it
    db.session.commit()
    return jsonify(deleted=True)


@bp.patch("/admin/chat/rooms/<int:room_id>")
@jwt_required()
def change_room(room_id):
    team_member("community")
    r = db.session.get(ChatRoom, room_id) or abort(404, "We could not find that room.")
    data = request.get_json(silent=True) or {}
    if "name" in data:
        r.name = _text(data["name"], 80) or abort(400, "Give the room a name.")
    if "description" in data:
        r.description = _text(data["description"], 255) or None
    if "isActive" in data:
        r.is_active = bool(data["isActive"])
    db.session.commit()
    return jsonify(id=r.id, name=r.name, description=r.description, isActive=r.is_active)


@bp.get("/admin/chat/rooms/<int:room_id>/messages")
@jwt_required()
def room_messages(room_id):
    team_member("community")
    rows = db.session.scalars(db.select(ChatMessage).where(ChatMessage.room_id == room_id, ~ChatMessage.is_deleted)
                              .order_by(ChatMessage.id.desc()).limit(80))
    return jsonify([{"id": m.id, "author": s.user_brief(m.author), "body": m.body, "at": m.created_at.isoformat()} for m in rows])


@bp.delete("/admin/chat/messages/<int:message_id>")
@jwt_required()
def delete_chat_message(message_id):
    team_member("community")
    m = db.session.get(ChatMessage, message_id) or abort(404, "That message is already gone.")
    m.is_deleted = True
    record("removed", "chat_message", m.id, name=m.author.display_name)
    db.session.commit()
    return jsonify(removed=True)


# ---------------------------------------------------------------- community: topics and countries

def _topic_json(c, used=0):
    return {"id": c.id, "slug": c.slug, "name": c.name, "description": c.description, "questions": used}


@bp.get("/admin/topics")
@jwt_required()
def topics():
    team_member("community")
    used = dict(db.session.execute(db.select(Post.category_id, db.func.count(Post.id)).where(~Post.is_deleted)
                                   .group_by(Post.category_id)).all())
    return jsonify([_topic_json(c, used.get(c.id, 0)) for c in db.session.scalars(db.select(Category).order_by(Category.name))])


@bp.post("/admin/topics")
@jwt_required()
def add_topic():
    team_member("community")
    data = request.get_json(silent=True) or {}
    name = _text(data.get("name"), 80)
    slug = slugify(name)[:40]
    if len(name) < 2 or not slug:
        abort(400, "Give the topic a name.")
    if db.session.scalar(db.select(Category.id).where((Category.slug == slug) | (db.func.lower(Category.name) == name.lower()))):
        abort(409, "There is already a topic with that name.")
    c = Category(slug=slug, name=name, description=_text(data.get("description"), 300) or None)
    db.session.add(c)
    db.session.commit()
    return jsonify(_topic_json(c)), 201


@bp.patch("/admin/topics/<int:topic_id>")
@jwt_required()
def change_topic(topic_id):
    team_member("community")
    c = db.session.get(Category, topic_id) or abort(404, "We could not find that topic.")
    data = request.get_json(silent=True) or {}
    if "name" in data:
        c.name = _text(data["name"], 80) or abort(400, "Give the topic a name.")
    if "description" in data:
        c.description = _text(data["description"], 300) or None
    db.session.commit()
    return jsonify(_topic_json(c))


@bp.delete("/admin/topics/<int:topic_id>")
@jwt_required()
def delete_topic(topic_id):
    team_member("community")
    c = db.session.get(Category, topic_id) or abort(404, "We could not find that topic.")
    if db.session.scalar(db.select(Post.id).where(Post.category_id == c.id).limit(1)):
        abort(409, "Questions are filed under this topic. Rename it instead, so they keep their place.")
    db.session.delete(c)
    db.session.commit()
    return jsonify(deleted=True)


def _community_json(c, members=0, questions=0):
    return {"id": c.id, "country": c.country.name, "slug": c.country.slug, "subject": c.subject.name,
            "image": s.media_url(c.country.image_key) if c.country.image_key else None,
            "description": c.description, "isActive": c.is_active, "members": members, "questions": questions}


@bp.get("/admin/communities")
@jwt_required()
def communities():
    team_member("community")
    rows = db.session.scalars(db.select(Community).order_by(Community.sort_order)).all()
    members = dict(db.session.execute(db.select(Follow.community_id, db.func.count(Follow.id))
                                      .where(Follow.community_id.isnot(None)).group_by(Follow.community_id)).all())
    asked = dict(db.session.execute(db.select(Post.community_id, db.func.count(Post.id)).where(~Post.is_deleted)
                                    .group_by(Post.community_id)).all())
    return jsonify([_community_json(c, members.get(c.id, 0), asked.get(c.id, 0)) for c in rows])


@bp.post("/admin/communities")
@jwt_required()
def add_community():
    """A new destination: the country, its community, and the chat room that goes with it. The photo
    is uploaded afterwards, when there is an id to hang it on."""
    team_member("community")
    data = request.get_json(silent=True) or {}
    name = _text(data.get("name"), 80)
    iso = str(data.get("isoCode") or "").strip().upper()  # checked whole, never trimmed to fit
    slug = slugify(_text(data.get("slug"), 40) or name)[:40]
    if len(name) < 2 or not slug:
        abort(400, "Give the country a name.")
    if not (len(iso) == 2 and iso.isalpha()):
        abort(400, "Enter the country's two-letter code, like FR.")
    subject = db.session.scalar(db.select(Subject).where(Subject.slug == "study-abroad"))
    if not subject:
        abort(409, "The Study Abroad subject is missing. Seed the site first.")
    if db.session.scalar(db.select(Country.id).where((Country.slug == slug) | (Country.iso_code == iso)
                                                     | (db.func.lower(Country.name) == name.lower()))):
        abort(409, "That country is already here.")

    country = Country(slug=slug, name=name, iso_code=iso)
    last = db.session.scalar(db.select(db.func.max(Community.sort_order))) or 0
    community = Community(subject=subject, country=country, description=_text(data.get("description"), 500) or None,
                          is_active=True, sort_order=last + 1)
    # One room per country, like the rest of them (database/demo_chat.py)
    db.session.add_all([country, community,
                        ChatRoom(slug=slug, name=name, subject=subject, community=community,
                                 description=community.description)])
    db.session.commit()
    record("community_added", "user", current_user.id, name=name)
    db.session.commit()
    return jsonify(_community_json(community, 0, 0)), 201


@bp.post("/admin/communities/<int:community_id>/image")
@jwt_required()
def upload_country_photo(community_id):
    """The picture shown for this country across the site. Replacing one removes the old file."""
    team_member("community")
    c = db.session.get(Community, community_id) or abort(404, "We could not find that community.")
    upload = request.files.get("image") or abort(400, "Choose a picture.")
    try:
        key = storage.upload(images.prepare(upload, max_side=1200), "countries", "image/jpeg")
    except images.ImageError as e:
        abort(400, str(e))
    old_key, c.country.image_key = c.country.image_key, key
    db.session.commit()
    if old_key:
        storage.delete(old_key)
    return jsonify(id=c.id, image=s.media_url(key)), 201


@bp.patch("/admin/communities/<int:community_id>")
@jwt_required()
def change_community(community_id):
    team_member("community")
    c = db.session.get(Community, community_id) or abort(404, "We could not find that community.")
    data = request.get_json(silent=True) or {}
    if "description" in data:
        c.description = _text(data["description"], 500) or None
    if "isActive" in data:
        c.is_active = bool(data["isActive"])
    db.session.commit()
    return jsonify(id=c.id, description=c.description, isActive=c.is_active)


# ---------------------------------------------------------------- FAQ

def _faq_json(f):
    return {"id": f.id, "question": f.question, "answer": f.answer, "status": f.status,
            "sortOrder": f.sort_order, "createdAt": f.created_at.isoformat(),
            "askedBy": s.user_brief(f.asked_by) if f.asked_by else None,
            "answeredAt": f.answered_at.isoformat() if f.answered_at else None}


def _faq(faq_id):
    return db.session.get(Faq, faq_id) or abort(404, "We could not find that question.")


@bp.get("/admin/faqs")
@jwt_required()
def faqs():
    """Everything on the FAQ page, and the questions members sent in. Waiting ones come first."""
    team_member("faq")
    waiting = db.case((Faq.status == "pending", 0), else_=1)
    rows = db.session.scalars(db.select(Faq).order_by(waiting, Faq.sort_order, Faq.id))
    return jsonify([_faq_json(f) for f in rows])


@bp.post("/admin/faqs")
@jwt_required()
def add_faq():
    me = team_member("faq")
    data = request.get_json(silent=True) or {}
    question, answer = _text(data.get("question"), 200), _text(data.get("answer"), 4000)
    if len(question) < 5 or len(answer) < 5:
        abort(400, "Write the question and the answer.")
    last = db.session.scalar(db.select(db.func.max(Faq.sort_order))) or 0
    f = Faq(question=question, answer=answer, status="published", sort_order=last + 1)
    answered(f, me)
    db.session.add(f)
    db.session.commit()
    return jsonify(_faq_json(f)), 201


@bp.patch("/admin/faqs/<int:faq_id>")
@jwt_required()
def change_faq(faq_id):
    """Answering a member's question publishes it: that is what they were told would happen."""
    me = team_member("faq")
    f = _faq(faq_id)
    data = request.get_json(silent=True) or {}
    if "question" in data:
        f.question = _text(data["question"], 200) or abort(400, "The question cannot be empty.")
    if "answer" in data:
        text = _text(data["answer"], 4000)
        if text and text != (f.answer or ""):
            answered(f, me)
        f.answer = text or None
        if f.status == "pending" and text:
            f.status = "published"
    if data.get("status") in ("pending", "published", "hidden"):
        if data["status"] == "published" and not f.answer:
            abort(400, "Write an answer before you publish it.")
        f.status = data["status"]
    if isinstance(data.get("sortOrder"), int):
        f.sort_order = max(0, min(data["sortOrder"], 9999))
    db.session.commit()
    return jsonify(_faq_json(f))


@bp.delete("/admin/faqs/<int:faq_id>")
@jwt_required()
def delete_faq(faq_id):
    team_member("faq")
    f = _faq(faq_id)  # the moderation log is for members' content, so nothing is written there
    db.session.delete(f)
    db.session.commit()
    return jsonify(deleted=True)



# ---------------------------------------------------------------- contact form inbox

@bp.get("/admin/contact")
@jwt_required()
def contact_messages():
    team_member("support")
    status = request.args.get("status", "new")

    def row(m):
        return {"id": m.id, "name": m.name, "email": m.email, "topic": m.topic, "message": m.message,
                "details": m.details or {}, "status": m.status, "at": m.created_at.isoformat()}

    return jsonify(**paged(db.select(ContactMessage).where(ContactMessage.status == status).order_by(ContactMessage.id.desc()), row),
                   new=db.session.scalar(db.select(db.func.count(ContactMessage.id)).where(ContactMessage.status == "new")))


@bp.post("/admin/contact/<int:message_id>")
@jwt_required()
def handle_contact(message_id):
    me = team_member("support")
    m = db.session.get(ContactMessage, message_id) or abort(404, "We could not find that message.")
    done = (request.get_json(silent=True) or {}).get("status") == "done"
    m.status, m.handled_by_id, m.handled_at = ("done", me.id, utcnow()) if done else ("new", None, None)
    db.session.commit()
    return jsonify(status=m.status)


@bp.delete("/admin/contact/<int:message_id>")
@jwt_required()
def delete_contact(message_id):
    team_member("support")
    m = db.session.get(ContactMessage, message_id) or abort(404, "That message is already gone.")
    db.session.delete(m)
    db.session.commit()
    return jsonify(deleted=True)


# ---------------------------------------------------------------- exports

def _cell(value):
    """A spreadsheet runs a cell that starts with = + - or @ as a formula. Names are typed by members,
    so those get a leading apostrophe and stay text."""
    text = str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@") else text


def _csv(filename, header, rows):
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(header)
    writer.writerows([_cell(v) for v in row] for row in rows)
    # The BOM makes Excel read names and the rupee sign correctly
    return Response("﻿" + out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@bp.get("/admin/members.csv")
@jwt_required()
def members_csv():
    team_member("members")
    people = db.session.scalars(db.select(User).where(User.role != "bot").order_by(User.id))
    return _csv("tym-members.csv", ["Name", "Username", "Email", "Role", "Status", "Heading to", "University", "Course", "Joined"],
                [[u.display_name, u.username, u.email, u.role, u.status, u.target_country.name if u.target_country else "",
                  u.university or "", u.course or "", u.created_at.date().isoformat()] for u in people])


@bp.get("/admin/payments.csv")
@jwt_required()
def payments_csv():
    team_member("bookings")
    rows = db.session.execute(db.select(Payment, User).join(User, Payment.user_id == User.id).order_by(Payment.id)).all()

    def line(pay, member):
        return [pay.created_at.date().isoformat(), member.display_name, member.email, pay.package.title if pay.package else "",
                f"{(pay.minutes or 0) / 60:g}", f"{pay.amount_minor / 100:.2f}", pay.currency, pay.status,
                pay.invoice_number or "", pay.razorpay_payment_id or "", pay.razorpay_refund_id or ""]

    return _csv("tym-payments.csv", ["Date", "Member", "Email", "Package", "Hours", "Amount", "Currency", "Status",
                                     "Invoice", "Razorpay payment", "Razorpay refund"], [line(p, u) for p, u in rows])
