"""Message repository — primary SoT for fleet channel history."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
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


async def append(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str,
    channel_slug: str,
    msg: dict[str, Any],
) -> Message:
    body = str(msg.get("body") or "")
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

    metadata = {
        "speakerType": msg.get("speakerType") or msg.get("speaker_type") or "agent",
        "agentId": msg.get("agentId") or msg.get("agent_id") or "",
        "status": msg.get("status") or "final",
        "tags": list(msg.get("tags") or []),
    }
    # Preserve any extra keys under metadata
    for key, val in msg.items():
        if key in {
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
        }:
            continue
        if key not in metadata:
            metadata[key] = val

    row = Message(
        id=str(msg.get("id") or _id()),
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
