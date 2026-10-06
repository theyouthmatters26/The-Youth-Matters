"""Demo questions and answers for the community, loaded by seed.py. Safe to re-run: a post is
created once (matched by title); old seeds that stored HTML are replaced with the plain-text version.

Comment tuples: (key, parent key or None, author username, body, score, hours ago).
"""
from datetime import datetime, timedelta, timezone

POSTS = [
    dict(title="How much money do I need to show for a UK student visa outside London?", country="uk",
         category="visas", author="aisha.k", score=42, hours=5, helpful="a1",
         body="My course is in Leeds and starts in September. Do I need to show nine months of living costs on top "
              "of the remaining tuition, and how long does the money have to sit in my account before I apply? My "
              "father is the sponsor, so it is in his account.",
         comments=[
             ("a1", None, "priya.s", "Outside London it is 1,171 GBP per month for up to nine months, so 10,539 GBP, "
              "plus whatever tuition you still owe after your deposit. The full amount has to be held for 28 "
              "consecutive days, and the statement must be dated within 31 days of your application. A parent "
              "account is fine, but include a letter of consent and your birth certificate.", 31, 4),
             ("a2", "a1", "aisha.k", "That clears it up. Does the 28 day period have to end exactly on the day I "
              "apply?", 4, 3.5),
             ("a3", "a2", "priya.s", "It has to end no more than 31 days before you submit. Most people apply a few "
              "days after the 28 days are complete.", 6, 3),
             ("a4", None, "tymai", "Summary for anyone landing here later: 10,539 GBP living costs for courses "
              "outside London, held 28 days, statement no older than 31 days. Check the latest figures on GOV.UK "
              "before you apply.", 3, 1),
         ]),
    dict(title="Private halls or a shared house for first year in Manchester?", country="uk",
         category="accommodation", author="rohan.m", score=18, hours=20,
         body="Budget is around 650 GBP a month including bills. Halls feel easier for making friends but a house "
              "near Fallowfield is cheaper. What would you pick if you were starting again?",
         comments=[
             ("b1", None, "aisha.k", "Halls for the first year, honestly. You meet people without trying, bills are "
              "included and there is nothing to sort out with a landlord from abroad. Move to a house in second year "
              "with the friends you made.", 9, 18),
             ("b2", "b1", "rohan.m", "That makes sense. Did you book through the university or a private provider?",
              2, 17),
         ]),
    dict(title="Did anyone get a graduate assistantship after admission, not with the offer?", country="usa",
         category="scholarships", author="meera.n", score=27, hours=9,
         body="My offer from a state school has no funding. Seniors say you can find GA roles once you are on "
              "campus. How realistic is that in the first semester?",
         comments=[
             ("c1", None, "sara.t", "It happens, but plan as if it will not. I found mine in week three by emailing "
              "labs and the library directly, not through the job portal. Most roles are filled before term starts, "
              "so write to your graduate coordinator now and ask what is still open. The tuition waiver that comes "
              "with it matters more than the stipend.", 22, 7),
         ]),
    dict(title="Working 24 hours a week off campus: what the new rule means in practice", country="canada",
         category="jobs", author="daniel.o", score=15, hours=30,
         body="A short write-up of how my co-op and part-time hours fit together this term, and what to check with "
              "your international student office before you take a second job.",
         comments=[
             ("d1", None, "kavya.r", "This is really useful, thank you. Does co-op time count towards the weekly "
              "limit?", 3, 26),
         ]),
    dict(title="Is it fine to mention a gap year spent preparing for exams in my personal statement?", country="uk",
         category="sops", author="rohan.m", score=9, hours=2,
         body="I took a year to prepare for JEE and it did not work out. I would rather be honest about it. Will UCAS "
              "readers see it as a weakness?", comments=[]),
    dict(title="APS certificate timeline from India in 2026, how long did yours take?", country="germany",
         category="universities", author="varun.p", score=21, hours=40,
         body="Planning for the winter intake. Trying to work out whether to book the APS interview before or after "
              "my final semester results.",
         comments=[
             ("e1", None, "kabir.s", "Mine took about seven weeks from submitting documents to getting the "
              "certificate, and waiting for the interview slot was the slow part. I applied with transcripts up to "
              "my last completed semester instead of waiting for final results. Carry every original to the "
              "interview, they checked each page.", 17, 37),
         ]),
    dict(title="Realistic rent for a room in Dublin within 40 minutes of Trinity?", country="ireland",
         category="accommodation", author="neha.j", score=12, hours=14,
         body="Listings swing between 700 and 1,400 EUR. Where are students actually living?",
         comments=[
             ("f1", None, "aditya.v", "Most of my class lives in Phibsborough, Rathmines or Drumcondra and pays 850 "
              "to 1,100 EUR for a room. Anything under 700 near the centre is usually a scam, so never pay a deposit "
              "before you have seen the room in person.", 14, 13),
         ]),
    dict(title="How long did your Canadian study permit take to come through this year?", country="canada",
         category="visas", author="kavya.r", score=24, hours=11,
         body="Applied online six weeks ago for the January intake. Biometrics done. Is it normal to hear nothing "
              "at this point?",
         comments=[
             ("g1", None, "daniel.o", "Six weeks with no news is normal, mine came through in just under eight. The "
              "biometrics appointment is usually the slow part and you are past it. Most refusals in our group were "
              "a missing provincial attestation letter or thin proof of funds, so check both are in your upload "
              "while you wait.", 20, 9),
         ]),
    dict(title="Has the GTE statement really been replaced by the Genuine Student questions?", country="australia",
         category="visas", author="ishaan.g", score=19, hours=26,
         body="Older blogs still talk about a 300 word GTE statement. My application form shows separate questions "
              "instead. Which one is right?",
         comments=[
             ("h1", None, "hannah.l", "Yes, the single statement is gone. You now answer a few Genuine Student "
              "questions inside the application: why this course, why this provider, and how it fits what you have "
              "done so far. Keep each answer specific and in your own words.", 16, 24.5),
         ]),
    dict(title="Blocked account provider: Expatrio, Fintiba or Coracle, does it matter?", country="germany",
         category="visas", author="varun.p", score=14, hours=28,
         body="All three seem to be accepted by the embassy. Is there any real difference in fees or in how fast "
              "the confirmation letter comes?",
         comments=[
             ("i1", None, "kabir.s", "For the visa itself they all work. Compare the monthly fee and how quickly they "
              "issue the confirmation after your transfer lands, because that letter is what you book the "
              "appointment with. Check the current list on the German mission's website before you choose.", 8, 25),
         ]),
    dict(title="How many hours can students really work in Germany, and do Werkstudent jobs count differently?",
         country="germany", category="jobs", author="tanvi.d", score=11, hours=50,
         body="I keep reading different numbers of full days and half days per year, and that working student jobs "
              "follow other rules. Can someone who has done it explain how it works in practice?", comments=[]),
    dict(title="F-1 interview in Mumbai next week, what did they actually ask you?", country="usa", category="visas",
         author="farhan.a", score=33, hours=16,
         body="I am prepared for funding and why this university, but nervous about questions on my plans after "
              "graduation. What came up in yours?",
         comments=[
             ("j1", None, "sara.t", "Mine lasted under three minutes: why this programme, who is paying, and what I "
              "would do after. Answer in one or two clear sentences each and keep your documents ready but do not "
              "offer them unless asked. Practise saying your plan out loud.", 25, 14),
             ("j2", "j1", "meera.n", "Same for me. They also asked what my parents do, so know the sponsor details "
              "by heart.", 7, 12),
         ]),
    dict(title="Is on-campus housing worth it for the first semester?", country="usa", category="accommodation",
         author="meera.n", score=8, hours=60,
         body="Off-campus is about 300 USD a month cheaper near my university, but I have no credit history and no "
              "car.", comments=[]),
    dict(title="How long did it take you to find part-time work in Dublin?", country="ireland", category="jobs",
         author="aditya.v", score=16, hours=30,
         body="Arriving in September with retail experience from back home. Is it realistic to find something in the "
              "first month?", comments=[]),
    dict(title="Do I need my IRP appointment booked before I land?", country="ireland", category="visas",
         author="neha.j", score=9, hours=70,
         body="The portal shows no slots for weeks. Is it a problem if my first appointment is after my course "
              "starts?", comments=[]),
    dict(title="Rooms near UNSW for under 400 AUD a week, realistic?", country="australia",
         category="accommodation", author="sneha.k", score=13, hours=18,
         body="Looking at Kensington and Kingsford, but most listings are well above my budget. Where do students "
              "actually find rooms?", comments=[]),
    dict(title="Is the fortnightly work-hours limit counted strictly during exam weeks?", country="australia",
         category="jobs", author="ishaan.g", score=10, hours=44,
         body="My course starts in February and I have a part-time offer. I want to understand the rule properly "
              "before I say yes.", comments=[]),
    dict(title="Best way to find a room in Toronto before arriving?", country="canada", category="accommodation",
         author="kavya.r", score=12, hours=36,
         body="I am wary of paying a deposit to someone I have never met. How did you find your first place?",
         comments=[]),
]


