"""What a new database needs before the site works, and optionally a demo community to look at.

    cd backend
    python ../database/seed.py           a live site: subjects, countries, topics, chat rooms, the TYMAi
                                         account and the three starter guides. No people, no passwords.
    python ../database/seed.py --demo    your own computer: all of that plus demo students, mentors,
                                         questions and chat, every demo account on the password below.

Never run --demo against a live database: the demo password is published in the README, and the demo
mentors would be bookable for real money. Safe to re-run either way: what exists is left alone, and
with --demo the demo people and mentors are brought up to date.
"""
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import bcrypt

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models import (BlogPost, Category, ChatMessage, ChatRoom, Comment, Community, Country,  # noqa: E402
                        Follow, MentorProfile, MentorReview, Post, Subject, User)
from demo_blog import seed_blog  # noqa: E402
from demo_chat import seed_chat  # noqa: E402
from demo_posts import seed_posts  # noqa: E402

PHOTOS = Path(__file__).resolve().parents[1] / "frontend" / "public" / "images" / "people"

# Phase 1 launches Study Abroad. The rest exist so the hierarchy is ready; they show as "coming soon".
SUBJECTS = [
    ("study-abroad", "Study Abroad", "Universities, visas, money and life in a new country.", True),
    ("career", "Career", "First jobs, internships and switching fields.", False),
    ("education", "Education", "Courses, exams and choosing what to study.", False),
    ("entrepreneurship", "Entrepreneurship", "Starting and running something of your own.", False),
    ("life", "Life & Experiences", "Everything else that comes with growing up.", False),
]
COUNTRIES = [
    ("uk", "United Kingdom", "GB", "Universities, visas, housing and life in the UK."),
    ("usa", "United States", "US", "Applications, F-1 visas, funding and campus life in the US."),
    ("canada", "Canada", "CA", "Study permits, co-op programmes and PR pathways."),
    ("australia", "Australia", "AU", "Subclass 500 visas, scholarships and part-time work."),
    ("ireland", "Ireland", "IE", "Stamp 2 visas, Dublin housing and graduate routes."),
    ("germany", "Germany", "DE", "Tuition-free programmes, blocked accounts and APS."),
]
CATEGORIES = [
    ("visas", "Visas"), ("scholarships", "Scholarships"), ("accommodation", "Accommodation"),
    ("sops", "SOPs"), ("universities", "Universities"), ("jobs", "Part-time work"),
]


MODELS = {"BlogPost": BlogPost, "Category": Category, "ChatMessage": ChatMessage, "ChatRoom": ChatRoom, "Comment": Comment,
          "Community": Community, "Post": Post, "Subject": Subject, "User": User}

# Local demo accounts only (example.com addresses), e.g. aisha.k@example.com
DEMO_PASSWORD = "tym-demo-2026"


def demo_logins():
    """Give the seeded people a password so the log-in page works locally. Safe to re-run."""
    hashed = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode()
    for u in db.session.scalars(db.select(User).where(
            User.role != "bot", User.password_hash.is_(None), User.email.like("%@example.com"))):
        u.password_hash = hashed
    db.session.commit()


def user(username, name, role="student", **kw):
    return User(username=username, display_name=name, email=f"{username}@example.com",
                role=role, status="active", email_verified=True,
                date_of_birth=kw.pop("dob", date(2002, 4, 12)), **kw)


def ensure_user(username, name, role="student", bio=None, **profile):
    """Demo member by username, created if missing. Gets their portrait if one is in the site."""
    u = db.session.scalar(db.select(User).where(User.username == username))
    if not u:
        u = user(username, name, role=role)
        db.session.add(u)
    u.display_name, u.role, u.bio = name, role, bio or u.bio
    for field, value in profile.items():
        setattr(u, field, value)
    if (PHOTOS / f"{username}.jpg").exists():
        u.avatar_url = f"/images/people/{username}.jpg"
    return u


