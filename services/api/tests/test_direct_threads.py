"""Direct agent threads persist as channels but stay out of workspace lists."""

from bevel_api.repositories.channels import is_direct_thread_slug


def test_direct_thread_slugs_are_not_workspace_rooms() -> None:
    assert is_direct_thread_slug("dm-usr_1-hermes")
    assert is_direct_thread_slug("DM-user_1-hermes-johnny")
    assert not is_direct_thread_slug("general")
    assert not is_direct_thread_slug("admin")
    assert not is_direct_thread_slug("product")
