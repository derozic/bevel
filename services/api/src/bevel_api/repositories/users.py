"""User repository — identity cache / membership / handle lookup."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.user import User

_HANDLE_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,62}$")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex


def normalize_handle(raw: str | None) -> str | None:
    if not raw:
        return None
    h = raw.strip().lower().lstrip("@^~#")
    if not h or not _HANDLE_RE.match(h):
        return None
    return h


def to_public_dict(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "imageUrl": user.image_url,
        "handle": user.handle,
        "tenantId": user.tenant_id,
        "role": user.role,
        "personalAgentId": user.personal_agent_id,
        "personalAgentConfig": dict(user.personal_agent_config or {}),
        "isActive": user.is_active,
    }


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    normalized = email.strip().lower()
    result = await session.execute(select(User).where(User.email == normalized))
    return result.scalar_one_or_none()


async def get_by_id(session: AsyncSession, user_id: str) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_by_handle(
    session: AsyncSession,
    *,
    handle: str,
    tenant_id: str | None = None,
) -> User | None:
    h = normalize_handle(handle)
    if not h:
        return None
    q = select(User).where(User.handle == h, User.is_active.is_(True))
    if tenant_id:
        q = q.where(User.tenant_id == tenant_id)
    result = await session.execute(q.limit(1))
    return result.scalar_one_or_none()


async def lookup_handles(
    session: AsyncSession,
    *,
    q: str = "",
    tenant_id: str | None = None,
    limit: int = 20,
) -> list[User]:
    lim = max(1, min(limit, 50))
    query = select(User).where(User.is_active.is_(True), User.handle.is_not(None))
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    needle = (q or "").strip().lower().lstrip("@^")
    if needle:
        like = f"%{needle}%"
        query = query.where(
            or_(
                User.handle.ilike(like),
                User.name.ilike(like),
                User.email.ilike(like),
            )
        )
    query = query.order_by(User.handle.asc()).limit(lim)
    result = await session.execute(query)
    return list(result.scalars().all())


async def update_profile(
    session: AsyncSession,
    *,
    user_id: str,
    handle: str | None = None,
    name: str | None = None,
    image_url: str | None = None,
    personal_agent_id: str | None | object = ...,
    personal_agent_config: dict[str, Any] | None = None,
    tenant_id: str | None = None,
) -> User | None:
    user = await get_by_id(session, user_id)
    if not user:
        return None
    if handle is not None:
        normalized = normalize_handle(handle)
        if handle.strip() and not normalized:
            raise ValueError("invalid handle — use 2–63 chars [a-z0-9_-]")
        if normalized:
            # Ensure unique within tenant
            existing = await get_by_handle(
                session, handle=normalized, tenant_id=user.tenant_id or tenant_id
            )
            if existing and existing.id != user.id:
                raise ValueError(f"handle @{normalized} is already taken")
        user.handle = normalized
    if name is not None:
        user.name = name.strip() or user.name
    if image_url is not None:
        user.image_url = image_url.strip() or None
    if personal_agent_id is not ...:
        agent = (personal_agent_id or "").strip().lower() or None
        user.personal_agent_id = agent
    if personal_agent_config is not None:
        user.personal_agent_config = dict(personal_agent_config)
    if tenant_id and not user.tenant_id:
        user.tenant_id = tenant_id
    user.updated_at = _utcnow()
    await session.flush()
    return user


async def upsert_identity(
    session: AsyncSession,
    *,
    email: str,
    name: str = "",
    image_url: str | None = None,
    tenant_id: str | None = None,
    role: str = "member",
    handle: str | None = None,
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
        if handle and not existing.handle:
            existing.handle = normalize_handle(handle)
        existing.updated_at = _utcnow()
        await session.flush()
        return existing

    derived_handle = normalize_handle(handle) or normalize_handle(
        normalized.split("@")[0]
    )
    row = User(
        id=_id(),
        email=normalized,
        name=name or normalized.split("@")[0] or normalized,
        image_url=image_url,
        tenant_id=tenant_id,
        role=role,
        is_active=True,
        handle=derived_handle,
        personal_agent_id=None,
        personal_agent_config={},
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(row)
    await session.flush()
    return row
