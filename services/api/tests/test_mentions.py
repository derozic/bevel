"""Unit tests that do not require Postgres."""

from bevel_api.repositories.messages import (
    extract_escalated_handles,
    extract_mentioned_agent_ids,
    extract_mentioned_handles,
)


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


def test_extract_mentioned_handles_excludes_fleet_agents():
    assert extract_mentioned_handles("ping @scott and @hermes please") == ["scott"]
    assert extract_mentioned_handles("@johnny @loom") == []
    assert extract_mentioned_handles("@sterling @cadence @scott") == ["scott"]


def test_extract_escalated_handles():
    assert extract_escalated_handles("need ^Scott and ^peter now") == [
        "scott",
        "peter",
    ]
    assert extract_escalated_handles("price is $5 only") == []


def test_email_not_soft_mention():
    assert extract_mentioned_handles("email a@b.com then @ok_user") == ["ok_user"]
