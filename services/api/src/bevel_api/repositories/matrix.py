"""Matrix mapping repositories."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.matrix import MatrixEventMap, MatrixRoomMap, MatrixUserMap


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def room_to_dict(row: MatrixRoomMap) -> dict[str, Any]:
    return {
        "id": row.id,
        "tenantId": row.tenant_id,
        "channelSlug": row.channel_slug,
        "roomId": row.room_id,
        "roomAlias": row.room_alias,
        "spaceId": row.space_id,
        "e2ee": row.e2ee == "1",
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


async def get_room_map(
    session: AsyncSession, *, tenant_id: str, channel_slug: str
) -> MatrixRoomMap | None:
    result = await session.execute(
        select(MatrixRoomMap).where(
            MatrixRoomMap.tenant_id == tenant_id,
            MatrixRoomMap.channel_slug == channel_slug.lower().strip(),
        )
    )
    return result.scalar_one_or_none()


async def get_room_by_matrix_id(
    session: AsyncSession, room_id: str
) -> MatrixRoomMap | None:
    result = await session.execute(
        select(MatrixRoomMap).where(MatrixRoomMap.room_id == room_id)
    )
    return result.scalar_one_or_none()


async def upsert_room_map(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_slug: str,
    room_id: str,
    room_alias: str = "",
    space_id: str = "",
    e2ee: bool = False,
) -> MatrixRoomMap:
    slug = channel_slug.lower().strip()
    existing = await get_room_map(session, tenant_id=tenant_id, channel_slug=slug)
    if existing:
        existing.room_id = room_id
        existing.room_alias = room_alias or existing.room_alias
        existing.space_id = space_id or existing.space_id
        existing.e2ee = "1" if e2ee else "0"
        await session.flush()
        return existing
    row = MatrixRoomMap(
        id=_id("mxr"),
        tenant_id=tenant_id,
        channel_slug=slug,
        room_id=room_id,
        room_alias=room_alias,
        space_id=space_id,
        e2ee="1" if e2ee else "0",
    )
    session.add(row)
    await session.flush()
    return row


async def get_event_by_message(
    session: AsyncSession, message_id: str
) -> MatrixEventMap | None:
    result = await session.execute(
        select(MatrixEventMap).where(MatrixEventMap.message_id == message_id)
    )
    return result.scalar_one_or_none()


async def get_event_by_matrix_id(
    session: AsyncSession, event_id: str
) -> MatrixEventMap | None:
    result = await session.execute(
        select(MatrixEventMap).where(MatrixEventMap.event_id == event_id)
    )
    return result.scalar_one_or_none()


async def record_event(
    session: AsyncSession,
    *,
    tenant_id: str,
    message_id: str,
    event_id: str,
    room_id: str,
    direction: str = "out",
) -> MatrixEventMap:
    existing = await get_event_by_message(session, message_id)
    if existing:
        return existing
    row = MatrixEventMap(
        id=_id("mxe"),
        tenant_id=tenant_id,
        message_id=message_id,
        event_id=event_id,
        room_id=room_id,
        direction=direction,
    )
    session.add(row)
    await session.flush()
    return row


async def get_user_map(
    session: AsyncSession, *, tenant_id: str, local_id: str
) -> MatrixUserMap | None:
    result = await session.execute(
        select(MatrixUserMap).where(
            MatrixUserMap.tenant_id == tenant_id,
            MatrixUserMap.local_id == local_id,
        )
    )
    return result.scalar_one_or_none()


async def upsert_user_map(
    session: AsyncSession,
    *,
    tenant_id: str,
    local_id: str,
    mxid: str,
    kind: str = "user",
    display_name: str = "",
) -> MatrixUserMap:
    existing = await get_user_map(session, tenant_id=tenant_id, local_id=local_id)
    if existing:
        existing.mxid = mxid
        existing.kind = kind
        if display_name:
            existing.display_name = display_name
        await session.flush()
        return existing
    row = MatrixUserMap(
        id=_id("mxu"),
        tenant_id=tenant_id,
        local_id=local_id,
        kind=kind,
        mxid=mxid,
        display_name=display_name,
    )
    session.add(row)
    await session.flush()
    return row