# username, name, bio, destination, study level, university, course, intake
STUDENTS = [
    ("aisha.k", "Aisha Khan", "MSc Marketing offer from Leeds. Sorting out my visa file.", "uk", "postgraduate",
     "University of Leeds", "MSc Marketing", "September 2026"),
    ("rohan.m", "Rohan Mehta", "Undergrad, CS. Manchester or Glasgow, still deciding.", "uk", "undergraduate",
     "University of Manchester", "BSc Computer Science", "September 2026"),
    ("meera.n", "Meera Nair", "Applying for Fall intake in the US.", "usa", "postgraduate",
     None, "MS Data Analytics", "Fall 2027"),
    ("kavya.r", "Kavya Reddy", "Accepted at Humber College for January.", "canada", "postgraduate",
     "Humber College", "Graduate Certificate, Project Management", "January 2027"),
    ("ishaan.g", "Ishaan Gupta", "Master of IT offer from Monash.", "australia", "postgraduate",
     "Monash University", "Master of Information Technology", "February 2027"),
    ("varun.p", "Varun Pillai", "Applying to TU Munich and RWTH for the winter intake.", "germany", "postgraduate",
     None, "MSc Mechanical Engineering", "Winter 2026"),
    ("neha.j", "Neha Joshi", "Starting an MSc at Trinity College Dublin in September.", "ireland", "postgraduate",
     "Trinity College Dublin", "MSc Business Analytics", "September 2026"),
    ("aditya.v", "Aditya Verma", "MSc Computer Science at Trinity. Moved to Dublin in 2025.", "ireland",
     "postgraduate", "Trinity College Dublin", "MSc Computer Science", "September 2025"),
    ("tanvi.d", "Tanvi Deshpande", "Admitted to RWTH Aachen for an MSc in Robotics.", "germany", "postgraduate",
     "RWTH Aachen University", "MSc Robotics", "Winter 2026"),
    ("farhan.a", "Farhan Ali", "MS Computer Science offer from Arizona State.", "usa", "postgraduate",
     "Arizona State University", "MS Computer Science", "Fall 2026"),
    ("sneha.k", "Sneha Kulkarni", "Starting a Master of Public Health in Sydney.", "australia", "postgraduate",
     "University of Sydney", "Master of Public Health", "February 2027"),
]

