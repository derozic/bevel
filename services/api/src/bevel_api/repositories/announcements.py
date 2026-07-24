"""Announcement repository — Postgres SoT."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.announcement import Announcement
from bevel_api.lib.announcement_seed import DEFAULT_STYLE, SEED

ALLOWED_UPDATE = {
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
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_optional_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _iso(dt: datetime | None) -> str:
    if dt is None:
        return ""
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def to_api_dict(row: Announcement) -> dict[str, Any]:
    return {
        "id": row.id,
        "title": row.title or "",
        "body": row.body or "",
        "icon": row.icon or "",
        "linkLabel": row.link_label or "Learn more",
        "linkHref": row.link_href or "",
        "linkKind": row.link_kind or "app",
        "ctaVariant": row.cta_variant or "link",
        "placement": row.placement or "top",
        "kind": row.kind or "static",
        "dismissible": bool(row.dismissible),
        "enabled": bool(row.enabled),
        "priority": int(row.priority or 0),
        "audience": row.audience or "all",
        "tenantSlugs": list(row.tenant_slugs or []),
        "style": dict(row.style or DEFAULT_STYLE),
        "startsAt": _iso(row.starts_at),
        "endsAt": _iso(row.ends_at),
        "createdAt": _iso(row.created_at),
        "updatedAt": _iso(row.updated_at),
    }


def _is_active(row: Announcement, now: datetime | None = None) -> bool:
    if not row.enabled:
        return False
    clock = now or _utcnow()
    if row.starts_at and clock < row.starts_at:
        return False
    if row.ends_at and clock > row.ends_at:
        return False
    return True


async def list_all(session: AsyncSession) -> list[Announcement]:
    result = await session.execute(
        select(Announcement).order_by(Announcement.priority.desc(), Announcement.updated_at.desc())
    )
    return list(result.scalars().all())


async def list_active(
    session: AsyncSession,
    *,
    tenant_slug: str | None = None,
) -> list[Announcement]:
    rows = await list_all(session)
    now = _utcnow()
    active = [r for r in rows if _is_active(r, now)]
    if tenant_slug:
        filtered: list[Announcement] = []
        for row in active:
            scopes = list(row.tenant_slugs or [])
            if not scopes or tenant_slug in scopes:
                filtered.append(row)
        active = filtered
    return active


async def get_one(session: AsyncSession, announcement_id: str) -> Announcement | None:
    return await session.get(Announcement, announcement_id)


def _row_from_payload(payload: dict[str, Any], *, existing: Announcement | None = None) -> Announcement:
    now = _utcnow()
    if existing is None:
        row = Announcement(id=str(payload.get("id") or uuid.uuid4()), created_at=now, updated_at=now)
    else:
        row = existing
        row.updated_at = now

    if "title" in payload or existing is None:
        row.title = str(payload.get("title") or "")
    if "body" in payload or existing is None:
        row.body = str(payload.get("body") or "")
    if "icon" in payload or existing is None:
        row.icon = str(payload.get("icon") or "")
    if "linkLabel" in payload or existing is None:
        row.link_label = str(payload.get("linkLabel") or "Learn more")
    if "linkHref" in payload or existing is None:
        row.link_href = str(payload.get("linkHref") or "")
    if "linkKind" in payload or existing is None:
        row.link_kind = str(payload.get("linkKind") or "app")
    if "ctaVariant" in payload or existing is None:
        row.cta_variant = str(payload.get("ctaVariant") or "link")
    if "placement" in payload or existing is None:
        row.placement = str(payload.get("placement") or "top")
    if "kind" in payload or existing is None:
        row.kind = str(payload.get("kind") or "static")
    if "dismissible" in payload or existing is None:
        row.dismissible = bool(payload.get("dismissible", True))
    if "enabled" in payload or existing is None:
        row.enabled = bool(payload.get("enabled", True))
    if "priority" in payload or existing is None:
        row.priority = int(payload.get("priority") or 0)
    if "audience" in payload or existing is None:
        row.audience = str(payload.get("audience") or "all")
    if "tenantSlugs" in payload or existing is None:
        row.tenant_slugs = list(payload.get("tenantSlugs") or [])
    if "style" in payload or existing is None:
        style = payload.get("style")
        row.style = dict(style) if isinstance(style, dict) else dict(DEFAULT_STYLE)
    if "startsAt" in payload or existing is None:
        row.starts_at = _parse_optional_dt(payload.get("startsAt"))
    if "endsAt" in payload or existing is None:
        row.ends_at = _parse_optional_dt(payload.get("endsAt"))
    return row


async def create(session: AsyncSession, payload: dict[str, Any]) -> Announcement:
    if not (payload.get("body") or "").strip():
        raise ValueError("body required")
    if not (payload.get("linkHref") or "").strip():
        raise ValueError("linkHref required")
    row = _row_from_payload(payload)
    session.add(row)
    await session.flush()
    return row


async def update(
    session: AsyncSession,
    announcement_id: str,
    payload: dict[str, Any],
) -> Announcement | None:
    row = await get_one(session, announcement_id)
    if row is None:
        return None
    filtered = {k: v for k, v in payload.items() if k in ALLOWED_UPDATE}
    _row_from_payload(filtered, existing=row)
    await session.flush()
    return row


async def delete(session: AsyncSession, announcement_id: str) -> bool:
    row = await get_one(session, announcement_id)
    if row is None:
        return False
    await session.delete(row)
    await session.flush()
    return True


async def seed_defaults(session: AsyncSession) -> int:
    """Insert canned product announcements when table is empty."""
    existing = await session.scalar(select(Announcement.id).limit(1))
    if existing:
        return 0
    count = 0
    for item in SEED:
        session.add(_row_from_payload(dict(item)))
        count += 1
    await session.flush()
    return count
