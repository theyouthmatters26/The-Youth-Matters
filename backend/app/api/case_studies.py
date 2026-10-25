"""The case studies page.

    GET /case-studies     the published journeys, in the order the team set

The team writes them in the admin panel (api/admin_content.py, area "blog").
"""
from flask import Blueprint, jsonify

from ..extensions import db
from ..models import CaseStudy
from . import serializers as s

bp = Blueprint("case_studies", __name__)


def public(c):
    """story and images are what a student sees when they open a journey; both can be empty, and
    a journey written before they existed simply opens with the quote it already had."""
    return {"id": c.id, "name": c.name, "route": c.route, "course": c.course, "quote": c.quote,
            "story": c.story or "", "images": [s.media_url(k) for k in (c.images or [])]}


@bp.get("/case-studies")
def list_case_studies():
    rows = db.session.scalars(db.select(CaseStudy).where(CaseStudy.status == "published")
                              .order_by(CaseStudy.sort_order, CaseStudy.id))
    return jsonify([public(c) for c in rows])
