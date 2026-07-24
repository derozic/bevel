"""Push token repository — Postgres SoT."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.push_token import PushToken

VALID_PLATFORMS = {"ios", "android", "macos", "web"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str:
    if dt is None:
        return ""
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def to_api_dict(row: PushToken) -> dict[str, Any]:
    return {
        "id": row.id,
        "token": row.token,
        "platform": row.platform,
        "userId": row.user_id or "",
        "tenantSlug": row.tenant_slug or "",
        "deviceModel": row.device_model or "",
        "appVersion": row.app_version or "",
        "createdAt": _iso(row.created_at),
        "updatedAt": _iso(row.updated_at),
    }


async def register(session: AsyncSession, payload: dict[str, Any]) -> PushToken:
    token = str(payload.get("token") or "").strip()
    platform = str(payload.get("platform") or "").strip().lower()
    if not token or platform not in VALID_PLATFORMS:
        raise ValueError("token and platform (ios|android|macos|web) required")

    result = await session.execute(select(PushToken).where(PushToken.token == token))
    existing = result.scalar_one_or_none()
    now = _utcnow()
    if existing:
        existing.platform = platform
        if payload.get("userId") is not None:
            existing.user_id = str(payload.get("userId") or "")
        if payload.get("tenantSlug") is not None:
            existing.tenant_slug = str(payload.get("tenantSlug") or "")
        if payload.get("deviceModel") is not None:
            existing.device_model = str(payload.get("deviceModel") or "")
        if payload.get("appVersion") is not None:
            existing.app_version = str(payload.get("appVersion") or "")
        existing.updated_at = now
        await session.flush()
        return existing

    row = PushToken(
        id=str(uuid.uuid4()),
        token=token,
        platform=platform,
        user_id=str(payload.get("userId") or ""),
        tenant_slug=str(payload.get("tenantSlug") or ""),
        device_model=str(payload.get("deviceModel") or ""),
        app_version=str(payload.get("appVersion") or ""),
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    await session.flush()
    return row


async def list_tokens(
    session: AsyncSession,
    *,
    tenant_slug: str | None = None,
    platform: str | None = None,
    limit: int = 100,
) -> list[PushToken]:
    lim = max(1, min(limit, 500))
    stmt = select(PushToken).order_by(PushToken.updated_at.desc()).limit(lim)
    if tenant_slug:
        stmt = stmt.where(PushToken.tenant_slug == tenant_slug)
    if platform:
        stmt = stmt.where(PushToken.platform == platform.lower())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def unregister(session: AsyncSession, token: str) -> bool:
    result = await session.execute(select(PushToken).where(PushToken.token == token))
    row = result.scalar_one_or_none()
    if row is None:
        return False
    await session.delete(row)
    await session.flush()
    return True
