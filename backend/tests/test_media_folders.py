"""Which uploaded pictures the website can actually fetch back (api/media.py).

A folder missing from PUBLIC uploads happily and then 404s when a page asks for it, which shows
up as a broken image long after the upload looked fine. That is how country photos were lost.
"""
from app.api.media import PUBLIC


def test_every_folder_the_site_shows_pictures_from_is_public():
    # The folders storage.upload() is called with for pictures that appear on the website
    for folder in ("posts", "avatars", "covers", "blog", "countries"):
        assert f"{folder}/" in PUBLIC, folder


def test_private_folders_are_not_served():
    """CVs, proof of study and photo ID are read through their own checked routes, never here."""
    for folder in ("applications", "identity"):
        assert f"{folder}/" not in PUBLIC, folder
