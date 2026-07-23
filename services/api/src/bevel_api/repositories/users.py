"""User repository — identity cache / membership."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    normalized = email.strip().lower()
    result = await session.execute(select(User).where(User.email == normalized))
    return result.scalar_one_or_none()


async def upsert_identity(
    session: AsyncSession,
    *,
    email: str,
    name: str = "",
    image_url: str | None = None,
    tenant_id: str | None = None,
    role: str = "member",
) -> User:
    normalized = email.strip().lower()
    existing = await get_by_email(session, normalized)
    if existing:
        if name:
            existing.name = name
        if image_url is not None:
            existing.image_url = image_url
        if tenant_id:
            existing.tenant_id = tenant_id
        existing.updated_at = _utcnow()
        await session.flush()
        return existing

    row = User(
        id=_id(),
        email=normalized,
        name=name or normalized.split("@")[0] or normalized,
        image_url=image_url,
        tenant_id=tenant_id,
        role=role,
        is_active=True,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(row)
    await session.flush()
    return row
