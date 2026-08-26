from bevel_api.lib.memberships import (
    email_is_member_of,
    user_may_access_workspace,
    workspace_has_roster,
)


def test_roster_membership_for_operators() -> None:
    assert email_is_member_of("scott@derozic.com", "2x4m")
    assert email_is_member_of("s@derozic.com", "demo")
    assert not email_is_member_of("scott@derozic.com", "no-such-workspace")
    assert workspace_has_roster("2x4m")
    assert not workspace_has_roster("definitely-missing")


def test_cross_tenant_webhook_admin_is_denied() -> None:
    assert not user_may_access_workspace(
        "sderozic@gmail.com", "2x4m", home_slug="preso"
    )
    assert user_may_access_workspace("sderozic@gmail.com", "preso", home_slug="preso")
    assert user_may_access_workspace("scott@derozic.com", "2x4m", home_slug="platform")
