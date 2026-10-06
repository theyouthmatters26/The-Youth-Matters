"""Questions and posts (Module 2) with Hot / Top / New sorting (Module 4).

    GET    /posts?sort=&subject=&country=&category=&unanswered=1&following=1&author=&saved=1&page=
    GET    /posts/<id>
    POST   /posts                     title, body, country, category, up to 4 images (multipart or JSON)
    PATCH  /posts/<id>                the author edits title, body or topic
    DELETE /posts/<id>                the author (or an admin) removes it
    POST   /posts/<id>/save | DELETE  bookmark for later
    POST   /posts/<id>/helpful        the author marks the answer that helped (commentId, or null to clear)
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required, verify_jwt_in_request

from ..extensions import db, limiter
from ..models import Category, Comment, Community, Country, Follow, Post, PostImage, SavedPost, Subject, User, Vote
from ..models.base import utcnow
from ..services import content, images, storage
from ..services.notify import notify, notify_mentions
from ..services.ranking import hot_sql
from . import serializers as s

bp = Blueprint("posts", __name__)

PAGE_SIZE = 20
SORTS = {
    "hot": lambda: hot_sql(Post).desc(),
    "top": lambda: Post.score.desc(),
    "new": lambda: Post.created_at.desc(),
}


def viewer():
    """The logged-in user if a valid token came with the request, otherwise None."""
    verify_jwt_in_request(optional=True)
    return current_user if request.headers.get("Authorization") else None


def member():
    """The current user, if they may post. Call inside @jwt_required."""
    user = current_user
    if user.status != "active":
        abort(403, "Finish verifying your account to take part.")
    if user.muted_until and user.muted_until > utcnow():
        abort(403, f"You can post again after {user.muted_until:%d %b, %H:%M} UTC.")
    return user


def states(user, post_ids):
    """{post_id: {"vote", "saved"}} for the viewer, in two queries for the whole page."""
    if not user or not post_ids:
        return {}
    votes = dict(db.session.execute(db.select(Vote.target_id, Vote.value).where(
        Vote.user_id == user.id, Vote.target_type == "post", Vote.target_id.in_(post_ids))).all())
    saved = set(db.session.scalars(db.select(SavedPost.post_id).where(
        SavedPost.user_id == user.id, SavedPost.post_id.in_(post_ids))))
    return {pid: {"vote": votes.get(pid, 0), "saved": pid in saved} for pid in post_ids}


def query_posts(args, user):
    sort = args.get("sort", "hot")
    if sort not in SORTS:
        abort(400, f"sort must be one of {', '.join(SORTS)}")
    q = db.select(Post).join(Community).where(~Post.is_deleted)
    if slug := args.get("subject"):
        q = q.join(Subject).where(Subject.slug == slug)
    if slug := args.get("country"):
        q = q.join(Country).where(Country.slug == slug)
    if slug := args.get("category"):
        q = q.join(Category).where(Category.slug == slug)
    if args.get("unanswered"):
        q = q.where(Post.comment_count == 0)
    if username := args.get("author"):
        q = q.join(User, Post.author_id == User.id).where(User.username == username)
    if args.get("following"):
        if not user:
            abort(401, "Log in to see your communities.")
        q = q.where(Post.community_id.in_(db.select(Follow.community_id).where(Follow.user_id == user.id)))
    if args.get("saved"):
        if not user:
            abort(401, "Log in to see saved posts.")
        q = q.join(SavedPost, SavedPost.post_id == Post.id).where(SavedPost.user_id == user.id)
    return q.order_by(Post.is_pinned.desc(), SORTS[sort](), Post.id.desc())


def page_of(q, user):
    page = max(request.args.get("page", 1, type=int), 1)
    rows = db.paginate(q, page=page, per_page=PAGE_SIZE, error_out=False)
    st = states(user, [p.id for p in rows.items])
    return {"items": [s.post(p, state=st.get(p.id)) for p in rows.items], "page": page, "hasMore": rows.has_next}


def _post(post_id):
    p = db.session.get(Post, post_id)
    if not p or p.is_deleted:
        abort(404, "This post has been removed or never existed.")
    return p


def _own(p, user):
    if p.author_id != user.id and user.role != "admin":
        abort(403, "You can only change your own posts.")


def _payload():
    return request.form if request.mimetype == "multipart/form-data" else (request.get_json(silent=True) or {})


def _topic(slug):
    if not slug:
        return None
    cat = db.session.scalar(db.select(Category).where(Category.slug == slug))
    if not cat:
        abort(400, "Choose a topic from the list.")
    return cat


@bp.get("/posts")
def list_posts():
    user = viewer()
    return jsonify(page_of(query_posts(request.args, user), user))


@bp.get("/posts/<int:post_id>")
def get_post(post_id):
    user = viewer()
    p = _post(post_id)
    return jsonify(s.post(p, with_body=True, state=states(user, [p.id]).get(p.id)))


@bp.post("/posts")
@jwt_required()
@limiter.limit("10 per hour")
def create_post():
    user = member()
    data = _payload()
    title, flagged_title = content.clean(data.get("title"), 300)
    body, flagged_body = content.clean(data.get("body"), 10000)
    if len(title) < 10:
        abort(400, "Write your question as a full sentence (at least 10 characters).")
    community = db.session.scalar(
        db.select(Community).join(Subject).join(Country)
        .where(Subject.slug == (data.get("subject") or "study-abroad"), Country.slug == data.get("country"),
               Community.is_active))
    if not community:
        abort(400, "Choose the country your question is about.")
    files = request.files.getlist("images")
    if len(files) > 4:
        abort(400, "Add up to 4 pictures.")

    p = Post(author=user, community=community, category=_topic(data.get("category")), title=title, body=body,
             score=1, upvotes=1)  # like Reddit, your own post starts with your upvote
    for i, upload in enumerate(files):
        try:
            key = storage.upload(images.prepare(upload), "posts", "image/jpeg")
        except images.ImageError as e:
            abort(400, str(e))
        p.images.append(PostImage(storage_key=key, position=i))
    db.session.add(p)
    db.session.flush()
    db.session.add(Vote(user_id=user.id, target_type="post", target_id=p.id, value=1))
    notify_mentions(content.mentions(f"{title} {body}"), user, p)
    db.session.commit()
    return jsonify(post=s.post(p, with_body=True, state={"vote": 1}), censored=flagged_title or flagged_body), 201


@bp.patch("/posts/<int:post_id>")
@jwt_required()
@limiter.limit("30 per hour")
def edit_post(post_id):
    user = member()
    p = _post(post_id)
    _own(p, user)
    data = request.get_json(silent=True) or {}
    if "title" in data:
        p.title, _ = content.clean(data["title"], 300)
        if len(p.title) < 10:
            abort(400, "Write your question as a full sentence (at least 10 characters).")
    if "body" in data:
        p.body, _ = content.clean(data["body"], 10000)
    if "category" in data:
        p.category = _topic(data["category"])
    p.updated_at = utcnow()
    db.session.commit()
    return jsonify(post=s.post(p, with_body=True, state=states(user, [p.id]).get(p.id)))


@bp.delete("/posts/<int:post_id>")
@jwt_required()
def delete_post(post_id):
    user = current_user
    p = _post(post_id)
    _own(p, user)
    p.is_deleted = True
    db.session.commit()
    return "", 204


@bp.post("/posts/<int:post_id>/save")
@jwt_required()
def save_post(post_id):
    _post(post_id)
    if not db.session.scalar(db.select(SavedPost.id).filter_by(user_id=current_user.id, post_id=post_id)):
        db.session.add(SavedPost(user_id=current_user.id, post_id=post_id))
        db.session.commit()
    return jsonify(saved=True)


@bp.delete("/posts/<int:post_id>/save")
@jwt_required()
def unsave_post(post_id):
    db.session.execute(db.delete(SavedPost).filter_by(user_id=current_user.id, post_id=post_id))
    db.session.commit()
    return jsonify(saved=False)


@bp.post("/posts/<int:post_id>/helpful")
@jwt_required()
def mark_helpful(post_id):
    user = member()
    p = _post(post_id)
    if p.author_id != user.id:
        abort(403, "Only the person who asked can mark an answer as helpful.")
    comment_id = (request.get_json(silent=True) or {}).get("commentId")
    if comment_id is None:
        p.helpful_comment_id = None
    else:
        c = db.session.get(Comment, comment_id)
        if not c or c.post_id != p.id or c.is_deleted:
            abort(400, "That answer is not part of this question.")
        if p.helpful_comment_id != c.id:
            notify(c.author_id, user, "system", p, c, message="marked your answer as the one that helped")
        p.helpful_comment_id = c.id
    db.session.commit()
    return jsonify(helpfulCommentId=p.helpful_comment_id)
