from app import create_app
from app.config import TestConfig
from app.models import User
from app.services import staff
from app.services.staff import AREAS, clean_access


def test_access_is_reduced_to_real_parts_of_the_panel():
    assert clean_access(["support", "not-a-real-part"]) == ["support"]
    assert clean_access(None) == [] and clean_access([]) == []
    # the order is the menu's, whatever order they were ticked in
    assert clean_access(["blog", "support"]) == ["support", "blog"]


def test_everything_is_stored_as_one_star():
    assert clean_access("*") == ["*"]
    assert clean_access(["support", "*"]) == ["*"]
    assert clean_access(list(AREAS)) == ["*"]


def test_the_panel_is_handed_out_in_roles():
    """Super admin, admin, mentor admin and support are sets of the areas the code checks."""
    with create_app(TestConfig).app_context():
        assert staff.areas_for("super_admin") == ["*"]
        assert "team" not in staff.areas_for("admin")  # an admin cannot change who is on the team
        assert set(staff.areas_for("admin")) | {"team"} == set(staff.AREAS)
        assert staff.areas_for("mentor_admin") == ["overview", "mentors", "bookings"]
        assert staff.areas_for("support") == ["support"]
        assert staff.areas_for("something else") is None

        mentor_admin = User(email="m@tym.test", username="ma", display_name="Mentor Admin",
                            role="admin", status="active", admin_access=staff.areas_for("mentor_admin"))
        assert staff.role_of(mentor_admin) == "mentor_admin"
        assert staff.can(mentor_admin, "mentors") and not staff.can(mentor_admin, "members")

        everything = User(email="s@tym.test", username="sa", display_name="Super", role="admin",
                          status="active", admin_access=["*"])
        assert staff.role_of(everything) == "super_admin" and staff.can(everything, "team")

        picked = User(email="c@tym.test", username="cu", display_name="Custom", role="admin",
                      status="active", admin_access=["blog", "faq"])
        assert staff.role_of(picked) == "custom"  # a mix of their own is still valid

        assert staff.role_of(User(email="x@tym.test", username="x", display_name="X", role="student",
                                  status="active")) is None
