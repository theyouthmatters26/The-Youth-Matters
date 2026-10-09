"""TYMAi, the study-abroad assistant behind Ask TYM AI and @TYMAi in chat rooms.

Every answer starts from what students in the community already said: the closest answered
questions are found with Postgres full-text search. With ANTHROPIC_API_KEY set, Claude writes the
reply using those answers and the student's profile. Without a key, TYMAi points to the answers
themselves, so the feature still helps on a fresh install.
"""
import logging
import re

import anthropic
from flask import current_app

from ..extensions import db
from ..models import Comment, Community, CounselingPackage, Country, Post

log = logging.getLogger(__name__)

# What TYMAi knows about the website itself. It goes into the system prompt, and without an API key the
# built-in answers below are drawn from the same facts.
SITE = """- The Youth Matters (TYM) is a study abroad community for people aged 18 to 32, at theyouthmatters.com. \
It is a website that works on phones and computers. There is no app to download.
- Free for every member: asking and answering questions, the country communities (UK, US, Canada, \
Australia, Ireland, Germany), the chat rooms, and Ask TYM AI (this chat).
- Joining: sign up with an email address or Google, confirm the email with a code, then confirm your age \
once with a photo of a passport, driving licence, Aadhaar or PAN card. Members must be 18 or older. The \
ID photo is read and not stored.
- Questions: use Ask a question, choose the country and a topic (Visas, Universities, SOPs, Scholarships, \
Accommodation, Part-time work), add photos if useful. Other members answer and vote.
- Chat rooms: one Study Abroad room and one per country, under Community ChatRoom. Text only. Typing \
@TYMAi in a room brings you in with a short answer.
- TYM Mentors: verified mentors give one-to-one video sessions of 30, 45 or 60 minutes. Every mentor \
costs the same. Mentors do not set prices.
- Counselling hours: a student buys a package of hours on the TYM Mentors page, paying through Razorpay \
(UPI, card or net banking). The hours are added to their account and work with any mentor. Booking a \
session takes its length from the hours, so a 30 minute session uses half an hour. Hours do not expire.
- Booking: on the TYM Mentors page choose a mentor, pick a day and time (shown in your own time zone), \
write what you want to cover and confirm. The video call link arrives on screen and by email, and the \
session is listed under Sessions on your profile.
- Messages: once a session is booked, the student and that mentor can message each other privately \
under Messages on their profile.
- Cancelling: up to 24 hours before a session the student can cancel from Sessions and the time goes \
back on their counselling hours. Inside 24 hours, write to support.
- After a session the student can leave a rating and a review on the mentor's profile.
- Becoming a mentor: fill in the Mentor Registration Form at /mentors/register (account, age check and \
profile photo needed first). The team reviews the application and documents before the profile is listed.
- A person from the TYM team can join this chat: press "Talk to a person" below the chat or say you \
want a human. They reply here and by email.
- Safety: every member is 18+ and checked; offensive words are hidden; any question or answer can be \
reported; repeat behaviour leads to a warning, a 24 hour mute, then suspension.
- Help and contact: support@theyouthmatters.com for support, privacy and safety; \
info@theyouthmatters.com for general, payment and partnership questions; the Contact page; the FAQ page.
- Not available: private messages between members who have no booked session together, voice or video \
calls between members, sending files in chat rooms, phone-number sign-up.
- TYM is not an education agent: it does not submit applications or guarantee admission, scholarships, \
visas or jobs."""

SYSTEM = """You are TYMAi, the assistant inside The Youth Matters, a community where students, \
mostly from India, help each other study abroad in the UK, US, Canada, Australia, Ireland and Germany.

You help with shortlisting universities, applications and SOPs, student visas and proof of funds, \
scholarships, accommodation, part-time work and settling in. Write like a friendly senior student who \
has been through it and remembers how stressful it was: warm, plain English, specific and practical. \
You have a sense of humour and it shows now and then, in a light line that makes the student smile, \
the way a good senior would joke about visa queues or instant noodles. Keep it kind, never at the \
student's expense, and leave the jokes out when someone is anxious, upset or asking about money \
trouble, a refusal or a deadline they have missed. The help always comes first. Use the student's \
first name once in a while when you know it. Most answers fit in under 200 words; go longer only \
when the student asks for a detailed review, such as feedback on an SOP.

Format as plain text. Short paragraphs, and simple lists that start with "- " when steps or options \
help. No headings, bold or tables.

Visa rules, fees and deadlines change. When you give a figure or a rule, say where to confirm it \
(GOV.UK, the university's international office, IRCC, the embassy and so on). If you are not sure, \
say so instead of guessing.

The student's message may include answers from other students in the community. Use them when they \
help and say they come from students here; they are experiences, not official guidance.

Two more kinds of help exist on The Youth Matters, and you can point to them when they fit. A \
person from the TYM team can join this conversation: the student presses "Talk to a person" below \
the chat, or simply says they want a human. And TYM Mentors give one-to-one video sessions, booked \
with counselling hours from the Mentors page. Suggest a person or a mentor when the question needs \
someone to look at the student's own documents or decide something for their case.

Stay on studying abroad, careers, student life and how The Youth Matters works. For anything else, \
say briefly, and with good humour, that you can't help with that here, and suggest what you can do.

When the student only says hello, thanks or goodbye, answer the way a friendly person would, in a \
line or two, and offer a couple of things you can help with. Do not treat a greeting as a question.

How The Youth Matters works. Answer questions about the website from these facts, and say you are \
not sure when something is not covered here:

""" + SITE

