"""Fleet channel + message REST — Postgres-backed."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import require_internal
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import messages as messages_repo
from bevel_api.repositories import tenants as tenants_repo

router = APIRouter(prefix="/v1/fleet", tags=["Fleet"])

InternalAuth = Annotated[None, Depends(require_internal)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]

DEFAULT_TENANT_SLUG = "2x4m"


async def _resolve_tenant(
    session: AsyncSession,
    tenant_slug: str | None,
) -> Any:
    slug = (tenant_slug or DEFAULT_TENANT_SLUG).strip().lower()
    tenant = await tenants_repo.get_by_slug(session, slug)
    if tenant is None:
        # Soft-create from YAML if present
        from bevel_api.lib import tenants as yaml_tenants

        try:
            raw = yaml_tenants.load_tenant(slug)
            tenant = await tenants_repo.upsert_from_yaml(session, slug, raw)
            await channels_repo.ensure_defaults(session, tenant.id)
        except FileNotFoundError as exc:
            raise HTTPException(404, f"tenant not found: {slug}") from exc
    return tenant


class CreateChannelBody(BaseModel):
    slug: str = Field(..., min_length=1, max_length=64)
    name: str | None = None
    tags: list[str] = Field(default_factory=list)
    defaultAgentIds: list[str] | None = None
    description: str = ""
    tenant: str | None = None


@router.get("/channels")
async def list_channels(
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None, description="Tenant slug"),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    channels = await channels_repo.list_for_tenant(session, row.id)
    if not channels:
        channels = await channels_repo.ensure_defaults(session, row.id)
    return {
        "tenant": row.slug,
        "channels": [channels_repo.to_api_dict(c) for c in channels],
    }


@router.post("/channels")
async def create_channel(
    body: CreateChannelBody,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None, description="Tenant slug"),
) -> dict[str, Any]:
    """Create (or return existing) fleet channel by slug."""
    row = await _resolve_tenant(session, body.tenant or tenant)
    key = body.slug.lower().strip()
    key = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in key).strip("-")
    if not key:
        raise HTTPException(400, "Channel slug required")

    existing = await channels_repo.get_by_slug(session, row.id, key)
    created = existing is None
    ch = await channels_repo.ensure_channel(
        session,
        row.id,
        key,
        name=body.name,
        description=body.description,
        tags=body.tags or None,
        default_agent_ids=body.defaultAgentIds,
    )
    await session.commit()
    if created:
        try:
            from bevel_api.repositories import webhooks as hooks_repo

            await hooks_repo.emit(
                session,
                tenant_id=row.id,
                tenant_slug=row.slug,
                event="track.created",
                data=channels_repo.to_api_dict(ch),
                track=ch.slug,
            )
            await session.commit()
        except Exception:
            pass
    payload = channels_repo.to_api_dict(ch)
    return {
        "tenant": row.slug,
        "created": created,
        "channel": payload,
        "slug": payload.get("slug"),
        "name": payload.get("name"),
        "tags": payload.get("tags") or [],
    }


@router.get("/channels/{slug}")
async def get_channel(
    slug: str,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    return channels_repo.to_api_dict(ch)


@router.get("/channels/{slug}/messages")
async def get_messages(
    slug: str,
    _auth: InternalAuth,
    session: SessionDep,
    limit: int = Query(default=100, ge=1, le=500),
    before: str | None = Query(
        default=None,
        description="ISO datetime cursor — return messages strictly older than this",
    ),
    before_id: str | None = Query(
        default=None,
        description="Message id tie-breaker when created_at matches before",
    ),
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    """Paginated channel history (newest page when before is omitted).

    Pass ``nextBefore`` / ``nextBeforeId`` from the previous response to walk
    older pages. Pages are chronological within the payload.
    """
    from datetime import datetime

    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    before_dt: datetime | None = None
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(400, "before must be ISO datetime") from exc
    msgs, has_more = await messages_repo.list_for_channel(
        session,
        tenant_id=row.id,
        channel_id=ch.id,
        limit=limit,
        before=before_dt,
        before_id=(before_id or None),
    )
    cursors = messages_repo.pagination_cursors(msgs)
    return {
        "tenant": row.slug,
        "channel": ch.slug,
        "messages": [messages_repo.to_api_dict(m) for m in msgs],
        "hasMore": has_more,
        "nextBefore": cursors["nextBefore"],
        "nextBeforeId": cursors["nextBeforeId"],
        "limit": limit,
    }


@router.post("/channels/{slug}/messages")
async def post_message(
    slug: str,
    request: Request,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    """Upsert a channel message (idempotent by ``id``).

    Clients may re-POST the same id for retries or streaming status updates
    (``pending`` / ``streaming`` / ``final``). Postgres is the durable SoT.
    """
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    if not isinstance(body, dict):
        raise HTTPException(400, "JSON object required")
    # New message needs body; updates (same id) may only change status/body
    has_id = bool(str(body.get("id") or "").strip())
    has_body = bool(str(body.get("body") or "").strip())
    if not has_body and not has_id:
        raise HTTPException(400, "body required (or id for status update)")

    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    try:
        record = await messages_repo.append(
            session,
            tenant_id=row.id,
            channel_id=ch.id,
            channel_slug=ch.slug,
            msg=body,
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc

    # Fan-out @mentions (soft) and ^escalations into personal timelines
    timeline_fanout: dict[str, Any] | None = None
    meta = dict(record.metadata_ or {})
    status = str(meta.get("status") or "final")
    if status not in {"pending", "streaming", "partial"} and (
        record.mentioned_handles or record.escalated_handles
    ):
        try:
            from bevel_api.repositories import timeline as timeline_repo

            actor_user_id = (
                str(body.get("actorUserId") or body.get("actor_user_id") or "")
                .strip()
                or None
            )
            # speakerId may be human:<id>
            if not actor_user_id:
                sid = str(record.speaker_id or "")
                if sid.startswith("human:"):
                    actor_user_id = sid.split(":", 1)[1] or None
            timeline_fanout = await timeline_repo.fan_out_from_message(
                session,
                message=record,
                actor_user_id=actor_user_id,
            )
        except Exception:
            # Never block message write on timeline failures
            timeline_fanout = {"ok": False, "error": "fanout_failed"}

    webhook_out = 0
    try:
        from bevel_api.routers.webhooks import dispatch_message_created

        prior = await messages_repo.count_for_channel(
            session, tenant_id=row.id, channel_id=ch.id
        )
        webhook_out = await dispatch_message_created(
            session,
            tenant_id=row.id,
            tenant_slug=row.slug,
            channel_slug=ch.slug,
            message=messages_repo.to_api_dict(record),
            first_in_room=prior <= 1,
        )
    except Exception:
        webhook_out = 0

    return {
        "ok": True,
        "upserted": True,
        "message": messages_repo.to_api_dict(record),
        "timeline": timeline_fanout,
        "webhooks": webhook_out,
    }


class GestureBody(BaseModel):
    kind: str = Field(min_length=2, max_length=16)
    userId: str = Field(min_length=1, max_length=128)
    userName: str = ""


@router.post("/channels/{slug}/messages/{message_id}/gestures")
async def post_message_gesture(
    slug: str,
    message_id: str,
    payload: GestureBody,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    """Toggle an operator gesture (thumbs / star / heart / vote) on a message."""
    kind = payload.kind.strip().lower()
    if kind not in messages_repo.GESTURE_KINDS:
        raise HTTPException(400, f"unknown gesture: {payload.kind}")
    row = await _resolve_tenant(session, tenant)
    record = await messages_repo.record_gesture(
        session,
        tenant_id=row.id,
        message_id=message_id,
        kind=kind,
        user_id=payload.userId,
        user_name=payload.userName,
    )
    if record is None:
        raise HTTPException(404, "message not found")
    if record.channel_slug != slug.lower().strip():
        raise HTTPException(404, "message not found")
    try:
        from bevel_api.repositories import webhooks as hooks_repo

        room = record.channel_slug
        await hooks_repo.emit(
            session,
            tenant_id=row.id,
            tenant_slug=row.slug,
            event="gesture.created",
            data={
                "messageId": record.id,
                "kind": kind,
                "userId": payload.userId,
                "userName": payload.userName,
            },
            track=None if room.startswith("dm-") else room,
            conversation=room if room.startswith("dm-") else None,
            actor={"id": payload.userId, "name": payload.userName},
        )
    except Exception:
        pass
    return {"ok": True, "message": messages_repo.to_api_dict(record)}


@router.get("/channels/{slug}/messages/in-progress")
async def get_in_progress_messages(
    slug: str,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    """Recover pending/streaming messages after client reconnect."""
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    msgs = await messages_repo.list_in_progress(
        session,
        tenant_id=row.id,
        channel_id=ch.id,
        limit=limit,
    )
    return {
        "tenant": row.slug,
        "channel": ch.slug,
        "messages": [messages_repo.to_api_dict(m) for m in msgs],
    }
