"""Message repository — primary SoT for fleet channel history."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.message import Message
from bevel_api.lib.tenants import catalog_agents

# @agent or @Name tokens used in chat (agents + soft person mentions)
_MENTION_RE = re.compile(r"(?<![a-zA-Z0-9_])@([a-zA-Z0-9_-]{2,64})\b")
# ^handle escalations (people) — full notify + personal agent
_ESCALATION_RE = re.compile(r"(?<![a-zA-Z0-9_])\^([a-zA-Z0-9_-]{2,64})\b")

# Fleet agent ids — @these stay agent dispatch, not people timeline soft-mentions
# (unless a real user also claims that handle; fan-out resolves users first).
def _known_fleet_agent_ids() -> frozenset[str]:
    ids = {str(a["id"]).lower() for a in catalog_agents() if a.get("id")}
    ids.update({"system", "terry", "forge"})
    return frozenset(ids)


KNOWN_FLEET_AGENT_IDS: frozenset[str] = _known_fleet_agent_ids()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return f"msg_{uuid.uuid4().hex[:16]}"


def _unique_tokens(matches: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for token in matches:
        t = token.lower()
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def extract_mentioned_agent_ids(body: str) -> list[str]:
    """All @tokens — agents resolve client-side; also used as soft person handles."""
    if not body:
        return []
    return _unique_tokens([m.group(1) for m in _MENTION_RE.finditer(body)])


def extract_mentioned_handles(
    body: str,
    *,
    exclude_agent_ids: frozenset[str] | None = None,
) -> list[str]:
    """@username soft mentions → timeline feed without full notification fan-out.

    Pure fleet agent tokens (e.g. @hermes) are excluded by default so agent
    chips do not pollute people handles. A person who shares an agent id as
    their handle is still reachable via fan-out if they exist in users.
    """
    if not body:
        return []
    skip = exclude_agent_ids if exclude_agent_ids is not None else KNOWN_FLEET_AGENT_IDS
    tokens = _unique_tokens([m.group(1) for m in _MENTION_RE.finditer(body)])
    return [t for t in tokens if t not in skip]


def extract_escalated_handles(body: str) -> list[str]:
    """^username escalations → full notify + personal agent assist."""
    if not body:
        return []
    return _unique_tokens([m.group(1) for m in _ESCALATION_RE.finditer(body)])


GESTURE_KINDS = frozenset({"up", "down", "star", "heart", "vote_yes", "vote_no"})
_GESTURE_OPPOSITE = {
    "up": "down",
    "down": "up",
    "vote_yes": "vote_no",
    "vote_no": "vote_yes",
}


def normalize_gestures(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, str):
        try:
            import json

            raw = json.loads(raw)
        except (TypeError, ValueError):
            return []
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or "").strip()
        user_id = str(item.get("userId") or item.get("user_id") or "").strip()
        if kind not in GESTURE_KINDS or not user_id:
            continue
        out.append(
            {
                "kind": kind,
                "userId": user_id,
                "userName": str(item.get("userName") or item.get("user_name") or ""),
                "ts": int(item.get("ts") or 0),
            }
        )
    return out


def apply_gesture(
    current: list[dict[str, Any]],
    *,
    kind: str,
    user_id: str,
    user_name: str = "",
    ts: int | None = None,
) -> list[dict[str, Any]]:
    """Toggle one operator gesture. Thumbs and votes are exclusive pairs."""
    kind = kind.strip()
    user_id = user_id.strip()
    if kind not in GESTURE_KINDS or not user_id:
        return current
    stamp = int(ts or datetime.now(timezone.utc).timestamp() * 1000)
    opposite = _GESTURE_OPPOSITE.get(kind)
    had_same = any(g.get("userId") == user_id and g.get("kind") == kind for g in current)
    kept = [
        g
        for g in current
        if not (
            g.get("userId") == user_id
            and (g.get("kind") == kind or (opposite and g.get("kind") == opposite))
        )
    ]
    if had_same:
        return kept
    kept.append(
        {
            "kind": kind,
            "userId": user_id,
            "userName": user_name.strip(),
            "ts": stamp,
        }
    )
    return kept


def to_api_dict(row: Message) -> dict[str, Any]:
    meta = dict(row.metadata_ or {})
    reactions = normalize_gestures(meta.get("reactions") or meta.get("gestures"))
    vote_prompt = str(meta.get("votePrompt") or meta.get("vote_prompt") or "").strip()
    vote_required = bool(meta.get("voteRequired") or meta.get("vote_required") or vote_prompt)
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
        "mentionedHandles": list(row.mentioned_handles or []),
        "escalatedHandles": list(row.escalated_handles or []),
        "reactions": reactions,
        "votePrompt": vote_prompt or None,
        "voteRequired": vote_required,
        "channelSlug": row.channel_slug,
        "tenantId": row.tenant_id,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def page_limit(limit: int, *, default: int = 100, hard_max: int = 500) -> int:
    """Clamp a page size for channel history queries."""
    try:
        n = int(limit)
    except (TypeError, ValueError):
        n = default
    return max(1, min(n, hard_max))


async def list_for_channel(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str,
    limit: int = 100,
    before: datetime | None = None,
    before_id: str | None = None,
) -> tuple[list[Message], bool]:
    """Return a chronological page of messages and whether older rows remain.

    Cursor is ``(before, before_id)`` on the oldest message from the previous
    page (exclusive). Fetches ``limit + 1`` to compute ``has_more``.
    """
    lim = page_limit(limit)
    q = select(Message).where(
        Message.tenant_id == tenant_id,
        Message.channel_id == channel_id,
    )
    if before is not None:
        if before_id:
            q = q.where(
                or_(
                    Message.created_at < before,
                    and_(Message.created_at == before, Message.id < before_id),
                )
            )
        else:
            q = q.where(Message.created_at < before)
    q = q.order_by(Message.created_at.desc(), Message.id.desc()).limit(lim + 1)
    result = await session.execute(q)
    rows = list(result.scalars().all())
    has_more = len(rows) > lim
    if has_more:
        rows = rows[:lim]
    rows.reverse()  # chronological
    return rows, has_more


async def count_for_channel(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str,
) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(Message)
        .where(Message.tenant_id == tenant_id, Message.channel_id == channel_id)
    )
    return int(result.scalar_one() or 0)


async def list_for_channel_slug(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_slug: str,
    limit: int = 100,
    before: datetime | None = None,
    before_id: str | None = None,
) -> tuple[list[Message], bool]:
    lim = page_limit(limit)
    key = channel_slug.lower().strip()
    q = select(Message).where(
        Message.tenant_id == tenant_id,
        Message.channel_slug == key,
    )
    if before is not None:
        if before_id:
            q = q.where(
                or_(
                    Message.created_at < before,
                    and_(Message.created_at == before, Message.id < before_id),
                )
            )
        else:
            q = q.where(Message.created_at < before)
    q = q.order_by(Message.created_at.desc(), Message.id.desc()).limit(lim + 1)
    result = await session.execute(q)
    rows = list(result.scalars().all())
    has_more = len(rows) > lim
    if has_more:
        rows = rows[:lim]
    rows.reverse()
    return rows, has_more


def pagination_cursors(msgs: list[Message]) -> dict[str, Any]:
    """Build next-page cursors from the oldest message in a page."""
    if not msgs:
        return {"nextBefore": None, "nextBeforeId": None}
    oldest = msgs[0]
    return {
        "nextBefore": oldest.created_at.isoformat() if oldest.created_at else None,
        "nextBeforeId": oldest.id,
    }


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
            existing.mentioned_handles = extract_mentioned_handles(body)
            existing.escalated_handles = extract_escalated_handles(body)
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
        mentioned_handles=extract_mentioned_handles(body),
        escalated_handles=extract_escalated_handles(body),
        metadata_=metadata,
        created_at=created_at,
    )
    session.add(row)
    await session.flush()
    return row


async def record_gesture(
    session: AsyncSession,
    *,
    tenant_id: str,
    message_id: str,
    kind: str,
    user_id: str,
    user_name: str = "",
) -> Message | None:
    """Apply an operator gesture onto message metadata and return the row."""
    row = await get_by_id(session, message_id)
    if row is None or row.tenant_id != tenant_id:
        return None
    meta = dict(row.metadata_ or {})
    current = normalize_gestures(meta.get("reactions") or meta.get("gestures"))
    meta["reactions"] = apply_gesture(
        current,
        kind=kind,
        user_id=user_id,
        user_name=user_name,
    )
    row.metadata_ = meta
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
