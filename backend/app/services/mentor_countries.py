"""Which countries a mentor is listed under (models/mentor.py MentorCountry).

One place writes these rows, because four screens choose them: the application form, approving an
application, the mentor's own settings and the team adding a mentor by hand. The home country on
the profile always has a row here too, so the directory filter only ever looks in one place.
"""
from ..extensions import db
from ..models import Community, Country, MentorCountry, Subject

MOST = 12  # a mentor advising on more than a dozen countries is a list, not a mentor


def communities(slugs, subject="study-abroad"):
    """The live communities for these country slugs, in the order asked for. Unknown or inactive
    slugs are dropped, so a stale form cannot list a mentor somewhere that does not exist."""
    wanted = [s for s in dict.fromkeys(str(x or "").strip().lower() for x in (slugs or [])) if s][:MOST]
    if not wanted:
        return []
    found = {c.country.slug: c for c in db.session.scalars(
        db.select(Community).join(Subject).join(Country).where(
            Subject.slug == subject, Country.slug.in_(wanted), Community.is_active))}
    return [found[s] for s in wanted if s in found]


def set_for(mentor, community_ids):
    """Replace the mentor's countries. The first is the home one, kept on the profile itself."""
    ids = list(dict.fromkeys(community_ids))
    if not ids:
        return
    mentor.community_id = ids[0]
    mentor.countries = [MentorCountry(community_id=cid) for cid in ids]
