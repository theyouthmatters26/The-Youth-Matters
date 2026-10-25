"""Case studies the team writes in the admin panel (api/case_studies.py, api/admin_content.py).

They used to be hard-coded in the website bundle. What matters now is that only the team can write
one, that hiding one takes it off the public page, and that the page keeps the team's order.
"""
from io import BytesIO

import pytest
from PIL import Image
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


def picture(colour="navy"):
    out = BytesIO()
    Image.new("RGB", (900, 700), colour).save(out, "JPEG")
    out.seek(0)
    return out


def send_pictures(client, heads, case_id, how_many=1):
    files = [(picture(), f"shot{i}.jpg") for i in range(how_many)]
    return client.post(f"/api/admin/case-studies/{case_id}/images", headers=heads["owner"],
                       data={"images": files}, content_type="multipart/form-data")


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


# --- the longer read and the photographs, shown when a student opens a journey -------------------

def test_a_journey_can_be_written_without_a_story_or_pictures(site):
    """Every case study on the page was written before either existed. They still read."""
    client, heads = site
    add(client, heads)
    shown = client.get("/api/case-studies").get_json()[0]
    assert shown["story"] == ""
    assert shown["images"] == []


def test_the_story_is_saved_and_can_be_emptied_again(site):
    client, heads = site
    made = add(client, heads, story="Two months of paperwork, then Leeds.").get_json()
    assert made["story"] == "Two months of paperwork, then Leeds."
    assert client.get("/api/case-studies").get_json()[0]["story"] == "Two months of paperwork, then Leeds."

    # the one field the team may clear: the four on the card stay required
    cleared = client.patch(f"/api/admin/case-studies/{made['id']}", headers=heads["owner"], json={"story": "  "})
    assert cleared.get_json()["story"] == ""
    assert client.patch(f"/api/admin/case-studies/{made['id']}", headers=heads["owner"],
                        json={"quote": " "}).status_code == 400


def test_pictures_go_on_in_order_and_the_page_shows_them(site):
    client, heads = site
    made = add(client, heads).get_json()
    first = send_pictures(client, heads, made["id"], 2)
    assert first.status_code == 201, first.get_json()
    assert len(first.get_json()["images"]) == 2

    added = send_pictures(client, heads, made["id"], 1).get_json()["images"]
    assert added[:2] == first.get_json()["images"]  # the new one goes on the end
    assert client.get("/api/case-studies").get_json()[0]["images"] == added
    assert all(u.startswith("/api/media/case-studies/") for u in added)


def test_only_the_team_adds_pictures(site):
    client, heads = site
    made = add(client, heads).get_json()
    assert send_pictures(client, heads, made["id"]).status_code == 201
    mine = [(picture(), "mine.jpg")]
    assert client.post(f"/api/admin/case-studies/{made['id']}/images", headers=heads["student"],
                       data={"images": mine}, content_type="multipart/form-data").status_code == 403


def test_taking_a_picture_off_leaves_the_others_and_deletes_the_file(site, tmp_path):
    client, heads = site
    made = add(client, heads).get_json()
    on = send_pictures(client, heads, made["id"], 3).get_json()["images"]
    gone, kept = on[1], [on[0], on[2]]

    from app.services import storage
    assert storage._local_path(gone.removeprefix("/api/media/")).exists()
    left = client.patch(f"/api/admin/case-studies/{made['id']}", headers=heads["owner"], json={"images": kept})
    assert left.get_json()["images"] == kept
    assert not storage._local_path(gone.removeprefix("/api/media/")).exists()


def test_a_picture_cannot_be_smuggled_in_through_the_list(site):
    """The list says which of this journey's pictures to keep. Anything else in it is ignored."""
    client, heads = site
    made = add(client, heads).get_json()
    on = send_pictures(client, heads, made["id"], 1).get_json()["images"]
    sneaked = client.patch(f"/api/admin/case-studies/{made['id']}", headers=heads["owner"],
                           json={"images": [*on, "/api/media/identity/secret.jpg"]})
    assert sneaked.get_json()["images"] == on


def test_a_malformed_picture_list_is_refused_rather_than_clearing_them(site):
    """A string here would be read letter by letter and every picture would count as dropped."""
    client, heads = site
    made = add(client, heads).get_json()
    on = send_pictures(client, heads, made["id"], 2).get_json()["images"]
    for bad in ("/api/media/case-studies/one.jpeg", {"keep": on}, 3):
        assert client.patch(f"/api/admin/case-studies/{made['id']}", headers=heads["owner"],
                            json={"images": bad}).status_code == 400
    assert client.get("/api/case-studies").get_json()[0]["images"] == on


def test_there_is_a_limit_on_how_many_pictures_one_journey_holds(site):
    client, heads = site
    made = add(client, heads).get_json()
    assert send_pictures(client, heads, made["id"], 8).status_code == 201
    too_many = send_pictures(client, heads, made["id"], 1)
    assert too_many.status_code == 400
    assert len(client.get("/api/case-studies").get_json()[0]["images"]) == 8


def test_deleting_a_journey_takes_its_pictures_with_it(site):
    client, heads = site
    made = add(client, heads).get_json()
    on = send_pictures(client, heads, made["id"], 2).get_json()["images"]

    from app.services import storage
    paths = [storage._local_path(u.removeprefix("/api/media/")) for u in on]
    assert all(p.exists() for p in paths)
    assert client.delete(f"/api/admin/case-studies/{made['id']}", headers=heads["owner"]).status_code == 200
    assert not any(p.exists() for p in paths)
