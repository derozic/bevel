"""Timeline feed — reverse-chrono items + source config + message fan-out."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.message import Message
from bevel_api.db.models.timeline import TimelineItem, TimelineSource
from bevel_api.db.models.user import User
from bevel_api.repositories import users as users_repo


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id(prefix: str = "tl") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def to_api_dict(row: TimelineItem) -> dict[str, Any]:
    return {
        "id": row.id,
        "tenantId": row.tenant_id,
        "recipientUserId": row.recipient_user_id,
        "kind": row.kind,
        "priority": row.priority,
        "actorUserId": row.actor_user_id,
        "actorLabel": row.actor_label,
        "sourceType": row.source_type,
        "sourceId": row.source_id,
        "channelSlug": row.channel_slug,
        "bodyPreview": row.body_preview,
        "payload": dict(row.payload or {}),
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "readAt": row.read_at.isoformat() if row.read_at else None,
        "ackedAt": row.acked_at.isoformat() if row.acked_at else None,
        "unread": row.read_at is None,
        "escalated": row.kind == "escalation",
    }


def source_to_api_dict(row: TimelineSource) -> dict[str, Any]:
    return {
        "id": row.id,
        "userId": row.user_id,
        "tenantId": row.tenant_id,
        "sourceKind": row.source_kind,
        "channelSlug": row.channel_slug,
        "githubConfig": dict(row.github_config or {}),
        "enabled": row.enabled,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


async def list_for_user(
    session: AsyncSession,
    *,
    user_id: str,
    kind: str | None = None,
    limit: int = 50,
    before: datetime | None = None,
) -> list[TimelineItem]:
    lim = max(1, min(limit, 200))
    q = select(TimelineItem).where(TimelineItem.recipient_user_id == user_id)
    if kind:
        q = q.where(TimelineItem.kind == kind)
    if before is not None:
        q = q.where(TimelineItem.created_at < before)
    q = q.order_by(TimelineItem.created_at.desc()).limit(lim)
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_item(
    session: AsyncSession, *, item_id: str, user_id: str
) -> TimelineItem | None:
    result = await session.execute(
        select(TimelineItem).where(
            TimelineItem.id == item_id,
            TimelineItem.recipient_user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def mark_read(
    session: AsyncSession, *, item_id: str, user_id: str
) -> TimelineItem | None:
    row = await get_item(session, item_id=item_id, user_id=user_id)
    if not row:
        return None
    if row.read_at is None:
        row.read_at = _utcnow()
        await session.flush()
    return row


async def mark_acked(
    session: AsyncSession, *, item_id: str, user_id: str
) -> TimelineItem | None:
    row = await get_item(session, item_id=item_id, user_id=user_id)
    if not row:
        return None
    now = _utcnow()
    if row.read_at is None:
        row.read_at = now
    if row.acked_at is None:
        row.acked_at = now
    await session.flush()
    return row


async def _find_existing(
    session: AsyncSession,
    *,
    recipient_user_id: str,
    source_type: str,
    source_id: str,
    kind: str,
) -> TimelineItem | None:
    result = await session.execute(
        select(TimelineItem).where(
            TimelineItem.recipient_user_id == recipient_user_id,
            TimelineItem.source_type == source_type,
            TimelineItem.source_id == source_id,
            TimelineItem.kind == kind,
        )
    )
    return result.scalar_one_or_none()


async def upsert_item(
    session: AsyncSession,
    *,
    tenant_id: str,
    recipient_user_id: str,
    kind: str,
    priority: str,
    actor_user_id: str | None,
    actor_label: str,
    source_type: str,
    source_id: str,
    channel_slug: str | None,
    body_preview: str,
    payload: dict[str, Any],
    created_at: datetime | None = None,
) -> TimelineItem:
    existing = await _find_existing(
        session,
        recipient_user_id=recipient_user_id,
        source_type=source_type,
        source_id=source_id,
        kind=kind,
    )
    if existing:
        existing.body_preview = body_preview
        existing.payload = payload
        existing.actor_label = actor_label
        existing.priority = priority
        if channel_slug is not None:
            existing.channel_slug = channel_slug
        await session.flush()
        return existing

    row = TimelineItem(
        id=_id("tl"),
        tenant_id=tenant_id,
        recipient_user_id=recipient_user_id,
        kind=kind,
        priority=priority,
        actor_user_id=actor_user_id,
        actor_label=actor_label or "",
        source_type=source_type,
        source_id=source_id,
        channel_slug=channel_slug,
        body_preview=body_preview[:2000] if body_preview else "",
        payload=payload,
        created_at=created_at or _utcnow(),
    )
    session.add(row)
    await session.flush()
    return row


async def fan_out_from_message(
    session: AsyncSession,
    *,
    message: Message,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    """Create timeline items for @mentions (soft) and ^escalations (hard).

    @handle → kind=mention, priority=normal (feed only)
    ^handle → kind=escalation, priority=high (full notify + personal agent)
    """
    soft = list(message.mentioned_handles or [])
    hard = list(message.escalated_handles or [])
    if not soft and not hard:
        return {"ok": True, "created": 0, "items": []}

    tenant_id = message.tenant_id
    actor_label = message.speaker_name or message.speaker_id or "someone"
    body_preview = (message.body or "")[:500]
    created: list[TimelineItem] = []
    notified: list[dict[str, Any]] = []

    async def resolve_handle(handle: str) -> User | None:
        return await users_repo.get_by_handle(
            session, handle=handle, tenant_id=tenant_id
        ) or await users_repo.get_by_handle(
            session, handle=handle, tenant_id=None
        )

    for handle in soft:
        user = await resolve_handle(handle)
        if not user:
            notified.append({"handle": handle, "kind": "mention", "resolved": False})
            continue
        # Don't fan-out to self
        if actor_user_id and user.id == actor_user_id:
            continue
        item = await upsert_item(
            session,
            tenant_id=tenant_id,
            recipient_user_id=user.id,
            kind="mention",
            priority="normal",
            actor_user_id=actor_user_id,
            actor_label=actor_label,
            source_type="message",
            source_id=message.id,
            channel_slug=message.channel_slug,
            body_preview=body_preview,
            payload={
                "handle": handle,
                "messageId": message.id,
                "channelSlug": message.channel_slug,
                "speakerId": message.speaker_id,
                "notify": False,
                "personalAgentAssist": False,
            },
            created_at=message.created_at,
        )
        created.append(item)
        notified.append(
            {
                "handle": handle,
                "kind": "mention",
                "resolved": True,
                "userId": user.id,
                "itemId": item.id,
            }
        )

    for handle in hard:
        user = await resolve_handle(handle)
        if not user:
            notified.append(
                {"handle": handle, "kind": "escalation", "resolved": False}
            )
            continue
        if actor_user_id and user.id == actor_user_id:
            continue
        item = await upsert_item(
            session,
            tenant_id=tenant_id,
            recipient_user_id=user.id,
            kind="escalation",
            priority="high",
            actor_user_id=actor_user_id,
            actor_label=actor_label,
            source_type="message",
            source_id=message.id,
            channel_slug=message.channel_slug,
            body_preview=body_preview,
            payload={
                "handle": handle,
                "messageId": message.id,
                "channelSlug": message.channel_slug,
                "speakerId": message.speaker_id,
                "notify": True,
                "personalAgentAssist": True,
                "personalAgentId": user.personal_agent_id,
            },
            created_at=message.created_at,
        )
        created.append(item)

        email_result: dict[str, Any] | None = None
        # Hard escalation: email via SendGrid Extension when configured
        payload = dict(item.payload or {})
        already_emailed = bool(payload.get("emailedAt"))
        if not already_emailed and user.email:
            try:
                from bevel_api.lib import sendgrid as sg

                if sg.sendgrid_configured():
                    public_web = (
                        __import__("os").getenv("PUBLIC_WEB_URL")
                        or "https://bevel.2x4m.cc"
                    ).rstrip("/")
                    email_result = await sg.send_escalation_email(
                        to_email=user.email,
                        actor_label=actor_label,
                        body_preview=body_preview,
                        channel_slug=message.channel_slug,
                        timeline_url=f"{public_web}/timeline",
                        personal_agent_id=user.personal_agent_id,
                    )
                    if email_result.get("ok"):
                        payload["emailedAt"] = _utcnow().isoformat()
                        payload["emailProvider"] = "sendgrid"
                        item.payload = payload
                        await session.flush()
            except Exception:
                email_result = {"ok": False, "error": "email_failed"}

        notified.append(
            {
                "handle": handle,
                "kind": "escalation",
                "resolved": True,
                "userId": user.id,
                "itemId": item.id,
                "personalAgentId": user.personal_agent_id,
                "email": email_result,
            }
        )

    return {
        "ok": True,
        "created": len(created),
        "items": [to_api_dict(r) for r in created],
        "notified": notified,
    }


async def list_sources(
    session: AsyncSession, *, user_id: str, tenant_id: str | None = None
) -> list[TimelineSource]:
    q = select(TimelineSource).where(TimelineSource.user_id == user_id)
    if tenant_id:
        q = q.where(TimelineSource.tenant_id == tenant_id)
    q = q.order_by(TimelineSource.created_at.desc())
    result = await session.execute(q)
    return list(result.scalars().all())


async def upsert_source(
    session: AsyncSession,
    *,
    user_id: str,
    tenant_id: str,
    source_kind: str,
    channel_slug: str | None = None,
    github_config: dict[str, Any] | None = None,
    enabled: bool = True,
    source_id: str | None = None,
) -> TimelineSource:
    kind = source_kind.strip().lower()
    slug = channel_slug.lower().strip() if channel_slug else None

    if source_id:
        result = await session.execute(
            select(TimelineSource).where(
                TimelineSource.id == source_id,
                TimelineSource.user_id == user_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.source_kind = kind
            existing.channel_slug = slug
            if github_config is not None:
                existing.github_config = github_config
            existing.enabled = enabled
            existing.updated_at = _utcnow()
            await session.flush()
            return existing

    # Match existing by kind + channel for idempotent channel sources
    if slug:
        result = await session.execute(
            select(TimelineSource).where(
                TimelineSource.user_id == user_id,
                TimelineSource.tenant_id == tenant_id,
                TimelineSource.source_kind == kind,
                TimelineSource.channel_slug == slug,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            if github_config is not None:
                existing.github_config = github_config
            existing.enabled = enabled
            existing.updated_at = _utcnow()
            await session.flush()
            return existing

    row = TimelineSource(
        id=_id("tls"),
        user_id=user_id,
        tenant_id=tenant_id,
        source_kind=kind,
        channel_slug=slug,
        github_config=dict(github_config or {}),
        enabled=enabled,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(row)
    await session.flush()
    return row
