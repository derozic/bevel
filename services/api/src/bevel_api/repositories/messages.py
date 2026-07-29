"""Message repository — primary SoT for fleet channel history."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.message import Message

# @agent or @Name tokens used in chat
_MENTION_RE = re.compile(r"@([a-zA-Z0-9_-]{2,64})")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return f"msg_{uuid.uuid4().hex[:16]}"


def extract_mentioned_agent_ids(body: str) -> list[str]:
    if not body:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for match in _MENTION_RE.finditer(body):
        token = match.group(1).lower()
        if token not in seen:
            seen.add(token)
            out.append(token)
    return out


def to_api_dict(row: Message) -> dict[str, Any]:
    meta = dict(row.metadata_ or {})
    return {
        "id": row.id,
        "speakerId": row.speaker_id,
        "speakerName": row.speaker_name,
        "speakerAvatar": row.speaker_avatar or "",
        "speakerType": meta.get("speakerType") or meta.get("speaker_type") or "agent",
        "agentId": meta.get("agentId") or meta.get("agent_id") or "",
        "body": row.body or "",
        "status": meta.get("status") or "final",
        "tags": list(meta.get("tags") or []),
        "kind": row.kind,
        "mentionedAgentIds": list(row.mentioned_agent_ids or []),
        "channelSlug": row.channel_slug,
        "tenantId": row.tenant_id,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


async def list_for_channel(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str,
    limit: int = 100,
) -> list[Message]:
    lim = max(1, min(limit, 500))
    result = await session.execute(
        select(Message)
        .where(
            Message.tenant_id == tenant_id,
            Message.channel_id == channel_id,
        )
        .order_by(Message.created_at.desc())
        .limit(lim)
    )
    rows = list(result.scalars().all())
    rows.reverse()  # chronological
    return rows


async def list_for_channel_slug(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_slug: str,
    limit: int = 100,
) -> list[Message]:
    lim = max(1, min(limit, 500))
    key = channel_slug.lower().strip()
    result = await session.execute(
        select(Message)
        .where(
            Message.tenant_id == tenant_id,
            Message.channel_slug == key,
        )
        .order_by(Message.created_at.desc())
        .limit(lim)
    )
    rows = list(result.scalars().all())
    rows.reverse()
    return rows


async def get_by_id(session: AsyncSession, message_id: str) -> Message | None:
    result = await session.execute(
        select(Message).where(Message.id == message_id)
    )
    return result.scalar_one_or_none()


def _build_metadata(msg: dict[str, Any], *, existing: dict[str, Any] | None = None) -> dict[str, Any]:
    metadata = dict(existing or {})
    metadata["speakerType"] = (
        msg.get("speakerType")
        or msg.get("speaker_type")
        or metadata.get("speakerType")
        or "agent"
    )
    metadata["agentId"] = (
        msg.get("agentId")
        or msg.get("agent_id")
        or metadata.get("agentId")
        or ""
    )
    if "status" in msg:
        metadata["status"] = msg.get("status") or "final"
    elif "status" not in metadata:
        metadata["status"] = "final"
    if "tags" in msg:
        metadata["tags"] = list(msg.get("tags") or [])
    elif "tags" not in metadata:
        metadata["tags"] = []
    # Preserve extra keys under metadata (in-progress client fields, etc.)
    reserved = {
        "id",
        "body",
        "speakerId",
        "speaker_id",
        "speakerName",
        "speaker_name",
        "speakerAvatar",
        "speaker_avatar",
        "createdAt",
        "created_at",
        "speakerType",
        "speaker_type",
        "agentId",
        "agent_id",
        "status",
        "tags",
        "kind",
    }
    for key, val in msg.items():
        if key in reserved:
            continue
        if key not in metadata or msg.get(key) is not None:
            metadata[key] = val
    return metadata


async def append(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str,
    channel_slug: str,
    msg: dict[str, Any],
) -> Message:
    """Insert or update a message by id (idempotent for retries + streaming).

    In-progress conversations re-post the same ``id`` with updated ``body`` /
    ``status`` (``pending`` | ``streaming`` | ``final`` | ``error``). Without
    upsert, retries would either fail on PK or leave partial rows stuck.
    """
    body = str(msg.get("body") or "")
    message_id = str(msg.get("id") or "").strip() or _id()
    existing = await get_by_id(session, message_id)

    if existing is not None:
        # Tenant/channel safety: never reassign a message across tenants
        if existing.tenant_id != tenant_id:
            raise ValueError("message id already belongs to another tenant")
        if "body" in msg:
            existing.body = body
            existing.mentioned_agent_ids = extract_mentioned_agent_ids(body)
        if msg.get("speakerId") or msg.get("speaker_id"):
            existing.speaker_id = str(
                msg.get("speakerId") or msg.get("speaker_id")
            )
        if msg.get("speakerName") or msg.get("speaker_name"):
            existing.speaker_name = str(
                msg.get("speakerName") or msg.get("speaker_name")
            )
        if msg.get("speakerAvatar") is not None or msg.get("speaker_avatar") is not None:
            existing.speaker_avatar = str(
                msg.get("speakerAvatar") or msg.get("speaker_avatar") or ""
            )
        if msg.get("kind"):
            existing.kind = str(msg.get("kind"))
        existing.metadata_ = _build_metadata(msg, existing=dict(existing.metadata_ or {}))
        # Keep channel slug aligned if room moved (same tenant)
        existing.channel_id = channel_id
        existing.channel_slug = channel_slug.lower().strip()
        await session.flush()
        return existing

    created_raw = msg.get("createdAt") or msg.get("created_at")
    if isinstance(created_raw, datetime):
        created_at = created_raw
    elif isinstance(created_raw, str) and created_raw.strip():
        try:
            created_at = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
        except ValueError:
            created_at = _utcnow()
    else:
        created_at = _utcnow()

    metadata = _build_metadata(msg)

    row = Message(
        id=message_id,
        tenant_id=tenant_id,
        channel_id=channel_id,
        channel_slug=channel_slug.lower().strip(),
        speaker_id=str(
            msg.get("speakerId") or msg.get("speaker_id") or "unknown"
        ),
        speaker_name=str(
            msg.get("speakerName") or msg.get("speaker_name") or "unknown"
        ),
        speaker_avatar=str(
            msg.get("speakerAvatar") or msg.get("speaker_avatar") or ""
        ),
        body=body,
        kind=str(msg.get("kind") or "message"),
        mentioned_agent_ids=extract_mentioned_agent_ids(body),
        metadata_=metadata,
        created_at=created_at,
    )
    session.add(row)
    await session.flush()
    return row


async def list_in_progress(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str | None = None,
    limit: int = 50,
) -> list[Message]:
    """Messages still pending/streaming (for recovery after reconnect)."""
    lim = max(1, min(limit, 200))
    q = select(Message).where(Message.tenant_id == tenant_id)
    if channel_id:
        q = q.where(Message.channel_id == channel_id)
    # status lives in JSONB metadata — contains() is portable for asyncpg
    q = q.where(
        or_(
            Message.metadata_.contains({"status": "pending"}),
            Message.metadata_.contains({"status": "streaming"}),
            Message.metadata_.contains({"status": "partial"}),
        )
    )
    q = q.order_by(Message.created_at.desc()).limit(lim)
    result = await session.execute(q)
    rows = list(result.scalars().all())
    rows.reverse()
    return rows
