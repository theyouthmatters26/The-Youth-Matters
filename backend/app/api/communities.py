"""Subjects and their country communities (Module 5 + the agreement's reusable hierarchy).

    GET /subjects/<slug>/communities           with members, questions and whether you joined

    POST | DELETE /communities/<id>/follow     join or leave a community (its posts fill your feed)
"""
from flask import Blueprint, abort, jsonify
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db
from ..models import Category, Community, Country, Follow, Post, Subject
from . import serializers as s
from .posts import viewer

bp = Blueprint("communities", __name__)


@bp.get("/subjects")
def list_subjects():
    rows = db.session.scalars(db.select(Subject).order_by(Subject.sort_order))
    return jsonify([s.subject(x) for x in rows])


@bp.get("/subjects/<slug>/communities")
def list_communities(slug):
    subject = db.first_or_404(db.select(Subject).filter_by(slug=slug))
    rows = db.session.scalars(
        db.select(Community).filter_by(subject_id=subject.id, is_active=True).order_by(Community.sort_order)
    ).all()
    ids = [c.id for c in rows]
    members = dict(db.session.execute(db.select(Follow.community_id, db.func.count(Follow.id))
                                      .where(Follow.community_id.in_(ids)).group_by(Follow.community_id)).all())
    questions = dict(db.session.execute(db.select(Post.community_id, db.func.count(Post.id))
                                        .where(Post.community_id.in_(ids), ~Post.is_deleted)
                                        .group_by(Post.community_id)).all())
    user = viewer()
    joined = set(db.session.scalars(db.select(Follow.community_id).where(Follow.user_id == user.id))) if user else set()
    return jsonify([{**s.community(c), "members": members.get(c.id, 0), "questions": questions.get(c.id, 0),
                     "following": c.id in joined} for c in rows])


@bp.get("/subjects/<subject_slug>/communities/<country_slug>")
def get_community(subject_slug, country_slug):
    c = db.first_or_404(
        db.select(Community).join(Subject).join(Country)
        .where(Subject.slug == subject_slug, Country.slug == country_slug, Community.is_active)
    )
    user = viewer()
    members = db.session.scalar(db.select(db.func.count(Follow.id)).filter_by(community_id=c.id))
    following = bool(user and db.session.scalar(db.select(Follow.id).filter_by(user_id=user.id, community_id=c.id)))
    return jsonify({**s.community(c), "members": members, "following": following})


def _community(community_id):
    c = db.session.get(Community, community_id)
    if not c or not c.is_active:
        abort(404, "We could not find that community.")
    return c


@bp.post("/communities/<int:community_id>/follow")
@jwt_required()
def follow(community_id):
    _community(community_id)
    if not db.session.scalar(db.select(Follow.id).filter_by(user_id=current_user.id, community_id=community_id)):
        db.session.add(Follow(user_id=current_user.id, community_id=community_id))
        db.session.commit()
    return jsonify(following=True)


@bp.delete("/communities/<int:community_id>/follow")
@jwt_required()
def unfollow(community_id):
    db.session.execute(db.delete(Follow).filter_by(user_id=current_user.id, community_id=community_id))
    db.session.commit()
    return jsonify(following=False)


@bp.get("/categories")
def list_categories():
    rows = db.session.scalars(db.select(Category).order_by(Category.name))
    return jsonify([s.category(c) for c in rows])
