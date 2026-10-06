"""Subjects and their country communities (Module 5 + the agreement's reusable hierarchy).

Phase 2: POST/DELETE /communities/<id>/join
"""
from flask import Blueprint, jsonify

from ..extensions import db
from ..models import Category, Community, Country, Subject
from . import serializers as s

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
    )
    return jsonify([s.community(c) for c in rows])


@bp.get("/subjects/<subject_slug>/communities/<country_slug>")
def get_community(subject_slug, country_slug):
    c = db.first_or_404(
        db.select(Community).join(Subject).join(Country)
        .where(Subject.slug == subject_slug, Country.slug == country_slug, Community.is_active)
    )
    return jsonify(s.community(c))


@bp.get("/categories")
def list_categories():
    rows = db.session.scalars(db.select(Category).order_by(Category.name))
    return jsonify([s.category(c) for c in rows])