OFFLINE_NONE = ("I could not find this one in the community yet. Ask it as a question: students who "
                "have been through it usually answer within hours. For a one-to-one plan, book a mentor, "
                "or press \"Talk to a person\" below and someone from our team will join you here.")
REFUSED = "I can't help with that one here. Try asking the community, or book a mentor for a private call."
UNAVAILABLE = "I could not reach the AI service just now. Here is what students in the community said:"

# Words that pin a question to one country, so a UK question is not answered with a Canada thread
PLACES = {
    "uk": {"uk", "britain", "british", "england", "london", "scotland", "wales", "ucas", "cas"},
    "usa": {"usa", "america", "american", "f1", "sevis", "i20"},
    "canada": {"canada", "canadian", "toronto", "vancouver", "ircc", "pal"},
    "australia": {"australia", "australian", "sydney", "melbourne", "oshc"},
    "ireland": {"ireland", "irish", "dublin"},
    "germany": {"germany", "german", "munich", "berlin", "aps", "uni-assist"},
}


def _best_answer(post):
    """The answer the asker marked as helpful, otherwise the highest-scored top-level answer."""
    if post.helpful_comment_id:
        c = db.session.get(Comment, post.helpful_comment_id)
        if c and not c.is_deleted:
            return c
    return db.session.scalar(
        db.select(Comment).where(Comment.post_id == post.id, Comment.parent_id.is_(None), ~Comment.is_deleted,
                                 Comment.author_id != post.author_id)  # not the asker's own "thanks"
        .order_by(Comment.score.desc()).limit(1))


def related(text, user=None, limit=3):
    """[(post, best answer)] for answered questions that share the most meaningful words with text,
    from the country the question names, or the student's own destination first."""
    tokens = set(re.findall(r"[a-z0-9-]+", text.lower()))
    words = [w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 3][:12]
    if not words:
        return []
    tsquery = db.func.to_tsquery("english", " | ".join(words))
    rank = db.func.ts_rank(Post.search_vector, tsquery)
    q = (db.select(Post).join(Community, Post.community_id == Community.id)
         .join(Country, Community.country_id == Country.id)
         .where(~Post.is_deleted, Post.comment_count > 0, Post.search_vector.op("@@")(tsquery)))
    places = [slug for slug, names in PLACES.items() if names & tokens]
    if places:
        q = q.where(Country.slug.in_(places)).order_by(rank.desc())
    elif user and user.target_country_id:
        q = q.order_by((Country.id == user.target_country_id).desc(), rank.desc())
    else:
        q = q.order_by(rank.desc())
    return [(p, a) for p in db.session.scalars(q.limit(limit)) if (a := _best_answer(p))]


def _profile(user):
    facts = [
        user.target_country and f"heading to {user.target_country.name}",
        user.study_level and user.study_level,
        (user.course or user.university) and " at ".join(filter(None, [user.course, user.university])),
        user.intake and f"starts {user.intake}",
    ]
    facts = [f for f in facts if f]
    return f"About me: {user.display_name.split()[0]}, " + "; ".join(facts) + "." if facts else ""


GREETING = re.compile(r"^\W*(?:hi+|hey+|hello+|helo|hola|namaste|yo|sup|hii+|good (?:morning|afternoon|evening|day))"
                      r"(?: there| tymai| tym| team| all| everyone| guys)?\W*$", re.I)
THANKS = re.compile(r"^\W*(?:thanks?(?: you)?(?: so much| a lot)?|thank u|thx|ty|cheers|great,? thanks?|ok(?:ay)? thanks?)\W*$", re.I)
BYE = re.compile(r"^\W*(?:bye+|goodbye|see (?:you|ya)|good ?night|take care)\W*$", re.I)
HOW_ARE_YOU = re.compile(r"^\W*(?:how are (?:you|u)|how(?:'s| is) it going|what'?s up|how do you do)\W*(?:today|tymai)?\W*$", re.I)
WHO_ARE_YOU = re.compile(r"\b(?:who are you|what are you|what can you do|what do you do|how can you help|are you (?:a )?(?:bot|robot|human|real|ai))\b", re.I)

