"""Core fleet helpers — conversations stay available when SMS is off."""

from bevel_api.lib.fleet_messages import get_channel, list_channels


def test_default_channels_exist() -> None:
    slugs = {ch["slug"] for ch in list_channels()}
    assert "general" in slugs


def test_unknown_channel_still_has_agents() -> None:
    ch = get_channel("brand-new")
    assert ch is not None
    assert ch["slug"] == "brand-new"
    assert "hermes" in ch["defaultAgentIds"]
