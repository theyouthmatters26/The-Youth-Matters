"""Who is on the team, and which parts of the admin panel each person may open.

The owner is the account whose email is ADMIN_EMAIL in .env: always everything, and nobody in the
panel can change or remove them. Everyone else is an account with role "admin" and a list of areas
in admin_access, which the owner chooses when adding them (for example support chat only).
"""
from flask import abort, current_app

from ..extensions import db
from ..models import ModerationLog

# area: (label, what it lets someone do)
AREAS = {
    "overview": ("Overview", "See the numbers and what needs attention"),
    "support": ("Support", "Reply to students in Ask TYM AI as a person, and read contact form messages"),
    "members": ("Members", "Look up members, verify, suspend and ban"),
    "moderation": ("Moderation", "Review reports and remove posts, answers and chat messages"),
    "community": ("Community", "Pin and remove questions, run chat rooms, edit topics and countries"),
    "blog": ("Blog", "Write, publish and remove articles"),
    "faq": ("FAQ", "Write the FAQ page and answer the questions members send in"),
    "mentors": ("Mentors", "Approve mentor applications and manage the directory"),
    "bookings": ("Bookings and payments", "See sessions, payments and mentor earnings, cancel and refund"),
    "team": ("Team", "Add admins, choose what they can open, and see what is switched on"),
}
EVERYTHING = "*"


def is_owner(user):
    owner = current_app.config["ADMIN_EMAIL"]
    return bool(owner) and user.email.lower() == owner


def access_of(user):
    """The areas this person may open, in menu order. Empty for anyone who is not on the team."""
    if user.role != "admin" or user.status != "active":
        return []
    granted = user.admin_access or []
    if is_owner(user) or EVERYTHING in granted:
        return list(AREAS)
    return [a for a in AREAS if a in granted]


def can(user, area):
    return area in access_of(user)


def moderating(user, action, kind, target_id, author, refusal):
    """For the site's own edit and delete routes when the content is somebody else's: allowed only
    for a team member with the Moderation area, and noted in the audit trail."""
    if not can(user, "moderation"):
        abort(403, refusal)
    db.session.add(ModerationLog(actor_id=user.id, action=action, target_type=kind, target_id=target_id,
                                 detail={"name": author.display_name}))


def clean_access(requested):
    """What the owner ticked, reduced to real areas. ["*"] when it is all of them."""
    if requested == EVERYTHING or EVERYTHING in (requested or []):
        return [EVERYTHING]
    chosen = [a for a in AREAS if a in (requested or [])]
    return [EVERYTHING] if len(chosen) == len(AREAS) else chosen


# The roles the panel is handed out in. Each one is a set of the areas above, so every check in the
# code stays `can(user, area)`: a role is only a convenient way to choose several at once. Someone
# whose areas do not match a role exactly is "custom", which is still perfectly valid.
ROLES = {
    "super_admin": ("Super admin", "Every part of the panel, including adding teammates and changing what they can open.",
                    [EVERYTHING]),
    "admin": ("Admin", "Runs the site day to day: members, moderation, the community, the blog, the FAQ page, "
                       "support, mentors, bookings and payments. Cannot change who is on the team.",
              [a for a in AREAS if a != "team"]),
    "mentor_admin": ("Mentor admin", "Mentor applications, the mentor directory, their sessions and what they are owed. "
                                     "Nothing about members, moderation or the rest of the site.",
                     ["overview", "mentors", "bookings"]),
    "support": ("Support", "Replies to students in Ask TYM AI and answers contact form enquiries. Nothing else.",
                ["support"]),
}


def areas_for(role):
    """The areas a named role opens, or None when the name is not one of ours."""
    return list(ROLES[role][2]) if role in ROLES else None


def role_of(user):
    """The name for what this person can open: a role when it matches one exactly, else "custom"."""
    if is_owner(user):
        return "super_admin"
    access = access_of(user)
    if not access:
        return None
    for key, (_, _, areas) in ROLES.items():
        if set(access) == set(AREAS if EVERYTHING in areas else areas):
            return key
    return "custom"
