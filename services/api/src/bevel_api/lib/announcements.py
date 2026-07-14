"""File-backed platform announcements (operator-managed)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bevel_api.config import settings

DEFAULT_STYLE: dict[str, Any] = {
    "textColor": "#1a1200",
    "linkColor": "#1a1200",
    "gradient": {
        "angleDeg": 92,
        "stops": [
            {"color": "#f6c84a", "p3": "0.97 0.78 0.2", "at": 0},
            {"color": "#efb020", "p3": "0.95 0.68 0.1", "at": 45},
            {"color": "#f0c040", "p3": "0.96 0.74 0.16", "at": 100},
        ],
    },
}

SOFT_SKY_STYLE: dict[str, Any] = {
    "textColor": "#1f2937",
    "linkColor": "#1f2937",
    "ctaBg": "#ffffff",
    "ctaText": "#1f2937",
    "ctaBorder": "rgba(15, 23, 42, 0.14)",
    "iconBg": "#dbeafe",
    "iconColor": "#2563eb",
    "gradient": {
        "angleDeg": 90,
        "stops": [
            {"color": "#e8f6ff", "p3": "0.91 0.96 1", "at": 0},
            {"color": "#dff2ff", "p3": "0.88 0.94 1", "at": 50},
            {"color": "#d4edff", "p3": "0.84 0.92 1", "at": 100},
        ],
    },
}

SEED: list[dict[str, Any]] = [
    {
        "id": "seed-flutter-mobile",
        "title": "",
        "body": "Stay connected to BEVEL, even when you're on the go",
        "icon": "device-phone-mobile",
        "linkLabel": "Get the Flutter app",
        "linkHref": "/download",
        "linkKind": "app",
        "ctaVariant": "button",
        "placement": "top",
        "kind": "static",
        "dismissible": True,
        "enabled": True,
        "priority": 20,
        "audience": "all",
        "tenantSlugs": [],
        "style": SOFT_SKY_STYLE,
        "startsAt": "",
        "endsAt": "",
        "createdAt": "2026-07-10T00:00:00.000Z",
        "updatedAt": "2026-07-10T00:00:00.000Z",
    },
    {
        "id": "seed-next-step",
        "title": "Action may be required:",
        "body": (
            "Complete your profile so teammates and agents know who you are — "
            "display name, handle, and socials."
        ),
        "icon": "user-group",
        "linkLabel": "Open profile",
        "linkHref": "/settings?section=profile",
        "linkKind": "app",
        "ctaVariant": "link",
        "placement": "bottom",
        "kind": "next_step",
        "dismissible": True,
        "enabled": True,
        "priority": 10,
        "audience": "authenticated",
        "tenantSlugs": [],
        "style": DEFAULT_STYLE,
        "startsAt": "",
        "endsAt": "",
        "createdAt": "2026-07-10T00:00:00.000Z",
        "updatedAt": "2026-07-10T00:00:00.000Z",
    },
]


def _store_path() -> Path:
    path = settings.tenants_root().parent / "data" / "announcements.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _normalize(item: dict[str, Any]) -> dict[str, Any]:
    """Backfill new fields for older store rows."""
    out = dict(item)
    out.setdefault("icon", "")
    out.setdefault("ctaVariant", "link")
    out.setdefault("placement", "top")
    out.setdefault("kind", "static")
    out.setdefault("title", "")
    out.setdefault("linkLabel", "Learn more")
    out.setdefault("linkKind", "app")
    out.setdefault("dismissible", True)
    out.setdefault("enabled", True)
    out.setdefault("priority", 0)
    out.setdefault("audience", "all")
    out.setdefault("tenantSlugs", [])
    out.setdefault("startsAt", "")
    out.setdefault("endsAt", "")
    if not out.get("style"):
        out["style"] = DEFAULT_STYLE
    # Migrate old FedRAMP seed → next-step onboarding strip
    if out.get("id") == "seed-fedramp-style":
        out["id"] = "seed-next-step"
        out["kind"] = "next_step"
        out["placement"] = "bottom"
        out["audience"] = "authenticated"
        out["title"] = "Action may be required:"
        out["body"] = (
            "Complete your profile so teammates and agents know who you are — "
            "display name, handle, and socials."
        )
        out["icon"] = "user-group"
        out["linkLabel"] = "Open profile"
        out["linkHref"] = "/settings?section=profile"
        out["ctaVariant"] = "link"
        out["updatedAt"] = _now_iso()
    return out


def _ensure_seed_rows(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {str(i.get("id")): i for i in items}
    changed = False
    # Drop obsolete id if migration already rewrote content under new id
    items = [i for i in items if i.get("id") != "seed-fedramp-style" or "seed-next-step" not in by_id]
    by_id = {str(i.get("id")): i for i in items}
    for seed in SEED:
        sid = str(seed["id"])
        if sid not in by_id:
            items.append(dict(seed))
            changed = True
        else:
            # Keep placement/kind aligned for canned product seeds
            existing = by_id[sid]
            if sid == "seed-flutter-mobile" and existing.get("placement") != "top":
                existing["placement"] = "top"
                changed = True
            if sid == "seed-next-step":
                if existing.get("placement") != "bottom":
                    existing["placement"] = "bottom"
                    changed = True
                if existing.get("kind") != "next_step":
                    existing["kind"] = "next_step"
                    changed = True
    return items


def _read() -> list[dict[str, Any]]:
    path = _store_path()
    if not path.exists():
        _write(SEED)
        return [_normalize(dict(item)) for item in SEED]
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return [_normalize(dict(item)) for item in SEED]
    items = raw.get("announcements") if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        return []
    normalized = [_normalize(item) for item in items if isinstance(item, dict)]
    # Collapse migrated FedRAMP id
    by_id: dict[str, dict[str, Any]] = {}
    for item in normalized:
        sid = str(item.get("id") or "")
        if not sid:
            continue
        by_id[sid] = item
    normalized = list(by_id.values())
    before_len = len(normalized)
    normalized = _ensure_seed_rows(normalized)
    if len(normalized) != before_len or any(
        i.get("id") == "seed-next-step" and i.get("placement") != "bottom" for i in normalized
    ):
        _write(normalized)
    else:
        # Always rewrite once after normalize migration fields
        _write(normalized)
    return normalized


def _write(items: list[dict[str, Any]]) -> None:
    path = _store_path()
    payload = {
        "version": 1,
        "updatedAt": _now_iso(),
        "announcements": items,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def list_all() -> list[dict[str, Any]]:
    return _read()


def _is_active(item: dict[str, Any], now: datetime | None = None) -> bool:
    if not item.get("enabled", True):
        return False
    clock = now or datetime.now(timezone.utc)
    starts = (item.get("startsAt") or "").strip()
    ends = (item.get("endsAt") or "").strip()
    if starts:
        try:
            start_dt = datetime.fromisoformat(starts.replace("Z", "+00:00"))
            if clock < start_dt:
                return False
        except ValueError:
            pass
    if ends:
        try:
            end_dt = datetime.fromisoformat(ends.replace("Z", "+00:00"))
            if clock > end_dt:
                return False
        except ValueError:
            pass
    return True


def list_active(tenant_slug: str | None = None) -> list[dict[str, Any]]:
    items = [i for i in _read() if _is_active(i)]
    if tenant_slug:
        filtered: list[dict[str, Any]] = []
        for item in items:
            scopes = item.get("tenantSlugs") or []
            if not scopes or tenant_slug in scopes:
                filtered.append(item)
        items = filtered
    items.sort(
        key=lambda i: (
            -int(i.get("priority") or 0),
            str(i.get("updatedAt") or ""),
        ),
    )
    return items


def get_one(announcement_id: str) -> dict[str, Any] | None:
    for item in _read():
        if item.get("id") == announcement_id:
            return item
    return None


def create(payload: dict[str, Any]) -> dict[str, Any]:
    items = _read()
    now = _now_iso()
    item: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "title": payload.get("title") or "",
        "body": payload["body"],
        "icon": payload.get("icon") or "",
        "linkLabel": payload.get("linkLabel") or "Learn more",
        "linkHref": payload["linkHref"],
        "linkKind": payload.get("linkKind") or "app",
        "ctaVariant": payload.get("ctaVariant") or "link",
        "placement": payload.get("placement") or "top",
        "kind": payload.get("kind") or "static",
        "dismissible": payload.get("dismissible", True),
        "enabled": payload.get("enabled", True),
        "priority": int(payload.get("priority") or 0),
        "audience": payload.get("audience") or "all",
        "tenantSlugs": list(payload.get("tenantSlugs") or []),
        "style": payload.get("style") or DEFAULT_STYLE,
        "startsAt": payload.get("startsAt") or "",
        "endsAt": payload.get("endsAt") or "",
        "createdAt": now,
        "updatedAt": now,
    }
    items.append(item)
    _write(items)
    return item


def update(announcement_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    items = _read()
    found: dict[str, Any] | None = None
    for idx, item in enumerate(items):
        if item.get("id") != announcement_id:
            continue
        next_item = {**item}
        for key in (
            "title",
            "body",
            "icon",
            "linkLabel",
            "linkHref",
            "linkKind",
            "ctaVariant",
            "placement",
            "kind",
            "dismissible",
            "enabled",
            "priority",
            "audience",
            "tenantSlugs",
            "style",
            "startsAt",
            "endsAt",
        ):
            if key in payload and payload[key] is not None:
                next_item[key] = payload[key]
        next_item["updatedAt"] = _now_iso()
        items[idx] = next_item
        found = next_item
        break
    if found is None:
        return None
    _write(items)
    return found


def delete(announcement_id: str) -> bool:
    items = _read()
    next_items = [i for i in items if i.get("id") != announcement_id]
    if len(next_items) == len(items):
        return False
    _write(next_items)
    return True
