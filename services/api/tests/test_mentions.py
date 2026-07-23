"""Unit tests that do not require Postgres."""

from bevel_api.repositories.messages import extract_mentioned_agent_ids


def test_extract_mentions_basic():
    assert extract_mentioned_agent_ids("hey @johnny and @hermes") == [
        "johnny",
        "hermes",
    ]


def test_extract_mentions_dedupes_case():
    assert extract_mentioned_agent_ids("@Johnny then @johnny") == ["johnny"]


def test_extract_mentions_empty():
    assert extract_mentioned_agent_ids("") == []
    assert extract_mentioned_agent_ids("no mentions here") == []
