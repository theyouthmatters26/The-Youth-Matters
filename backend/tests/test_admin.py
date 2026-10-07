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
