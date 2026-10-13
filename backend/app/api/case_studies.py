"""The case studies page.

    GET /case-studies     the published journeys, in the order the team set

The team writes them in the admin panel (api/admin_content.py, area "blog").
"""
from flask import Blueprint, jsonify

from ..extensions import db
from ..models import CaseStudy

bp = Blueprint("case_studies", __name__)


def public(c):
    return {"id": c.id, "name": c.name, "route": c.route, "course": c.course, "quote": c.quote}


@bp.get("/case-studies")
def list_case_studies():
    rows = db.session.scalars(db.select(CaseStudy).where(CaseStudy.status == "published")
                              .order_by(CaseStudy.sort_order, CaseStudy.id))
    return jsonify([public(c) for c in rows])