def seed_posts(db, models):
    Category, Comment, Community, Post, User = (models[k] for k in ("Category", "Comment", "Community", "Post", "User"))
    now = datetime.now(timezone.utc)
    users = {u.username: u for u in db.session.scalars(db.select(User))}
    cats = {c.slug: c for c in db.session.scalars(db.select(Category))}
    communities = {c.country.slug: c for c in db.session.scalars(db.select(Community))
                   if c.subject.slug == "study-abroad"}

    for spec in POSTS:
        post = db.session.scalar(db.select(Post).where(Post.title == spec["title"]))
        if post and not post.body.startswith("<"):
            continue  # already seeded with the current content
        if post:  # an older seed that stored HTML: replace its body and answers
            post.helpful_comment_id = None
            db.session.flush()
            db.session.execute(db.delete(Comment).where(Comment.post_id == post.id))
        else:
            post = Post(title=spec["title"])
            db.session.add(post)
        post.author, post.community, post.category = users[spec["author"]], communities[spec["country"]], cats[spec["category"]]
        post.body, post.score, post.upvotes = spec["body"], spec["score"], spec["score"] + 1
        post.downvotes, post.comment_count = 1, len(spec["comments"])
        post.created_at = post.updated_at = now - timedelta(hours=spec["hours"])
        db.session.flush()

        made = {}
        for key, parent, author, body, score, hours in spec["comments"]:
            parent_comment = made.get(parent)
            c = Comment(post=post, author=users[author], body=body, score=score, upvotes=score,
                        parent_id=parent_comment.id if parent_comment else None,
                        depth=parent_comment.depth + 1 if parent_comment else 0)
            c.created_at = c.updated_at = now - timedelta(hours=hours)
            db.session.add(c)
            db.session.flush()
            made[key] = c
        if spec.get("helpful"):
            post.helpful_comment_id = made[spec["helpful"]].id
    db.session.commit()
