from app.api import open_to_unverified


def test_unverified_accounts_can_finish_signing_up_and_read_public_pages():
    for method, path in [("POST", "/api/auth/google"), ("GET", "/api/auth/me"), ("POST", "/api/verify/document"),
                         ("POST", "/api/contact"), ("GET", "/api/posts"), ("GET", "/api/posts/3/comments"),
                         ("GET", "/api/mentors/2/availability"), ("GET", "/api/chat/rooms"), ("GET", "/api/blogs")]:
        assert open_to_unverified(method, path), (method, path)


def test_unverified_accounts_are_kept_out_of_everything_members_only():
    for method, path in [("GET", "/api/chat/rooms/uk/messages"), ("POST", "/api/chat/rooms/uk/messages"),
                         ("POST", "/api/posts"), ("POST", "/api/posts/3/save"), ("PUT", "/api/votes"),
                         ("PATCH", "/api/users/me"), ("POST", "/api/users/me/avatar"), ("POST", "/api/reports"),
                         ("POST", "/api/communities/1/follow"), ("GET", "/api/ai/conversations"),
                         ("POST", "/api/bookings"), ("GET", "/api/notifications"), ("POST", "/api/mentor-application"),
                         ("GET", "/api/admin/mentor-applications"), ("GET", "/api/some-route-added-later")]:
        assert not open_to_unverified(method, path), (method, path)
