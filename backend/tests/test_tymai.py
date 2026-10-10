"""TYMAi: what it says without the AI service, and what it sends to Claude when a key is set."""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from types import SimpleNamespace as N

import pytest

from app import create_app
from app.config import TestConfig
from app.services import tymai

ASHA = N(display_name="Asha Rao", target_country=None, target_country_id=None, study_level=None, course=None,
         university=None, intake=None)


@pytest.fixture
def site(monkeypatch):
    """The app without a database: nothing found in the community, two packages on sale."""
    monkeypatch.setattr(tymai, "related", lambda text, user=None, limit=3: [])
    monkeypatch.setattr(tymai, "_packages", lambda: "Right now: 1 hour for ₹850, 10 hours for ₹4,250.")
    monkeypatch.setattr(tymai.db.session, "rollback", lambda: None)
    app = create_app(TestConfig)
    with app.app_context():
        yield app


def test_hello_gets_a_hello_not_a_search(site):
    for text in ("hi", "Hello!", "hey there", "good morning"):
        reply, sources = tymai.answer(ASHA, text)
        assert reply.startswith("Hi there, I am SumSam") and sources == [], text
    assert "Anytime, Asha" in tymai.answer(ASHA, "thanks")[0]
    assert tymai.small_talk(ASHA, "hi, how much money for a UK visa?") is None  # a real question is not a greeting


def test_questions_about_the_website_are_answered_without_the_ai_service(site):
    hours = tymai.answer(ASHA, "How much does a mentor cost?")[0]
    assert "counselling hours" in hours and "1 hour for ₹850" in hours
    assert "24 hours" in tymai.answer(ASHA, "can I cancel my session?")[0]
    assert "/mentors/register" in tymai.answer(ASHA, "how do I become a mentor")[0]
    assert "no app" in tymai.answer(ASHA, "is there an android app?")[0]
    assert tymai.answer(ASHA, "what is the weather on Mars")[0] == tymai.OFFLINE_NONE


class Claude(BaseHTTPRequestHandler):
    """Stands in for the Messages API: keeps what it was sent, answers with what the test set."""
    seen, reply, status = [], {}, 200

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        Claude.seen.append({"path": self.path, "beta": self.headers.get("anthropic-beta"), "body": body})
        out = json.dumps(Claude.reply).encode()
        self.send_response(Claude.status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *args):
        pass


def message(*blocks, stop="end_turn"):
    return {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-haiku-5-5", "content": list(blocks),
            "stop_reason": stop, "stop_sequence": None, "usage": {"input_tokens": 10, "output_tokens": 5}}


@pytest.fixture
def claude(site, monkeypatch):
    server = HTTPServer(("127.0.0.1", 0), Claude)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setenv("ANTHROPIC_BASE_URL", f"http://127.0.0.1:{server.server_port}")
    site.config.update(ANTHROPIC_API_KEY="sk-test", AI_MODEL="claude-haiku-5-5")
    Claude.seen, Claude.status = [], 200
    yield Claude
    server.shutdown()


def test_with_a_key_the_question_goes_to_claude_with_the_site_facts(claude):
    claude.reply = message({"type": "thinking", "thinking": "", "signature": "sig"}, {"type": "text", "text": "Hi Asha, here you go."})
    history = [{"role": "user", "content": "earlier question"}, {"role": "assistant", "content": "earlier answer"}]
    reply, _ = tymai.answer(ASHA, "how much money for a UK visa?", history)
    assert reply == "Hi Asha, here you go."  # the thinking block is skipped, the text is the answer

    sent = claude.seen[0]
    body = sent["body"]
    assert sent["path"].startswith("/v1/messages") and "server-side-fallback-2026-07-01" in sent["beta"]
    assert body["model"] == "claude-haiku-5-5" and body["fallbacks"] == "default"
    assert body["output_config"] == {"effort": "medium"} and "thinking" not in body and "temperature" not in body
    system = body["system"][0]
    assert system["cache_control"] == {"type": "ephemeral"} and "Counselling hours" in system["text"]
    assert body["messages"][:2] == history and body["messages"][-1]["role"] == "user"
    assert "My question: how much money for a UK visa?" in body["messages"][-1]["content"] and "1 hour for ₹850" in body["messages"][-1]["content"]


def test_a_refusal_or_a_failing_service_still_gives_the_student_an_answer(claude):
    claude.reply = message(stop="refusal")
    assert tymai.answer(ASHA, "something it will not answer")[0] == tymai.REFUSED

    claude.status, claude.reply = 400, {"type": "error", "error": {"type": "invalid_request_error", "message": "bad"}}
    assert tymai.answer(ASHA, "how do visas work")[0] == tymai.OFFLINE_NONE  # nothing in the community: the plain fallback


def test_the_policy_pages_are_read_from_the_website_and_fed_to_claude(site):
    docs = tymai._documents()
    assert "Terms and Conditions (theyouthmatters.com/terms)" in docs
    assert "Payment, Refund and Cancellation Terms" in docs and "Privacy Policy" in docs
    assert len(docs) <= tymai.DOCUMENTS_LIMIT


def test_site_facts_keep_going_when_the_database_cannot_be_read(site):
    facts = tymai.site_facts()  # no tables in this app: only the written facts and the policy pages
    assert "The Youth Matters (TYM) is a study abroad community" in facts
    assert "Community Guidelines" in facts  # the policy pages do not need the database


def test_tymai_answers_only_what_tym_is_for():
    assert "you can only help with studying abroad and The Youth Matters" in tymai.RULES
    assert "do not answer \"just this once\"" in tymai.RULES.lower()


def test_counselling_time_is_said_the_way_a_person_would():
    assert [tymai._hours(m) for m in (0, 30, 60, 90, 120)] == [
        "none", "30 minutes", "1 hour", "1 hour 30 minutes", "2 hours"]


def test_the_account_facts_are_skipped_for_someone_without_an_account(site):
    assert tymai._account(ASHA) == ""  # no id: nothing to look up, and no query is run
