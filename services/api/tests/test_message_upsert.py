"""Unit tests for idempotent message upsert (in-progress conversation reliability)."""

from __future__ import annotations

from types import SimpleNamespace
from datetime import datetime, timezone

from bevel_api.repositories.messages import (
    extract_mentioned_agent_ids,
    _build_metadata,
    page_limit,
    pagination_cursors,
)


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


def test_page_limit_clamps() -> None:
    assert page_limit(0) == 1
    assert page_limit(50) == 50
    assert page_limit(9999) == 500
    assert page_limit("nope") == 100  # type: ignore[arg-type]


def test_pagination_cursors_from_oldest() -> None:
    ts = datetime(2026, 8, 4, 12, 0, tzinfo=timezone.utc)
    msgs = [
        SimpleNamespace(id="msg_old", created_at=ts),
        SimpleNamespace(id="msg_new", created_at=datetime(2026, 8, 4, 13, 0, tzinfo=timezone.utc)),
    ]
    cursors = pagination_cursors(msgs)  # type: ignore[arg-type]
    assert cursors["nextBeforeId"] == "msg_old"
    assert cursors["nextBefore"] == ts.isoformat()
    assert pagination_cursors([]) == {"nextBefore": None, "nextBeforeId": None}
