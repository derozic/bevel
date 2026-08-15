"""Notification ingest — standing target for a dispatch layer."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import require_internal
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import messages as messages_repo
from bevel_api.repositories import tenants as tenants_repo
from bevel_api.repositories import timeline as timeline_repo
from bevel_api.repositories import users as users_repo
from bevel_api.repositories import webhooks as hooks_repo

router = APIRouter(prefix="/v1/ingest", tags=["Ingest"])
InternalAuth = Annotated[None, Depends(require_internal)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
DEFAULT_TENANT = "2x4m"

INGEST_URL = "/api/v1/ingest/notifications"


class NotificationIngestBody(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=4000)
    userId: str = ""
    email: str = ""
    handle: str = ""
    tenant: str | None = None
    track: str = ""
    conversation: str = ""
    deepLink: str = ""
    href: str = ""
    agentId: str = ""
    severity: str = "info"
    persist: bool = True
    push: bool = True
    timeline: bool = True


def _room_slug(body: NotificationIngestBody) -> str | None:
    convo = body.conversation.strip().lower()
    track = body.track.strip().lower().lstrip("~^#")
    return convo or track or None


def _deep_link(body: NotificationIngestBody, slug: str | None) -> str:
    if body.deepLink.strip():
        return body.deepLink.strip()
    if body.href.strip():
        href = body.href.strip()
        return href if href.startswith("bevel:") else f"bevel:/{href}" if href.startswith("/") else href
    if slug and slug.startswith("dm-"):
        agent = body.agentId.strip() or "hermes"
        return f"bevel://talk/{agent}"
    if slug:
        return f"bevel://channel/{slug}"
    return "bevel://timeline"


async def _resolve_user(
    session: AsyncSession, body: NotificationIngestBody
) -> Any | None:
    if body.userId.strip():
        user = await users_repo.get_by_id(session, body.userId.strip())
        if user:
            return user
    if body.email.strip():
        user = await users_repo.get_by_email(session, body.email.strip())
        if user:
            return user
    if body.handle.strip():
        return await users_repo.get_by_handle(
            session, handle=body.handle.strip().lstrip("@^")
        )
    return None


@router.get("/notifications")
async def notification_ingest_contract() -> dict[str, Any]:
    """Standing URL + payload contract for the notification dispatch layer."""
    return {
        "ok": True,
        "ingest": INGEST_URL,
        "method": "POST",
        "auth": "X-Fleet-Internal-Key",
        "example": {
            "title": "Hermes",
            "body": "Your review is ready",
            "handle": "scott",
            "conversation": "dm-usr-hermes",
            "severity": "info",
            "persist": True,
            "push": True,
            "timeline": True,
        },
        "effects": ["persist to track/conversation", "FCM push", "timeline item"],
    }


@router.post("/notifications")
async def ingest_notification(
    body: NotificationIngestBody,
    request: Request,
    _auth: InternalAuth,
    session: SessionDep,
) -> dict[str, Any]:
    """Dispatch-layer ingest: persist + push + timeline in one call."""
    tenant_slug = (body.tenant or DEFAULT_TENANT).strip().lower()
    tenant = await tenants_repo.get_by_slug(session, tenant_slug)
    if tenant is None:
        raise HTTPException(404, f"tenant not found: {tenant_slug}")

    severity = body.severity.strip().lower()
    if severity not in {"info", "warning", "critical"}:
        severity = "info"
    high = severity == "critical"

    user = await _resolve_user(session, body)
    slug = _room_slug(body)
    deep_link = _deep_link(body, slug)
    href = body.href.strip() or (
        f"/talk/{body.agentId.strip() or 'hermes'}"
        if slug and slug.startswith("dm-")
        else f"/~{slug}" if slug else "/timeline"
    )

    persisted = None
    if body.persist and slug:
        ch = await channels_repo.ensure_channel(
            session,
            tenant.id,
            slug,
            name=slug,
            tags=["notification", "ingest"],
        )
        record = await messages_repo.append(
            session,
            tenant_id=tenant.id,
            channel_id=ch.id,
            channel_slug=ch.slug,
            msg={
                "speakerId": f"notify:{body.agentId or 'system'}",
                "speakerName": body.title[:80],
                "speakerType": "system",
                "agentId": body.agentId.strip().lower() or None,
                "body": f"**{body.title}**\n\n{body.body}",
                "status": "final",
                "tags": ["notification", "ingest", severity],
            },
        )
        persisted = messages_repo.to_api_dict(record)

    push_result: dict[str, Any] | None = None
    if body.push and user:
        from bevel_api.lib import fcm as fcm_lib

        if fcm_lib.fcm_configured():
            push_result = await fcm_lib.send_to_user_tokens(
                session,
                user_id=user.id,
                title=body.title,
                body=body.body,
                data={
                    "kind": "notification.dispatched",
                    "deepLink": deep_link,
                    "payload": deep_link,
                    "severity": severity,
                    "href": href,
                },
                high_priority=high,
                android_channel="bevel_escalation" if high else "bevel_workspace",
            )
        else:
            push_result = {"ok": False, "skipped": "fcm_not_configured"}
    elif body.push and not user:
        push_result = {"ok": False, "skipped": "user_not_resolved"}

    timeline_item = None
    if body.timeline and user:
        item = await timeline_repo.upsert_item(
            session,
            tenant_id=tenant.id,
            recipient_user_id=user.id,
            kind="notification",
            priority="high" if high else "normal",
            actor_user_id=None,
            actor_label=body.title,
            source_type="ingest",
            source_id=f"notify:{persisted['id'] if persisted else body.title}",
            channel_slug=slug,
            body_preview=body.body[:500],
            payload={
                "title": body.title,
                "deepLink": deep_link,
                "href": href,
                "severity": severity,
            },
        )
        timeline_item = {"id": item.id, "kind": item.kind}

    try:
        await hooks_repo.emit(
            session,
            tenant_id=tenant.id,
            tenant_slug=tenant.slug,
            event="notification.dispatched",
            data={
                "title": body.title,
                "body": body.body,
                "severity": severity,
                "deepLink": deep_link,
                "href": href,
                "userId": user.id if user else None,
            },
            track=None if (slug or "").startswith("dm-") else slug,
            conversation=slug if (slug or "").startswith("dm-") else None,
            actor={"id": user.id, "handle": user.handle, "email": user.email}
            if user
            else None,
        )
    except Exception:
        pass

    return {
        "ok": True,
        "ingest": INGEST_URL,
        "severity": severity,
        "userId": user.id if user else None,
        "deepLink": deep_link,
        "href": href,
        "track": None if (slug or "").startswith("dm-") else slug,
        "conversation": slug if (slug or "").startswith("dm-") else None,
        "message": persisted,
        "push": push_result,
        "timeline": timeline_item,
    }