# Questions about the website that have one right answer: (what the question mentions, the answer)
SITE_ANSWERS = [
    (r"\b(?:become|becoming|apply|register|sign ?up|join) (?:as |to be )?(?:a |an )?mentor\b|\bmentor (?:registration|application|form)\b",
     "To become a TYM mentor, fill in the Mentor Registration Form at theyouthmatters.com/mentors/register. You need "
     "an account with a finished age check and a profile photo first. The form asks about your education, work, the "
     "countries and subjects you can guide on, your session length and weekly hours, and for your CV and a "
     "qualification document. Our team reviews it, and once approved your profile is listed for students to book."),
    (r"\b(?:cancel|cancell?ation|refund|reschedul)\w*",
     "You can cancel a session up to 24 hours before it starts, from Sessions on your profile, and the time goes "
     "straight back on your counselling hours to book another slot. Inside 24 hours it cannot be cancelled on the "
     "site, so write to support@theyouthmatters.com. For a refund of hours you have not used, write to "
     "info@theyouthmatters.com."),
    (r"\b(?:counsell?ing hours?|packages?|price|pricing|cost|costs|fees?|charges?|how much|pay|payment|razorpay)\b",
     "Mentor sessions are paid for with counselling hours, and every mentor costs the same. {packages} You buy a "
     "package on the TYM Mentors page through Razorpay (UPI, card or net banking), the hours are added to your "
     "account, and each session you book takes its length from them, so a 30 minute session uses half an hour. "
     "Hours work with any mentor and do not expire. Everything else on TYM is free."),
    (r"\b(?:book|booking|schedule|session|sessions|appointment|one[- ]to[- ]one|1[- ]?to[- ]?1|mentors?|counsell?ors?)\b",
     "To book a mentor: first get counselling hours on the TYM Mentors page, then choose any mentor, pick a day and "
     "time (shown in your own time zone), write what you would like to cover and confirm. The video call link comes "
     "up on screen and by email, and the session is saved under Sessions on your profile. Once it is booked you can "
     "also message that mentor under Messages."),
    (r"\b(?:sign ?up|register|registration|create (?:an )?account|join|verify|verification|otp|aadhaa?r|pan card|passport|photo id|age (?:check|proof))\b",
     "Joining takes a few minutes: sign up with your email address or Google, enter the code we email you, then "
     "confirm your age once with a photo of your passport, driving licence, Aadhaar or PAN card. Members must be 18 "
     "or older. The ID photo is only read for your date of birth and is not stored."),
    (r"\b(?:chat ?rooms?|group chat|community chat)\b",
     "The chat rooms are under Community ChatRoom in the menu: one for Study Abroad and one for each country (UK, "
     "US, Canada, Australia, Ireland, Germany). They are free and text only. Type @TYMAi in a room and I will jump "
     "in with a short answer."),
    (r"\b(?:contact|support|help ?desk|customer care|email (?:id|address)|phone number|complain\w*|feedback)\b",
     "You can reach the team three ways: press \"Talk to a person\" below this chat and someone will join you here, "
     "use the Contact page, or write to support@theyouthmatters.com. For payments and general questions the address "
     "is info@theyouthmatters.com."),
    (r"\b(?:app|android|ios|iphone|play ?store|app ?store|download)\b",
     "There is no app to download. The Youth Matters is a website, and it works on your phone's browser as well as "
     "on a computer: theyouthmatters.com."),
    (r"\b(?:is (?:it|this|tym) free|free to use|free of cost|do i have to pay|paid)\b",
     "Almost everything on TYM is free: asking and answering questions, the country communities, the chat rooms and "
     "this chat with me. The only paid thing is one-to-one sessions with TYM Mentors, which you book with "
     "counselling hours."),
    (r"\b(?:what is|what'?s|tell me about|about) (?:tym|the youth matters|this (?:site|website|platform))\b|\bhow (?:does|do) (?:tym|this|it|the (?:site|website)) work\b",
     "The Youth Matters (TYM) is a study abroad community for people aged 18 to 32. You can ask questions and get "
     "answers from students who have already made the move, talk in free chat rooms by country, ask me anything "
     "about visas, SOPs and universities, and book a one-to-one video session with a verified mentor when you want "
     "proper time on your own plans."),
]
SITE_ANSWERS = [(re.compile(pattern, re.I), text) for pattern, text in SITE_ANSWERS]


def _packages():
    """What counselling hours cost right now, as a sentence. Read each time: the team changes prices in the panel."""
    rows = db.session.scalars(db.select(CounselingPackage).where(CounselingPackage.is_active)
                              .order_by(CounselingPackage.sort_order, CounselingPackage.hours)).all()
    if not rows:
        return ""
    return "Right now: " + ", ".join(f"{p.title} for ₹{p.price_minor // 100:,}" for p in rows) + "."


