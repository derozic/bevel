"""Channel agent membership — ACL for @mentions and roster."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.channel import Channel
from bevel_api.db.models.channel_agent import ChannelAgentMember


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex


def to_api_dict(row: ChannelAgentMember) -> dict[str, Any]:
    return {
        "id": row.id,
        "tenantId": row.tenant_id,
        "channelId": row.channel_id,
        "agentId": row.agent_id,
        "role": row.role,
        "addedAt": row.added_at.isoformat() if row.added_at else None,
        "addedBy": row.added_by,
    }


async def list_for_channel(
    session: AsyncSession,
    *,
    channel_id: str,
) -> list[ChannelAgentMember]:
    result = await session.execute(
        select(ChannelAgentMember)
        .where(ChannelAgentMember.channel_id == channel_id)
        .order_by(ChannelAgentMember.agent_id)
    )
    return list(result.scalars().all())


async def agent_ids_for_channel(
    session: AsyncSession,
    *,
    channel_id: str,
) -> list[str]:
    rows = await list_for_channel(session, channel_id=channel_id)
    return [r.agent_id for r in rows]


async def is_member(
    session: AsyncSession,
    *,
    channel_id: str,
    agent_id: str,
) -> bool:
    key = agent_id.strip().lower()
    result = await session.execute(
        select(ChannelAgentMember.id).where(
            ChannelAgentMember.channel_id == channel_id,
            ChannelAgentMember.agent_id == key,
        )
    )
    return result.scalar_one_or_none() is not None


async def add_member(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str,
    agent_id: str,
    role: str = "bot",
    added_by: str | None = None,
) -> ChannelAgentMember:
    key = agent_id.strip().lower()
    result = await session.execute(
        select(ChannelAgentMember).where(
            ChannelAgentMember.channel_id == channel_id,
            ChannelAgentMember.agent_id == key,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    row = ChannelAgentMember(
        id=_id(),
        tenant_id=tenant_id,
        channel_id=channel_id,
        agent_id=key,
        role=(role or "bot").strip().lower()[:32],
        added_at=_utcnow(),
        added_by=added_by,
    )
    session.add(row)
    await session.flush()
    return row


async def remove_member(
    session: AsyncSession,
    *,
    channel_id: str,
    agent_id: str,
) -> bool:
    key = agent_id.strip().lower()
    result = await session.execute(
        delete(ChannelAgentMember).where(
            ChannelAgentMember.channel_id == channel_id,
            ChannelAgentMember.agent_id == key,
        )
    )
    return (result.rowcount or 0) > 0


async def sync_defaults_from_channel(
    session: AsyncSession,
    channel: Channel,
    *,
    added_by: str | None = "system",
) -> list[ChannelAgentMember]:
    """Ensure membership rows exist for channel.default_agent_ids (idempotent)."""
    out: list[ChannelAgentMember] = []
    for agent_id in channel.default_agent_ids or []:
        if not str(agent_id).strip():
            continue
        row = await add_member(
            session,
            tenant_id=channel.tenant_id,
            channel_id=channel.id,
            agent_id=str(agent_id),
            role="bot",
            added_by=added_by,
        )
        out.append(row)
    return out


async def replace_roster(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str,
    agent_ids: list[str],
    added_by: str | None = None,
) -> list[ChannelAgentMember]:
    """Set exact roster (add missing, remove extras)."""
    desired = {a.strip().lower() for a in agent_ids if a and a.strip()}
    current = await list_for_channel(session, channel_id=channel_id)
    current_ids = {r.agent_id for r in current}
    for rid in current_ids - desired:
        await remove_member(session, channel_id=channel_id, agent_id=rid)
    out: list[ChannelAgentMember] = []
    for aid in sorted(desired):
        out.append(
            await add_member(
                session,
                tenant_id=tenant_id,
                channel_id=channel_id,
                agent_id=aid,
                added_by=added_by,
            )
        )
    return out
