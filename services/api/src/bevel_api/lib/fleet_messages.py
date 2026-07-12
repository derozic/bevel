"""File-backed fleet channel message store (JSONL, not SQLite).

Used by realtime hydrate/append and agent program events (JOHNNY, etc.).
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_lock = threading.Lock()

DEFAULT_CHANNELS: list[dict[str, Any]] = [
    {
        "slug": "general",
        "name": "general",
        "description": "Workspace-wide channel",
        "tags": ["bevel"],
        "defaultAgentIds": ["hermes", "johnny", "brain"],
    },
    {
        "slug": "product",
        "name": "product",
        "description": "GitHub issues, PRs, releases, and agent accountability",
        "tags": ["product", "github", "accountability"],
        "defaultAgentIds": ["hermes", "forge", "johnny"],
    },
    {
        "slug": "ops",
        "name": "ops",
        "description": "Infrastructure and agent programs",
        "tags": ["ops", "programs"],
        "defaultAgentIds": ["johnny", "hermes"],
    },
]


def _data_dir() -> Path:
    env = os.getenv("BEVEL_FLEET_DATA_DIR")
    if env:
        return Path(env)
    # services/api/src/bevel_api/lib → repo services/api/data/fleet
    return Path(__file__).resolve().parents[3] / "data" / "fleet"


def _channel_path(slug: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in slug.lower())
    return _data_dir() / f"{safe}.jsonl"


def list_channels() -> list[dict[str, Any]]:
    return list(DEFAULT_CHANNELS)


def get_channel(slug: str) -> dict[str, Any] | None:
    key = slug.lower()
    for ch in DEFAULT_CHANNELS:
        if ch["slug"] == key:
            return ch
    # Unknown slugs still work as ad-hoc channels
    return {
        "slug": key,
        "name": key,
        "description": "",
        "tags": ["bevel"],
        "defaultAgentIds": ["hermes", "johnny"],
    }


def read_messages(slug: str, limit: int = 100) -> list[dict[str, Any]]:
    path = _channel_path(slug)
    if not path.exists():
        return []
    with _lock:
        lines = path.read_text(encoding="utf-8").splitlines()
    rows: list[dict[str, Any]] = []
    for line in lines[-max(1, min(limit, 500)) :]:
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def append_message(slug: str, msg: dict[str, Any]) -> dict[str, Any]:
    path = _channel_path(slug)
    path.parent.mkdir(parents=True, exist_ok=True)
    created = msg.get("createdAt") or datetime.now(timezone.utc).isoformat()
    record = {
        "id": msg.get("id") or f"msg_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "speakerId": msg.get("speakerId") or msg.get("speaker_id") or "unknown",
        "speakerName": msg.get("speakerName") or msg.get("speaker_name") or "unknown",
        "speakerAvatar": msg.get("speakerAvatar") or msg.get("speaker_avatar") or "",
        "speakerType": msg.get("speakerType") or msg.get("speaker_type") or "agent",
        "agentId": msg.get("agentId") or msg.get("agent_id") or "",
        "body": msg.get("body") or "",
        "status": msg.get("status") or "final",
        "tags": msg.get("tags") or [],
        "createdAt": created,
    }
    with _lock:
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record