# Weekly hours are in each mentor's own time zone, picked to land in Indian evenings and weekends.
MENTORS = [
    dict(username="priya.s", name="Priya Sharma", country="uk", university="University of Leeds",
         course="MSc Data Science", year=2025, minutes=30, timezone="Europe/London",
         languages=["English", "Hindi", "Telugu"],
         headline="I review SOPs line by line and check UK visa files before you submit.",
         about="I moved from Hyderabad to Leeds in 2024 for an MSc in Data Science, and spent most of that "
               "first year answering the same questions for friends back home: how much money to show, which "
               "documents the CAS team really needs, how to find a room that is not a scam. Now I do it properly. "
               "I read your SOP twice before we meet, so our time goes on fixing it, not reading it.",
         experience="Data analyst intern at a Leeds fintech. Two years of reviewing SOPs for juniors.",
         topics=["SOP and personal statement review", "UK student visa funds and documents",
                 "CAS and pre-CAS checks", "Finding housing in Leeds", "Choosing a Data Science course"],
         hours={"mon": ["14:00", "15:00"], "wed": ["14:00", "15:00"], "sat": ["10:00", "11:00", "14:00"],
                "sun": ["11:00"]},
         reviews=[("aisha.k", 5, "Priya caught two problems in my funds evidence that would have got my visa "
                                 "refused. Clear, kind and very practical.", 12),
                  ("rohan.m", 5, "She rewrote the opening of my SOP with me during the call instead of just "
                                 "giving notes. Got my Manchester offer a month later.", 40),
                  ("meera.n", 4, "Very helpful on CAS. We ran short on time for my housing questions, but she "
                                 "sent notes afterwards.", 75)]),
    dict(username="arjun.r", name="Arjun Rao", country="uk", university="King's College London",
         course="LLM International Law", year=2025, minutes=30, timezone="Europe/London",
         languages=["English", "Hindi", "Kannada"],
         headline="London living costs, part-time work and law applications, from someone doing all three.",
         about="I came to London from Bengaluru for an LLM and work part-time at a legal aid clinic. I can tell you "
               "what London really costs month to month, how to find work that fits the 20 hour limit, and how "
               "law schools read an application.",
         experience="Part-time caseworker at a legal aid clinic in Southwark.",
         topics=["LLM and law school applications", "Real London living costs", "Part-time work within visa rules",
                 "Graduate Route planning", "Writing a legal CV"],
         hours={"tue": ["14:30", "15:30"], "thu": ["14:30", "15:30"], "sat": ["12:00", "13:00"]},
         reviews=[("kavya.r", 5, "His spreadsheet of his own London costs was worth the session on its own.", 9),
                  ("varun.p", 5, "Straight answers on part-time work and what is allowed. No sugar-coating.", 33)]),
    dict(username="daniel.o", name="Daniel Okafor", country="canada", university="Toronto Metropolitan University",
         course="BEng Computer Engineering", year=2027, minutes=30, timezone="America/Toronto",
         languages=["English"],
         headline="Co-op job search, study permits and your first month in Toronto.",
         about="Third-year computer engineering student and co-op intern. I came to Toronto from Lagos, so I went "
               "through the study permit, the first winter and the co-op hunt with nobody to ask. Since then I have "
               "helped about forty students settle in, and I keep a running list of what catches people out.",
         experience="Co-op software intern. Peer mentor for incoming international students.",
         topics=["Study permit and PAL", "Co-op and internship search", "Your first month in Toronto",
                 "Budgeting for rent and transit", "Engineering programmes in Ontario"],
         hours={"tue": ["08:00", "09:00"], "fri": ["08:00", "09:00"], "sat": ["09:00", "10:00", "11:00"]},
         reviews=[("kavya.r", 5, "Daniel walked me through my PAL and proof of funds, and my permit came through "
                                 "three weeks later.", 18),
                  ("ishaan.g", 4, "Good practical advice on co-op, even though I ended up choosing Australia.", 51)]),
    dict(username="sara.t", name="Sara Thomas", country="usa", university="Northeastern University",
         course="MS Information Systems", year=2026, minutes=45, timezone="America/New_York",
         languages=["English", "Malayalam", "Hindi"],
         headline="US shortlists, funding and F-1 interview practice.",
         about="I got into four of six US programmes with a partial scholarship, applying from Kochi without a "
               "consultant. I help you build a shortlist that fits your profile and budget, find assistantships, "
               "and practise the F-1 interview until your answers sound like you.",
         experience="Graduate assistant in the Information Systems department.",
         topics=["Building a realistic US shortlist", "Scholarships and assistantships", "F-1 interview practice",
                 "SOP and LOR strategy", "Boston living costs"],
         hours={"tue": ["08:30", "09:30"], "thu": ["08:30", "09:30"], "sat": ["09:00", "10:00"]},
         reviews=[("meera.n", 5, "The mock F-1 interview was tougher than the real one. I walked in calm.", 6),
                  ("aditya.v", 5, "Her shortlist logic saved me application fees on three schools I had no "
                                  "chance at.", 28),
                  ("rohan.m", 5, "Honest about my profile, which is what I needed.", 64)]),
    dict(username="kabir.s", name="Kabir Singh", country="germany", university="TU Munich",
         course="MSc Mechanical Engineering", year=2026, minutes=30, timezone="Europe/Berlin",
         languages=["English", "Hindi", "Punjabi", "German"],
         headline="APS, blocked accounts and finding a WG room in Munich.",
         about="I cleared APS in 2025 and work as a working student at an automotive supplier. Germany rewards "
               "people who understand the paperwork early. I will help you plan APS, uni-assist and the blocked "
               "account in the right order, and tell you honestly how hard the Munich housing market is.",
         experience="Working student, powertrain testing.",
         topics=["APS certificate planning", "uni-assist applications", "Blocked account and health insurance",
                 "Finding a WG room", "Working student jobs"],
         hours={"mon": ["15:00", "16:00"], "wed": ["15:00", "16:00"], "sat": ["11:00", "12:00"]},
         reviews=[("varun.p", 5, "His APS timeline was spot on. I booked my interview the week after our call.", 14),
                  ("meera.n", 4, "Useful even for a quick comparison with the US. Very organised.", 90)]),
    dict(username="hannah.l", name="Hannah Lee", country="australia", university="University of Melbourne",
         course="Master of Teaching", year=2026, minutes=30, timezone="Australia/Melbourne",
         languages=["English", "Korean"],
         headline="Genuine Student answers and Subclass 500 checklists.",
         about="I taught secondary school in Seoul before moving to Melbourne to train as a teacher here. I have "
               "helped classmates from India, Vietnam and Korea with their visa applications, especially the "
               "Genuine Student questions, which reward specific, honest answers over templates.",
         experience="Former secondary school teacher. Student ambassador for international admissions.",
         topics=["Genuine Student answers", "Subclass 500 document checklist", "Health cover and finances",
                 "Teaching and education degrees", "Settling in Melbourne"],
         hours={"tue": ["19:00", "20:00"], "thu": ["19:00", "20:00"], "sat": ["14:00", "15:00"]},
         reviews=[("ishaan.g", 5, "Hannah read my GS answers and asked the questions a case officer would. "
                                  "Visa granted in 19 days.", 21),
                  ("neha.j", 4, "Calm, thorough and quick to reply after the session.", 47)]),
]


