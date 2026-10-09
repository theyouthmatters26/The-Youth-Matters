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
from ..models import Comment, Community, Country, Post

log = logging.getLogger(__name__)

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

Stay on studying abroad, careers and student life. For anything else, say briefly, and with good \
humour, that you can't help with that here, and suggest what you can do."""

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


def _offline(found, lead=None):
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
    found = related(question, user)
    sources = [{"postId": p.id, "title": p.title} for p, _ in found]
    key = current_app.config["ANTHROPIC_API_KEY"]
    if not key:
        return _offline(found), sources

    context = "\n\n".join(
        f"[{i}] Question: {p.title}\nAnswer from {a.author.display_name}: {a.body[:1200]}"
        for i, (p, a) in enumerate(found, 1))
    parts = [_profile(user),
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

    if res.stop_reason == "refusal":
        return REFUSED, []
    text = "".join(b.text for b in res.content if b.type == "text").strip()
    return text or _offline(found), sources
