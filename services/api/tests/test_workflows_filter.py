"""Unit tests for channel workflow filters + definition normalize."""

from bevel_api.repositories.workflows import _filter_matches, normalize_definition


def test_filter_contains_prefix():
    assert _filter_matches("contains:P1", "hello P1 world")
    assert not _filter_matches("contains:P1", "all clear")


def test_filter_contains_fn():
    assert _filter_matches("contains(text, 'deploy')", "please deploy now")
    assert _filter_matches("str_contains(trigger_text, 'OOM')", "kernel OOM killer")


def test_filter_empty_always():
    assert _filter_matches("", "anything")
    assert _filter_matches("  ", "x")


def test_normalize_definition():
    d = normalize_definition(
        {
            "name": "incident",
            "trigger": {"on": "message_posted", "filter": "contains:P1"},
            "steps": [
                {"action": "mention_agent", "agent": "Johnny"},
                {"action": "post_message", "text": "fired"},
            ],
        }
    )
    assert d["name"] == "incident"
    assert d["trigger"]["on"] == "message_posted"
    assert d["steps"][0]["agent"] == "johnny"
    assert d["steps"][1]["action"] == "post_message"
