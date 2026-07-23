"""Channel repository."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.channel import Channel

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


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex


def to_api_dict(row: Channel) -> dict[str, Any]:
    return {
        "id": row.id,
        "tenantId": row.tenant_id,
        "slug": row.slug,
        "name": row.name,
        "description": row.description or "",
        "tags": list(row.tags or []),
        "defaultAgentIds": list(row.default_agent_ids or []),
        "default_agent_ids": list(row.default_agent_ids or []),
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


async def list_for_tenant(session: AsyncSession, tenant_id: str) -> list[Channel]:
    result = await session.execute(
        select(Channel)
        .where(Channel.tenant_id == tenant_id)
        .order_by(Channel.slug)
    )
    return list(result.scalars().all())


async def get_by_slug(
    session: AsyncSession,
    tenant_id: str,
    slug: str,
) -> Channel | None:
    key = slug.lower().strip()
    result = await session.execute(
        select(Channel).where(
            Channel.tenant_id == tenant_id,
            Channel.slug == key,
        )
    )
    return result.scalar_one_or_none()


async def ensure_channel(
    session: AsyncSession,
    tenant_id: str,
    slug: str,
    *,
    name: str | None = None,
    description: str = "",
    tags: list[str] | None = None,
    default_agent_ids: list[str] | None = None,
) -> Channel:
    key = slug.lower().strip()
    existing = await get_by_slug(session, tenant_id, key)
    if existing:
        return existing

    # Prefer canned defaults when creating known slugs
    defaults = next((c for c in DEFAULT_CHANNELS if c["slug"] == key), None)
    row = Channel(
        id=_id(),
        tenant_id=tenant_id,
        slug=key,
        name=name or (defaults["name"] if defaults else key),
        description=description
        or (str(defaults["description"]) if defaults else ""),
        tags=list(tags if tags is not None else (defaults["tags"] if defaults else ["bevel"])),
        default_agent_ids=list(
            default_agent_ids
            if default_agent_ids is not None
            else (defaults["defaultAgentIds"] if defaults else ["hermes", "johnny"])
        ),
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(row)
    await session.flush()
    return row


async def ensure_defaults(session: AsyncSession, tenant_id: str) -> list[Channel]:
    out: list[Channel] = []
    for ch in DEFAULT_CHANNELS:
        row = await ensure_channel(
            session,
            tenant_id,
            ch["slug"],
            name=str(ch["name"]),
            description=str(ch.get("description") or ""),
            tags=list(ch.get("tags") or []),
            default_agent_ids=list(ch.get("defaultAgentIds") or []),
        )
        out.append(row)
    return out
