"""Case studies the team writes in the admin panel (api/case_studies.py, api/admin_content.py).

They used to be hard-coded in the website bundle. What matters now is that only the team can write
one, that hiding one takes it off the public page, and that the page keeps the team's order.
"""
import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import CaseStudy, User

TABLES = [db.metadata.tables[t] for t in ("countries", "users", "identity_verifications", "case_studies",
                                          "moderation_logs")]


class NoLimit(TestConfig):
    RATELIMIT_ENABLED = False


@pytest.fixture
def site():
    app = create_app(NoLimit)
    app.config["ADMIN_EMAIL"] = "owner@theyouthmatters.com"
    with app.app_context():
        db.metadata.create_all(db.engine, tables=TABLES)
        owner = User(email="owner@theyouthmatters.com", username="owner", display_name="Owner",
                     role="admin", status="active", email_verified=True)
        student = User(email="asha@example.org", username="asha", display_name="Asha",
                       status="active", email_verified=True)
        db.session.add_all([owner, student])
        db.session.commit()
        heads = {n: {"Authorization": f"Bearer {create_access_token(str(i))}"}
                 for n, i in (("owner", owner.id), ("student", student.id))}
        yield app.test_client(), heads
        db.session.remove()
        db.metadata.drop_all(db.engine, tables=TABLES)


STORY = {"name": "Aisha Khan", "route": "Hyderabad to Leeds", "course": "MSc Marketing",
         "quote": "One answer here saved my visa application."}


def add(client, heads, **over):
    return client.post("/api/admin/case-studies", headers=heads["owner"], json={**STORY, **over})


def test_the_team_writes_one_and_the_page_shows_it(site):
    client, heads = site
    made = add(client, heads)
    assert made.status_code == 201, made.get_json()

    page = client.get("/api/case-studies").get_json()
    assert [c["name"] for c in page] == ["Aisha Khan"]
    assert page[0]["quote"] == STORY["quote"]


def test_nobody_else_can_write_one(site):
    client, heads = site
    assert client.post("/api/admin/case-studies", headers=heads["student"], json=STORY).status_code == 403
    assert client.post("/api/admin/case-studies", json=STORY).status_code == 401
    assert db.session.scalar(db.select(CaseStudy)) is None


def test_a_half_filled_form_is_refused(site):
    client, heads = site
    assert add(client, heads, quote=" ").status_code == 400
    assert add(client, heads, route="").status_code == 400
    assert db.session.scalar(db.select(CaseStudy)) is None


def test_hiding_one_takes_it_off_the_page_without_deleting_it(site):
    client, heads = site
    made = add(client, heads).get_json()

    hid = client.patch(f"/api/admin/case-studies/{made['id']}", headers=heads["owner"], json={"status": "hidden"})
    assert hid.status_code == 200
    assert client.get("/api/case-studies").get_json() == []
    # still there for the team, so it can go back up
    assert len(client.get("/api/admin/case-studies", headers=heads["owner"]).get_json()) == 1

    client.patch(f"/api/admin/case-studies/{made['id']}", headers=heads["owner"], json={"status": "published"})
    assert len(client.get("/api/case-studies").get_json()) == 1


def test_the_page_keeps_the_order_the_team_set(site):
    client, heads = site
    first = add(client, heads, name="First").get_json()
    second = add(client, heads, name="Second").get_json()
    assert [c["name"] for c in client.get("/api/case-studies").get_json()] == ["First", "Second"]

    # swap them, the way the up and down arrows do
    client.patch(f"/api/admin/case-studies/{first['id']}", headers=heads["owner"], json={"sortOrder": second["sortOrder"]})
    client.patch(f"/api/admin/case-studies/{second['id']}", headers=heads["owner"], json={"sortOrder": first["sortOrder"]})
    assert [c["name"] for c in client.get("/api/case-studies").get_json()] == ["Second", "First"]


def test_deleting_one_removes_it(site):
    client, heads = site
    made = add(client, heads).get_json()
    assert client.delete(f"/api/admin/case-studies/{made['id']}", headers=heads["owner"]).status_code == 200
    assert client.get("/api/case-studies").get_json() == []