def seed_people():
    """Demo students and mentors with full profiles, weekly hours and reviews. Re-run safe."""
    communities = {c.country.slug: c for c in db.session.scalars(db.select(Community))
                   if c.subject.slug == "study-abroad"}
    countries = {c.slug: c for c in db.session.scalars(db.select(Country))}
    for username, name, bio, country, level, university, course, intake in STUDENTS:
        u = ensure_user(username, name, bio=bio, target_country=countries[country], study_level=level,
                        university=university, course=course, intake=intake)
        db.session.flush()
        if not db.session.scalar(db.select(Follow.id).filter_by(user_id=u.id, community_id=communities[country].id)):
            db.session.add(Follow(user_id=u.id, community_id=communities[country].id))  # joined where they are going
    now = datetime.now(timezone.utc)
    for spec in MENTORS:
        u = ensure_user(spec["username"], spec["name"], role="mentor",
                        bio=f"{spec['course']}, {spec['university']}.")
        db.session.flush()
        m = db.session.scalar(db.select(MentorProfile).where(MentorProfile.user_id == u.id)) or MentorProfile(user=u)
        m.community = communities[spec["country"]]
        m.university, m.course, m.graduation_year = spec["university"], spec["course"], spec["year"]
        m.headline, m.about, m.experience = spec["headline"], spec["about"], spec["experience"]
        m.topics, m.languages, m.links = spec["topics"], spec["languages"], {"linkedin": "https://www.linkedin.com"}
        m.session_minutes = spec["minutes"]
        m.timezone, m.weekly_hours, m.is_verified = spec["timezone"], spec["hours"], True
        db.session.add(m)
        db.session.flush()
        if not db.session.scalar(db.select(MentorReview.id).where(MentorReview.mentor_id == m.id).limit(1)):
            for author, rating, body, days in spec["reviews"]:
                reviewer = db.session.scalar(db.select(User).where(User.username == author))
                db.session.add(MentorReview(mentor_id=m.id, author=reviewer, rating=rating, body=body,
                                            created_at=now - timedelta(days=days)))
    db.session.commit()


def reference():
    """What the site cannot work without. Added once; a later run changes nothing here."""
    if db.session.scalar(db.select(Subject).limit(1)):
        return
    subjects = {slug: Subject(slug=slug, name=n, description=d, is_active=a, sort_order=i)
                for i, (slug, n, d, a) in enumerate(SUBJECTS)}
    countries = {slug: Country(slug=slug, name=n, iso_code=c) for slug, n, c, _ in COUNTRIES}
    abroad = {slug: Community(subject=subjects["study-abroad"], country=countries[slug], description=d, sort_order=i)
              for i, (slug, _, _, d) in enumerate(COUNTRIES)}
    cats = {s: Category(slug=s, name=n) for s, n in CATEGORIES}
    db.session.add_all([*subjects.values(), *countries.values(), *abroad.values(), *cats.values()])

    bot = user("tymai", "TYMAi", role="bot", dob=date(2000, 1, 1))
    # The name on TYM's own guides. It has no password and no part of the admin panel, so nobody signs in as it.
    team = user("tym.team", "TYM Team", role="admin", dob=date(1995, 1, 1))
    db.session.add_all([bot, team])
    db.session.commit()


def run(demo=False):
    reference()
    if demo:
        seed_people()
        seed_posts(db, MODELS)
    seed_chat(db, MODELS, messages=demo)
    seed_blog(db, MODELS, team_only=not demo)
    if demo:
        demo_logins()
    print("Demo community is in place." if demo else "The site's reference data is in place. No demo accounts were made.")


if __name__ == "__main__":
    with create_app().app_context():
        run(demo="--demo" in sys.argv)
