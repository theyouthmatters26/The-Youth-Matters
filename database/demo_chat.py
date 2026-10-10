"""The chat rooms every site starts with (one open room plus one per country) and, for the demo,
a short conversation in each. Safe to re-run: a room is created once and never changed afterwards, so
names edited in the admin panel are kept; demo messages are only added to empty rooms."""
from datetime import datetime, timedelta, timezone

# slug, name, description, country community (None for the open room)
ROOMS = [
    ("study-abroad", "Study Abroad", "Open room for every destination. Say hello, share wins, ask anything.", None),
    ("uk", "United Kingdom", "CAS, visas, housing and life in the UK.", "uk"),
    ("usa", "United States", "Applications, F-1 interviews, funding and campus life.", "usa"),
    ("canada", "Canada", "Study permits, PAL, co-op and the first winter.", "canada"),
    ("australia", "Australia", "Subclass 500, Genuine Student answers and part-time work.", "australia"),
    ("ireland", "Ireland", "Stamp 2, Dublin housing and the graduate route.", "ireland"),
    ("germany", "Germany", "APS, blocked accounts, uni-assist and WG rooms.", "germany"),
    ("france", "France", "Campus France, student visas, CAF and finding a room.", "france"),
]

# room: [(author, body, minutes ago)]
MESSAGES = {
    "study-abroad": [
        ("farhan.a", "Got my I-20 from Arizona State this morning. Took 11 days after I sent the bank letter.", 190),
        ("neha.j", "Congrats! Did they want the letter in a specific format?", 182),
        ("farhan.a", "Just on bank letterhead with the balance and date. They rejected my first one because it "
                     "was a screenshot.", 175),
        ("sneha.k", "Good to know. Anyone else flying out in February? Trying to find people for the Sydney flight.", 64),
        ("ishaan.g", "Me, Melbourne though. Same week probably. Let's make a group closer to the date.", 41),
    ],
    "uk": [
        ("rohan.m", "Anyone else waiting on a CAS from Manchester? Paid my deposit 9 days ago.", 140),
        ("aisha.k", "Mine took 12 working days from Leeds. They emailed a pre-CAS checklist first.", 131),
        ("priya.s", "If it goes past 15 working days, email international admissions with your student ID. "
                    "They usually reply within two days.", 118),
        ("rohan.m", "Thanks Priya, will give it till Friday.", 109),
        ("aisha.k", "Also check your spam folder. The pre-CAS email from Leeds landed there for me.", 22),
    ],
    "usa": [
        ("meera.n", "F-1 interview slots in Mumbai just opened for next month. Grab them fast.", 300),
        ("sara.t", "Practise saying why this programme and how you will pay for it in under 30 seconds each. "
                   "That is most of the interview.", 284),
        ("farhan.a", "Did anyone get asked about their LORs? My friend was.", 250),
        ("meera.n", "Not me. Mostly funding and what I will do after graduating.", 236),
    ],
    "canada": [
        ("kavya.r", "Study permit approved! 7 weeks from biometrics.", 420),
        ("daniel.o", "Congratulations. Book your flight to land a week before orientation, the first week goes "
                     "on SIN, bank and a phone plan.", 402),
        ("kavya.r", "Is a winter jacket from India enough for Toronto in January?", 380),
        ("daniel.o", "Honestly, no. Buy one here at a Canadian Tire or Uniqlo, it is cheaper than you think.", 371),
    ],
    "australia": [
        ("ishaan.g", "Does anyone know if Monash accepts the OSHC from any provider or only their partner?", 260),
        ("hannah.l", "Any approved OSHC provider works. The partner one is just the default on the offer form.", 244),
        ("sneha.k", "Bupa was cheapest for me for a single policy, about 10% less than the partner quote.", 230),
    ],
    "ireland": [
        ("neha.j", "Dublin housing is wild. 18 viewings, zero offers so far.", 520),
        ("aditya.v", "Look at Maynooth or Bray. The train is 40 minutes and rent is about a third lower.", 505),
        ("neha.j", "Did you have to show a PPS number to rent?", 498),
        ("aditya.v", "No, a passport, college letter and a reference from your bank were enough.", 480),
    ],
    "germany": [
        ("varun.p", "APS interview booked for the 14th. Any tips?", 610),
        ("kabir.s", "They ask about subjects from your transcript. Revise your core second and third year courses.", 596),
        ("tanvi.d", "They asked me to explain my final year project in detail. Keep it simple and honest.", 571),
        ("varun.p", "Thanks both. Also, Fintiba or Expatrio for the blocked account?", 540),
        ("tanvi.d", "Expatrio for me, the health insurance bundle made it simpler.", 512),
    ],
}


def seed_chat(db, models, messages=True):
    ChatMessage, ChatRoom, Community, Subject, User = (
        models[k] for k in ("ChatMessage", "ChatRoom", "Community", "Subject", "User"))
    now = datetime.now(timezone.utc)
    users = {u.username: u for u in db.session.scalars(db.select(User))}
    subject = db.session.scalar(db.select(Subject).where(Subject.slug == "study-abroad"))
    communities = {c.country.slug: c for c in db.session.scalars(db.select(Community))
                   if c.subject.slug == "study-abroad"}

    for slug, name, description, country in ROOMS:
        room = db.session.scalar(db.select(ChatRoom).where(ChatRoom.slug == slug))
        if not room:
            room = ChatRoom(slug=slug, name=name, description=description, subject=subject, community=communities.get(country))
            db.session.add(room)
            db.session.flush()
        if not messages or db.session.scalar(db.select(ChatMessage.id).where(ChatMessage.room_id == room.id).limit(1)):
            continue
        for author, body, minutes in MESSAGES.get(slug, ()):  # a new room starts empty
            db.session.add(ChatMessage(room_id=room.id, author_id=users[author].id, body=body,
                                       created_at=now - timedelta(minutes=minutes)))
    db.session.commit()
