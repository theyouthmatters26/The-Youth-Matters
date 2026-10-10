"""The FAQ page, and the questions members send in for it.

    GET  /faqs            the published questions and answers, in the order the team set
    POST /faqs            {question}: "Post your FAQ". It waits for an answer from the team.
    GET  /faqs/mine       the questions I sent in, answered or still waiting

The team writes the answers in the admin panel (api/admin_content.py, area "faq"). A question with
no answer is never on the public page.
"""
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db, limiter, member_key
from ..models import Faq
from ..models.base import utcnow
from ..services import content
from ..services.notify import notify
from .posts import member

bp = Blueprint("faqs", __name__)

ASK_LIMIT = 3  # questions one member can have waiting at a time


def public(f):
    return {"id": f.id, "question": f.question, "answer": f.answer}


def mine(f):
    return {**public(f), "status": f.status,
            "askedAt": f.created_at.isoformat(),
            "answeredAt": f.answered_at.isoformat() if f.answered_at else None}


def published():
    return db.select(Faq).where(Faq.status == "published", Faq.answer.isnot(None)) \
        .order_by(Faq.sort_order, Faq.id)


@bp.get("/faqs")
def list_faqs():
    return jsonify([public(f) for f in db.session.scalars(published())])


@bp.post("/faqs")
@jwt_required()
@limiter.limit("10 per day", key_func=member_key)
def ask():
    """Send a question in for the FAQ page. Our team answers it, and the answer goes on the page."""
    me = member()
    question, _ = content.clean((request.get_json(silent=True) or {}).get("question"), 200)
    if len(question) < 10:
        abort(400, "Write your question in a few more words.")
    if not question.endswith("?"):
        question += "?"
    waiting = db.session.scalar(db.select(db.func.count(Faq.id))
                                .where(Faq.asked_by_id == me.id, Faq.status == "pending"))
    if waiting >= ASK_LIMIT:
        abort(429, "You already have a few questions with us. We will answer those first.")
    f = Faq(question=question, asked_by_id=me.id, status="pending")
    db.session.add(f)
    db.session.commit()  # the team sees it in the admin panel, FAQ, with a badge on the menu
    return jsonify(mine(f)), 201


@bp.get("/faqs/mine")
@jwt_required()
def my_questions():
    rows = db.session.scalars(db.select(Faq).where(Faq.asked_by_id == current_user.id)
                              .order_by(Faq.created_at.desc()).limit(20))
    return jsonify([mine(f) for f in rows])


def answered(f, by):
    """Called from the admin panel when an answer is written: tell whoever asked."""
    f.answered_by_id, f.answered_at = by.id, utcnow()
    if f.asked_by_id:  # from the team, not from whoever on it wrote the answer
        notify(f.asked_by_id, None, "system", message=f"Your FAQ question is answered: {f.question[:120]}")
