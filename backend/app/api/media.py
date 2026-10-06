"""Uploaded pictures (post images, profile and cover photos).

Locally they are served from backend/instance/private; with DigitalOcean Spaces this redirects to
a short-lived signed URL. Only these public folders are reachable, never anything else in storage.
"""
from pathlib import Path

from flask import Blueprint, abort, current_app, redirect, send_from_directory

from ..services import storage

bp = Blueprint("media", __name__)
PUBLIC = ("posts/", "avatars/", "covers/")


@bp.get("/media/<path:key>")
def media(key):
    if not key.startswith(PUBLIC) or ".." in key:
        abort(404)
    if current_app.config["SPACES_KEY"]:
        return redirect(storage.signed_url(key, expires=3600))
    response = send_from_directory(Path(current_app.instance_path, "private"), key, max_age=86400)
    return response
