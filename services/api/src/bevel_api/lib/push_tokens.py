"""File-backed device push token registry (APNs / FCM)."""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

from bevel_api.config import settings


def _store_path() -> Path:
    root = Path(os.getenv("BEVEL_DATA_ROOT") or (settings.tenants_root().parent / "data"))
    return root / "push_tokens.json"


def _load() -> dict[str, Any]:
    path = _store_path()
    if not path.exists():
        return {"tokens": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"tokens": []}


def _save(data: dict[str, Any]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def register_token(payload: dict[str, Any]) -> dict[str, Any]:
    token = str(payload.get("token") or "").strip()
    platform = str(payload.get("platform") or "").strip().lower()
    if not token or platform not in {"ios", "android", "macos", "web"}:
        raise ValueError("token and platform (ios|android|macos|web) required")

    data = _load()
    tokens: list[dict[str, Any]] = list(data.get("tokens") or [])
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    existing = next((t for t in tokens if t.get("token") == token), None)
    if existing:
        existing.update(
            {
                "platform": platform,
                "userId": payload.get("userId") or existing.get("userId"),
                "tenantSlug": payload.get("tenantSlug") or existing.get("tenantSlug"),
                "deviceModel": payload.get("deviceModel") or existing.get("deviceModel"),
                "appVersion": payload.get("appVersion") or existing.get("appVersion"),
                "updatedAt": now,
            }
        )
        _save({"tokens": tokens})
        return existing

    record = {
        "id": str(uuid.uuid4()),
        "token": token,
        "platform": platform,
        "userId": payload.get("userId") or "",
        "tenantSlug": payload.get("tenantSlug") or "",
        "deviceModel": payload.get("deviceModel") or "",
        "appVersion": payload.get("appVersion") or "",
        "createdAt": now,
        "updatedAt": now,
    }
    tokens.append(record)
    # Cap store size for file backend
    if len(tokens) > 5000:
        tokens = tokens[-5000:]
    _save({"tokens": tokens})
    return record


def list_tokens(
    *,
    tenant_slug: str | None = None,
    platform: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    tokens: list[dict[str, Any]] = list(_load().get("tokens") or [])
    if tenant_slug:
        tokens = [t for t in tokens if t.get("tenantSlug") == tenant_slug]
    if platform:
        tokens = [t for t in tokens if t.get("platform") == platform]
    return tokens[-limit:]


def unregister_token(token: str) -> bool:
    data = _load()
    tokens: list[dict[str, Any]] = list(data.get("tokens") or [])
    next_tokens = [t for t in tokens if t.get("token") != token]
    if len(next_tokens) == len(tokens):
        return False
    _save({"tokens": next_tokens})
    return True
