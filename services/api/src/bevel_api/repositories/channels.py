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


def to_api_dict(
    row: Channel,
    *,
    agent_ids: list[str] | None = None,
) -> dict[str, Any]:
    defaults = list(row.default_agent_ids or [])
    members = list(agent_ids) if agent_ids is not None else defaults
    return {
        "id": row.id,
        "tenantId": row.tenant_id,
        "slug": row.slug,
        "name": row.name,
        "description": row.description or "",
        "tags": list(row.tags or []),
        "defaultAgentIds": defaults,
        "default_agent_ids": defaults,
        # Live ACL roster (membership table). Falls back to defaults when not loaded.
        "agentIds": members,
        "agent_ids": members,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


async def to_api_dict_with_members(
    session: AsyncSession,
    row: Channel,
) -> dict[str, Any]:
    from bevel_api.repositories import channel_agents as channel_agents_repo

    ids = await channel_agents_repo.agent_ids_for_channel(session, channel_id=row.id)
    if not ids:
        # Lazy migrate: seed from defaults once
        await channel_agents_repo.sync_defaults_from_channel(session, row)
        ids = await channel_agents_repo.agent_ids_for_channel(session, channel_id=row.id)
    return to_api_dict(row, agent_ids=ids)


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
    # Seed membership ACL from defaults (agents as members, not decoration)
    from bevel_api.repositories import channel_agents as channel_agents_repo

    await channel_agents_repo.sync_defaults_from_channel(session, row)
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
        # Existing channels created before memberships: still sync defaults
        from bevel_api.repositories import channel_agents as channel_agents_repo

        await channel_agents_repo.sync_defaults_from_channel(session, row)
        out.append(row)
    return out
