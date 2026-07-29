"""Dual-write BEVEL messages → Matrix (best-effort, non-blocking for UX)."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.lib.matrix_client import (
    MatrixClient,
    agent_mxid,
    channel_alias,
    matrix_enabled,
    sanitize_localpart,
    server_name,
    user_mxid,
)
from bevel_api.db.models.matrix import MatrixRoomMap
from bevel_api.repositories import matrix as matrix_repo

log = logging.getLogger("bevel_api.matrix.dual_write")


async def ensure_channel_room(
    session: AsyncSession,
    *,
    tenant_id: str,
    tenant_slug: str,
    channel_slug: str,
    channel_name: str | None = None,
) -> MatrixRoomMap | None:
    """Ensure a Matrix room exists for a BEVEL channel; return mapping."""
    if not matrix_enabled():
        return None

    existing = await matrix_repo.get_room_map(
        session, tenant_id=tenant_id, channel_slug=channel_slug
    )
    if existing:
        return existing

    client = MatrixClient()
    if not client.configured:
        return None

    alias = channel_alias(tenant_slug, channel_slug)
    alias_local = sanitize_localpart(f"{tenant_slug}_{channel_slug}")
    room_id = await client.create_room(
        alias_localpart=alias_local,
        name=channel_name or f"#{channel_slug}",
        topic=f"BEVEL #{channel_slug} ({tenant_slug})",
    )
    if not room_id:
        # Room may already exist — invent a deterministic placeholder for offline HS
        # so maps can still be tested; real HS returns room_id.
        log.info(
            "matrix createRoom failed for %s; leave unmapped until HS is up",
            alias,
        )
        return None

    return await matrix_repo.upsert_room_map(
        session,
        tenant_id=tenant_id,
        channel_slug=channel_slug,
        room_id=room_id,
        room_alias=alias,
    )


async def publish_message_to_matrix(
    session: AsyncSession,
    *,
    tenant_id: str,
    tenant_slug: str,
    channel_slug: str,
    message: dict[str, Any],
) -> str | None:
    """Send a BEVEL message into its Matrix room. Returns event_id or None."""
    if not matrix_enabled():
        return None

    status = (message.get("status") or "final").lower()
    if status not in ("final", "error", ""):
        # Skip streaming partials to avoid event spam
        return None

    body = str(message.get("body") or "").strip()
    if not body:
        return None

    message_id = str(message.get("id") or "").strip()
    if not message_id:
        return None

    if await matrix_repo.get_event_by_message(session, message_id):
        return None  # already published

    room = await ensure_channel_room(
        session,
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
        channel_slug=channel_slug,
    )
    if not room:
        return None

    speaker_id = str(
        message.get("speakerId") or message.get("speaker_id") or "unknown"
    )
    speaker_type = (
        message.get("speakerType")
        or message.get("speaker_type")
        or (message.get("metadata") or {}).get("speakerType")
        or "human"
    )
    if speaker_type == "agent" or speaker_id.startswith("agent:"):
        agent = speaker_id.replace("agent:", "")
        sender = agent_mxid(tenant_slug, agent)
        kind = "agent"
    else:
        sender = user_mxid(speaker_id)
        kind = "user"

    await matrix_repo.upsert_user_map(
        session,
        tenant_id=tenant_id,
        local_id=speaker_id,
        mxid=sender,
        kind=kind,
        display_name=str(
            message.get("speakerName") or message.get("speaker_name") or speaker_id
        ),
    )

    client = MatrixClient()
    txn = f"bevel_{message_id}_{uuid.uuid4().hex[:8]}"
    event_id = await client.send_text(
        room.room_id, body, txn_id=txn, sender=sender
    )
    if not event_id:
        return None

    await matrix_repo.record_event(
        session,
        tenant_id=tenant_id,
        message_id=message_id,
        event_id=event_id,
        room_id=room.room_id,
        direction="out",
    )
    return event_id


def matrix_status_payload() -> dict[str, Any]:
    client = MatrixClient()
    return {
        "enabled": matrix_enabled(),
        "configured": client.configured,
        "homeserverUrl": client.base_url if client.configured else None,
        "serverName": server_name(),
        "slidingSync": bool(
            (__import__("os").getenv("MATRIX_SLIDING_SYNC_URL") or "").strip()
        ),
        "elementCall": bool(
            (__import__("os").getenv("MATRIX_ELEMENT_CALL_URL") or "").strip()
        ),
        "phases": {
            "flags": True,
            "dualWrite": True,
            "appservice": True,
            "slidingSyncClient": True,
            "bridges": True,
            "federationAgents": True,
            "productionHomeserver": False,
        },
    }
