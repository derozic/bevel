"""Unit tests for idempotent message upsert (in-progress conversation reliability)."""

from __future__ import annotations

from bevel_api.repositories.messages import extract_mentioned_agent_ids, _build_metadata


def test_extract_mentions_dedupes() -> None:
    ids = extract_mentioned_agent_ids("hey @Hermes and @hermes and @johnny")
    assert ids == ["hermes", "johnny"]


def test_build_metadata_status_defaults() -> None:
    meta = _build_metadata({"body": "hi"})
    assert meta["status"] == "final"
    assert meta["speakerType"] == "agent"


def test_build_metadata_preserves_streaming() -> None:
    meta = _build_metadata({"status": "streaming", "agentId": "hermes"})
    assert meta["status"] == "streaming"
    assert meta["agentId"] == "hermes"


def test_build_metadata_update_merges() -> None:
    existing = {"status": "streaming", "agentId": "hermes", "tags": ["a"]}
    meta = _build_metadata({"status": "final", "body": "done"}, existing=existing)
    assert meta["status"] == "final"
    assert meta["agentId"] == "hermes"
    assert meta["tags"] == ["a"]