def small_talk(user, text):
    """A reply to hello, thanks and the like, or None. These never go looking for community answers."""
    name = user.display_name.split()[0] if user and user.display_name else "there"
    if GREETING.match(text):
        return (f"Hi {name}! Lovely to see you here. I am TYMAi, your study abroad buddy. Ask me about visas, SOPs, "
                "choosing a university, money and housing, or how anything on The Youth Matters works. What is on your mind today?")
    if HOW_ARE_YOU.match(text):
        return (f"Doing great, {name}, thank you for asking. No visa queue to stand in today, so I am all yours. "
                "What would you like help with?")
    if THANKS.match(text):
        return f"Anytime, {name}. Happy to help. Come back whenever the next question pops up."
    if BYE.match(text):
        return f"Take care, {name}. All the best with your plans, and come back any time."
    if WHO_ARE_YOU.search(text) and len(text) <= 120:
        return ("I am TYMAi, the assistant inside The Youth Matters. I can help with shortlisting universities, SOPs "
                "and applications, student visas and proof of funds, scholarships, housing and part-time work, and I "
                "can explain how the website works. I am an AI, so for anything official please confirm on the "
                "government or university page. If you would rather have a human, press \"Talk to a person\" below.")
    return None


def about_the_site(text):
    """A built-in answer when the question is about how the website works, or None."""
    for pattern, reply in SITE_ANSWERS:
        if pattern.search(text):
            return reply.replace("{packages}", _packages()).replace("  ", " ")
    return None


def _offline(found, lead=None, user=None, question=""):
    """An answer without the AI service: a greeting, a fact about the website, or what students here said."""
    if not lead:  # a `lead` means the AI service failed mid-question: go straight to what the community said
        ready = small_talk(user, question) or (len(question) <= 200 and about_the_site(question))
        if ready:
            return ready
    if not found:
        return OFFLINE_NONE
    lines = [lead or "Students here have answered questions like this. What they said:"]
    for post, ans in found:
        excerpt = ans.body if len(ans.body) <= 320 else ans.body[:320].rsplit(" ", 1)[0] + "..."
        lines.append(f"- {post.title}\n  {ans.author.display_name}: {excerpt}")
    lines.append("Open a question below to read the full thread, or ask your own.")
    return "\n\n".join(lines)


def answer(user, question, history=(), brief=False):
    """(reply text, sources). history: earlier [{"role", "content"}] turns of this conversation."""
    key = current_app.config["ANTHROPIC_API_KEY"]
    if not key and (ready := small_talk(user, question)):
        return ready, []
    found = related(question, user)
    sources = [{"postId": p.id, "title": p.title} for p, _ in found]
    if not key:
        text = _offline(found, user=user, question=question)
        return text, ([] if text in (OFFLINE_NONE,) or about_the_site(question) == text else sources)
    packages = _packages()

    context = "\n\n".join(
        f"[{i}] Question: {p.title}\nAnswer from {a.author.display_name}: {a.body[:1200]}"
        for i, (p, a) in enumerate(found, 1))
    parts = [_profile(user),
             packages and f"Counselling hours on sale on the website. {packages}",
             context and f"Answers from students in the community that may help:\n\n{context}",
             brief and "This is a public group chat, so keep the reply under 120 words.",
             f"My question: {question}"]
    prompt = "\n\n".join(p for p in parts if p)
    # Everything read from the database is in the prompt now. Hand the connection back before the
    # wait: a busy minute of questions must not use up every connection the site has.
    # (Nothing is pending: both callers save the question before asking.)
    db.session.rollback()
    client = anthropic.Anthropic(api_key=key, timeout=60.0)
    try:
        res = client.beta.messages.create(
            model=current_app.config["AI_MODEL"],
            # Thinking counts towards this, so a chat reply still needs room well above its 120 words
            max_tokens=2000 if brief else 16000,
            system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[*history, {"role": "user", "content": prompt}],
            output_config={"effort": "low" if brief else "medium"},
            # On a safety decline the API re-runs the request on a fallback model it picks
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError:
        log.error("TYMAi: ANTHROPIC_API_KEY was rejected")
        return _offline(found, UNAVAILABLE), sources
    except anthropic.RateLimitError:
        return "TYMAi is busy right now. Try again in a minute.", sources
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        log.warning("TYMAi: Claude API call failed: %s", e)
        return _offline(found, UNAVAILABLE), sources
    except Exception:  # noqa: BLE001  a chat must never fail because the AI service did
        log.exception("TYMAi: unexpected error calling Claude")
        return _offline(found, UNAVAILABLE), sources

    if res.stop_reason == "refusal":
        return REFUSED, []
    text = "".join(b.text for b in res.content if b.type == "text").strip()
    return text or _offline(found), sources
