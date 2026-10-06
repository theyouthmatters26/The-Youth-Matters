"""Personal home feed (Module 6).

    GET /feed?sort=hot|new&page=    posts from the communities you joined; until you join one, the
                                    whole community's best posts, with following=false so the page
                                    can suggest communities to join
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..extensions import db
from ..models import Follow
from .posts import page_of, query_posts

bp = Blueprint("feed", __name__)


@bp.get("/feed")
@jwt_required()
def feed():
    joined = bool(db.session.scalar(db.select(Follow.id).filter_by(user_id=current_user.id).limit(1)))
    args = {"sort": request.args.get("sort", "hot"), **({"following": "1"} if joined else {})}
    return jsonify(following=joined, **page_of(query_posts(args, current_user), current_user))
