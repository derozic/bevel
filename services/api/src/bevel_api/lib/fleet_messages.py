"""Fleet channel helpers.

Primary storage is PostgreSQL via repositories (see routers/fleet.py).
This module only keeps DEFAULT_CHANNELS for seed compatibility and a
read-only JSONL import path used by seed.py.
"""

from __future__ import annotations

from typing import Any

from bevel_api.repositories.channels import DEFAULT_CHANNELS


def list_channels() -> list[dict[str, Any]]:
    """Static defaults (prefer DB list via fleet router)."""
    return list(DEFAULT_CHANNELS)


def get_channel(slug: str) -> dict[str, Any] | None:
    key = slug.lower()
    for ch in DEFAULT_CHANNELS:
        if ch["slug"] == key:
            return ch
    return {
        "slug": key,
        "name": key,
        "description": "",
        "tags": ["bevel"],
        "defaultAgentIds": ["hermes", "johnny"],
    }
