"""Core fleet helpers — conversations stay available when SMS is off."""

from bevel_api.lib.fleet_messages import get_channel, list_channels
from bevel_api.lib.tenants import catalog_agents
from bevel_api.repositories.channels import is_direct_thread_slug


def test_default_channels_exist() -> None:
    slugs = {ch["slug"] for ch in list_channels()}
    assert "general" in slugs


def test_unknown_channel_still_has_agents() -> None:
    ch = get_channel("brand-new")
    assert ch is not None
    assert ch["slug"] == "brand-new"
    assert "hermes" in ch["defaultAgentIds"]


def test_direct_thread_slugs_are_not_workspace_rooms() -> None:
    assert is_direct_thread_slug("dm-usr_1-hermes")
    assert is_direct_thread_slug("DM-user_1-hermes-johnny")
    assert not is_direct_thread_slug("general")
    assert not is_direct_thread_slug("admin")
    assert not is_direct_thread_slug("product")


def test_catalog_includes_synced_org() -> None:
    ids = {a["id"] for a in catalog_agents()}
    assert "hermes" in ids
    assert "sterling" in ids
    assert "cadence" in ids
    assert "codegraph" in ids
    assert len(ids) >= 20
