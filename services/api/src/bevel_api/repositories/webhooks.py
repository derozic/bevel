"""Workflow webhooks — start and end in tracks and conversations."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.config import settings
from bevel_api.db.models.webhook import Webhook, WebhookDelivery
from bevel_api.repositories.channels import is_direct_thread_slug

DIRECTIONS = frozenset({"inbound", "outbound"})
TARGET_KINDS = frozenset({"track", "conversation", "any"})

EVENT_CATALOG: list[dict[str, str]] = [
    {
        "id": "ftue.started",
        "family": "ftue",
        "direction": "both",
        "description": "First-time user entered Bevel (signup, claim, or inbound welcome).",
    },
    {
        "id": "ftue.first_message",
        "family": "ftue",
        "direction": "outbound",
        "description": "First human message in their personal conversation.",
    },
    {
        "id": "ftue.completed",
        "family": "ftue",
        "direction": "both",
        "description": "Onboarding finished.",
    },
    {
        "id": "user.created",
        "family": "user",
        "direction": "outbound",
        "description": "Identity row created in Postgres.",
    },
    {
        "id": "message.created",
        "family": "message",
        "direction": "both",
        "description": "A final message landed in a track or conversation.",
    },
    {
        "id": "gesture.created",
        "family": "message",
        "direction": "outbound",
        "description": "Thumbs, star, heart, or vote on a message.",
    },
    {
        "id": "mention.created",
        "family": "message",
        "direction": "outbound",
        "description": "@handle or ^handle extracted from a message.",
    },
    {
        "id": "track.created",
        "family": "track",
        "direction": "outbound",
        "description": "A new track (~slug) was created.",
    },
    {
        "id": "conversation.started",
        "family": "conversation",
        "direction": "outbound",
        "description": "First turn in a direct thread (dm-*).",
    },
    {
        "id": "workflow.started",
        "family": "workflow",
        "direction": "both",
        "description": "External pipeline began.",
    },
    {
        "id": "workflow.completed",
        "family": "workflow",
        "direction": "both",
        "description": "External pipeline finished in a room.",
    },
    {
        "id": "workflow.failed",
        "family": "workflow",
        "direction": "both",
        "description": "External pipeline failed.",
    },
    {
        "id": "notification.dispatched",
        "family": "notification",
        "direction": "both",
        "description": "Notification dispatch layer ingested an alert.",
    },
]
IN_EVENTS = tuple(
    e["id"] for e in EVENT_CATALOG if e["direction"] in {"both", "inbound"}
)
OUT_EVENTS = tuple(
    e["id"] for e in EVENT_CATALOG if e["direction"] in {"both", "outbound"}
)
ROOM_EVENTS = frozenset(
    {
        "message.created",
        "gesture.created",
        "mention.created",
        "conversation.started",
        "ftue.first_message",
        "workflow.started",
        "workflow.completed",
        "workflow.failed",
    }
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return f"wh_{uuid.uuid4().hex}"


def new_secret() -> str:
    return secrets.token_urlsafe(24)


def inbound_url(hook_id: str) -> str:
    base = settings.public_api_url.rstrip("/")
    return f"{base}/api/v1/webhooks/inbound/{hook_id}"


def is_safe_outbound_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in {"https", "http"}:
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    if host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
        return True
    if host.endswith(".local") or host.endswith(".internal"):
        return False
    if host.startswith("10.") or host.startswith("192.168.") or host.startswith("169.254."):
        return False
    if host.startswith("172."):
        try:
            second = int(host.split(".")[1])
        except (IndexError, ValueError):
            return False
        if 16 <= second <= 31:
            return False
    return parsed.scheme == "https" or host.endswith(".lvh.me")


def sign_body(secret: str, raw: str, ts: int) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        f"{ts}.{raw}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"t={ts},v1={digest}"


def verify_request(secret: str, raw: str, *, signature: str | None, bearer: str | None) -> bool:
    if bearer and hmac.compare_digest(bearer, secret):
        return True
    header = (signature or "").strip()
    if not header or not secret:
        return False
    if header.startswith("sha256="):
        digest = hmac.new(secret.encode("utf-8"), raw.encode("utf-8"), hashlib.sha256).hexdigest()
        return hmac.compare_digest(header[7:], digest)
    parts = dict(bit.split("=", 1) for bit in header.split(",") if "=" in bit)
    ts = parts.get("t")
    v1 = parts.get("v1")
    if not ts or not v1:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{ts}.{raw}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(v1, expected)


def to_api_dict(row: Webhook, *, include_secret: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": row.id,
        "name": row.name,
        "direction": row.direction,
        "targetKind": row.target_kind,
        "targetId": row.target_id,
        "url": row.url,
        "events": list(row.events or []),
        "enabled": row.enabled,
        "inboundUrl": inbound_url(row.id) if row.direction == "inbound" else None,
        "lastStatus": row.last_status,
        "lastError": row.last_error,
        "lastDeliveryAt": row.last_delivery_at.isoformat() if row.last_delivery_at else None,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }
    if include_secret:
        out["secret"] = row.secret
    return out


async def list_for_tenant(session: AsyncSession, tenant_id: str) -> list[Webhook]:
    result = await session.execute(
        select(Webhook)
        .where(Webhook.tenant_id == tenant_id)
        .order_by(Webhook.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, hook_id: str) -> Webhook | None:
    result = await session.execute(select(Webhook).where(Webhook.id == hook_id))
    return result.scalar_one_or_none()


async def create(
    session: AsyncSession,
    *,
    tenant_id: str,
    name: str,
    direction: str,
    target_kind: str = "any",
    target_id: str = "",
    url: str = "",
    events: list[str] | None = None,
    created_by: str | None = None,
) -> Webhook:
    direction = direction.strip().lower()
    target_kind = (target_kind or "any").strip().lower()
    if direction not in DIRECTIONS:
        raise ValueError("direction must be inbound or outbound")
    if target_kind not in TARGET_KINDS:
        raise ValueError("targetKind must be track, conversation, or any")
    if direction == "outbound":
        if not is_safe_outbound_url(url):
            raise ValueError("outbound url must be http(s) and not a private host")
    row = Webhook(
        id=_id(),
        tenant_id=tenant_id,
        name=name.strip() or "Webhook",
        direction=direction,
        secret=new_secret(),
        target_kind=target_kind,
        target_id=(target_id or "").strip().lower().lstrip("~^#"),
        url=(url or "").strip(),
        events=list(events or (list(IN_EVENTS) if direction == "inbound" else list(OUT_EVENTS))),
        created_by=created_by,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(row)
    await session.flush()
    return row


async def update(
    session: AsyncSession,
    row: Webhook,
    *,
    name: str | None = None,
    enabled: bool | None = None,
    url: str | None = None,
    target_kind: str | None = None,
    target_id: str | None = None,
    events: list[str] | None = None,
) -> Webhook:
    if name is not None:
        row.name = name.strip() or row.name
    if enabled is not None:
        row.enabled = bool(enabled)
    if url is not None:
        if row.direction == "outbound" and url and not is_safe_outbound_url(url):
            raise ValueError("outbound url must be http(s) and not a private host")
        row.url = url.strip()
    if target_kind is not None:
        kind = target_kind.strip().lower()
        if kind not in TARGET_KINDS:
            raise ValueError("targetKind must be track, conversation, or any")
        row.target_kind = kind
    if target_id is not None:
        row.target_id = target_id.strip().lower().lstrip("~^#")
    if events is not None:
        row.events = list(events)
    row.updated_at = _utcnow()
    await session.flush()
    return row


async def delete(session: AsyncSession, row: Webhook) -> None:
    await session.delete(row)
    await session.flush()


def matches_room(row: Webhook, slug: str) -> bool:
    slug = slug.strip().lower()
    if not row.enabled:
        return False
    if row.target_kind == "any":
        if row.target_id and row.target_id != slug:
            return False
        return True
    if row.target_kind == "conversation":
        if not is_direct_thread_slug(slug):
            return False
        return not row.target_id or row.target_id == slug
    if row.target_kind == "track":
        if is_direct_thread_slug(slug):
            return False
        return not row.target_id or row.target_id == slug
    return False


def resolve_inbound_slug(row: Webhook, body: dict[str, Any]) -> str | None:
    track = str(body.get("track") or body.get("channel") or "").strip().lower().lstrip("~^#")
    convo = str(
        body.get("conversation") or body.get("sessionId") or body.get("session") or ""
    ).strip().lower()
    if row.target_kind == "track":
        return row.target_id or track or None
    if row.target_kind == "conversation":
        return row.target_id or convo or None
    return track or convo or None


async def list_outbound_for_room(
    session: AsyncSession,
    *,
    tenant_id: str,
    slug: str,
) -> list[Webhook]:
    result = await session.execute(
        select(Webhook).where(
            Webhook.tenant_id == tenant_id,
            Webhook.direction == "outbound",
            Webhook.enabled.is_(True),
        )
    )
    return [row for row in result.scalars().all() if matches_room(row, slug)]


async def mark_delivery(
    session: AsyncSession,
    row: Webhook,
    *,
    status: str,
    error: str | None = None,
) -> None:
    row.last_status = status
    row.last_error = (error or "")[:500] or None
    row.last_delivery_at = _utcnow()
    row.updated_at = _utcnow()
    await session.flush()


def hook_wants_event(row: Webhook, event: str) -> bool:
    events = [str(e) for e in (row.events or [])]
    if not events or "*" in events:
        return True
    if event in events:
        return True
    family = event.split(".", 1)[0]
    return f"{family}.*" in events


def envelope(
    *,
    event: str,
    tenant_slug: str,
    data: dict[str, Any],
    track: str | None = None,
    conversation: str | None = None,
    actor: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": f"evt_{uuid.uuid4().hex[:20]}",
        "type": event,
        "tenant": tenant_slug,
        "occurredAt": _utcnow().isoformat(),
        "track": track,
        "conversation": conversation,
        "actor": actor,
        "data": data,
    }


async def deliver_outbound(row: Webhook, payload: dict[str, Any]) -> tuple[bool, str, int]:
    if not row.url:
        return False, "missing url", 0
    import asyncio
    import json

    raw = json.dumps(payload, separators=(",", ":"), default=str)
    ts = int(_utcnow().timestamp())
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Bevel-Webhook/1.0",
        "X-Bevel-Signature": sign_body(row.secret, raw, ts),
        "X-Bevel-Event": str(payload.get("type") or "event"),
        "X-Bevel-Webhook": row.id,
    }
    last = "undelivered"
    attempts = 0
    for attempt in range(1, 4):
        attempts = attempt
        try:
            async with httpx.AsyncClient(timeout=2.5, follow_redirects=False) as client:
                res = await client.post(row.url, content=raw, headers=headers)
            last = f"http {res.status_code}"
            if 200 <= res.status_code < 300:
                return True, last, attempts
            if res.status_code < 500 and res.status_code != 429:
                return False, last, attempts
        except Exception as exc:
            last = str(exc)[:240]
        if attempt < 3:
            await asyncio.sleep(0.15 * attempt)
    return False, last, attempts


async def log_delivery(
    session: AsyncSession,
    row: Webhook,
    *,
    event: str,
    payload: dict[str, Any],
    ok: bool,
    detail: str,
    attempts: int,
) -> None:
    rec = WebhookDelivery(
        id=f"wd_{uuid.uuid4().hex}",
        webhook_id=row.id,
        tenant_id=row.tenant_id,
        event=event,
        status="ok" if ok else "error",
        attempts=attempts,
        response_status=detail[:32],
        error=None if ok else detail[:500],
        payload={
            "type": payload.get("type"),
            "track": payload.get("track"),
            "conversation": payload.get("conversation"),
            "actor": payload.get("actor"),
        },
        created_at=_utcnow(),
    )
    session.add(rec)
    await mark_delivery(session, row, status="ok" if ok else "error", error=None if ok else detail)


async def list_deliveries(
    session: AsyncSession, hook_id: str, *, limit: int = 25
) -> list[WebhookDelivery]:
    result = await session.execute(
        select(WebhookDelivery)
        .where(WebhookDelivery.webhook_id == hook_id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(max(1, min(limit, 100)))
    )
    return list(result.scalars().all())


def delivery_to_api(row: WebhookDelivery) -> dict[str, Any]:
    return {
        "id": row.id,
        "event": row.event,
        "status": row.status,
        "attempts": row.attempts,
        "responseStatus": row.response_status,
        "error": row.error,
        "payload": row.payload,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


async def emit(
    session: AsyncSession,
    *,
    tenant_id: str,
    tenant_slug: str,
    event: str,
    data: dict[str, Any],
    track: str | None = None,
    conversation: str | None = None,
    actor: dict[str, Any] | None = None,
    skip_if_webhook_tagged: bool = False,
) -> int:
    """Fan out an outbound event to matching hooks. Never raises."""
    if skip_if_webhook_tagged:
        tags = data.get("tags") if isinstance(data, dict) else None
        if isinstance(tags, list) and "webhook" in tags:
            return 0
    result = await session.execute(
        select(Webhook).where(
            Webhook.tenant_id == tenant_id,
            Webhook.direction == "outbound",
            Webhook.enabled.is_(True),
        )
    )
    hooks = list(result.scalars().all())
    room = conversation or track
    payload = envelope(
        event=event,
        tenant_slug=tenant_slug,
        data=data,
        track=track,
        conversation=conversation,
        actor=actor,
    )
    sent = 0
    for hook in hooks:
        if not hook_wants_event(hook, event):
            continue
        if event in ROOM_EVENTS and room and not matches_room(hook, room):
            continue
        try:
            ok, detail, attempts = await deliver_outbound(hook, payload)
            await log_delivery(
                session,
                hook,
                event=event,
                payload=payload,
                ok=ok,
                detail=detail,
                attempts=attempts,
            )
            if ok:
                sent += 1
        except Exception:
            continue
    return sent
