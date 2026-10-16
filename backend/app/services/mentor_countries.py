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
    """Set the mentor's countries. The first is the home one, kept on the profile itself.

    The rows they already have are left alone rather than replaced. Handing the relationship a
    whole new list instead inserts a country they already had before deleting the old row, and the
    unique pair on the table rejects it: adding a second country would fail for every mentor."""
    ids = list(dict.fromkeys(community_ids))
    if not ids:
        return
    mentor.community_id = ids[0]
    have = {row.community_id: row for row in mentor.countries}
    for community_id, row in have.items():
        if community_id not in ids:
            mentor.countries.remove(row)
    for community_id in ids:
        if community_id not in have:
            mentor.countries.append(MentorCountry(community_id=community_id))


def slugs_for(mentor):
    """Their countries as slugs, home first, whatever order the rows were written in."""
    home = mentor.community_id
    rows = sorted(mentor.countries, key=lambda c: c.community_id != home)
    return [c.community.country.slug for c in rows]
