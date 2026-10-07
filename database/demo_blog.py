"""The first blog articles (blog_articles.json), loaded into the database so the admin panel can edit
them like any other. Safe to re-run: an article is only written if it is missing or was never filled
in, so changes made in the panel are kept.

Two of them are written in the voice of a demo mentor. On a live site those people do not exist, so
there (team_only) every guide is credited to the TYM team; change the writer in the Blog editor."""
import json
from datetime import datetime, timezone
from pathlib import Path

ARTICLES = json.loads((Path(__file__).parent / "blog_articles.json").read_text(encoding="utf-8"))


def _day(iso):
    return datetime.fromisoformat(iso).replace(hour=9, tzinfo=timezone.utc)


def seed_blog(db, models, team_only=False):
    BlogPost, Subject, User = (models[k] for k in ("BlogPost", "Subject", "User"))
    subject = db.session.scalar(db.select(Subject).where(Subject.slug == "study-abroad"))
    users = {u.username: u for u in db.session.scalars(db.select(User))}
    team = next(a["author"] for a in ARTICLES if a["author"].get("username") == "tym.team")

    for a in ARTICLES:
        post = db.session.scalar(db.select(BlogPost).where(BlogPost.slug == a["slug"]))
        if post and post.meta:
            continue  # already in place, perhaps edited since
        post = post or BlogPost(slug=a["slug"], subject_id=subject.id)
        writer = users.get(a["author"].get("username")) or users["tym.team"]
        post.author_id, post.title, post.excerpt, post.body = writer.id, a["title"], a["excerpt"][:300], a["source"]
        post.published_at, post.updated_at = _day(a["published"]), _day(a["updated"])
        post.meta = {key: a[key] for key in ("seoTitle", "description", "topic", "keywords", "image", "imageAlt", "author",
                                             "takeaways", "faqs") if key in a}
        if team_only:
            post.meta["author"] = team
        post.meta["sources"] = a.get("sources", [])
        post.meta["readMins"] = max(1, round(len(a["source"].split()) / 220))
        db.session.add(post)
    db.session.commit()
