"""Workflow webhooks REST — inbound ingest + CRUD + outbound dispatch hook."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.user import User
from bevel_api.deps import get_session
from bevel_api.lib import memberships as memberships_lib
from bevel_api.lib import tenants as yaml_tenants
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import messages as messages_repo
from bevel_api.repositories import tenants as tenants_repo
from bevel_api.repositories import users as users_repo
from bevel_api.repositories import webhooks as hooks_repo
from bevel_api.routers.timeline import _require_user, _user_id_from_headers

router = APIRouter(prefix="/v1", tags=["Webhooks"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def _tenant(session: AsyncSession, slug: str | None) -> Any:
    key = (slug or "").strip().lower()
    if not key:
        raise HTTPException(400, "tenant required")
    row = await tenants_repo.get_by_slug(session, key)
    if row:
        return row
    try:
        raw = yaml_tenants.load_tenant(key)
        return await tenants_repo.upsert_from_yaml(session, key, raw)
    except FileNotFoundError as exc:
        raise HTTPException(404, f"tenant not found: {key}") from exc


async def _home_slug(session: AsyncSession, user: User) -> str | None:
    if not user.tenant_id:
        return None
    home = await tenants_repo.get_by_id(session, user.tenant_id)
    return home.slug if home else None


async def _authorized_tenant(
    session: AsyncSession, user: User, slug: str | None
) -> Any:
    key = (slug or "").strip().lower()
    if not key:
        key = (await _home_slug(session, user) or "").strip().lower()
    if not key:
        raise HTTPException(400, "tenant required")
    row = await _tenant(session, key)
    email = (user.email or "").strip().lower()
    if not memberships_lib.user_may_access_workspace(
        email, row.slug, home_slug=await _home_slug(session, user)
    ):
        raise HTTPException(403, "not a member of this workspace")
    return row


async def _hook_for_tenant(session: AsyncSession, hook_id: str, tenant_id: str) -> Any:
    hook = await hooks_repo.get_by_id(session, hook_id)
    if hook is None or hook.tenant_id != tenant_id:
        raise HTTPException(404, "webhook not found")
    return hook


class CreateWebhookBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    direction: str = Field(min_length=2, max_length=16)
    targetKind: str = "any"
    targetId: str = ""
    url: str = ""
    events: list[str] | None = None
    tenant: str | None = None


class PatchWebhookBody(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    url: str | None = None
    targetKind: str | None = None
    targetId: str | None = None
    events: list[str] | None = None
    tenant: str | None = None


@router.get("/webhooks/events")
async def list_webhook_events() -> dict[str, Any]:
    return {
        "ok": True,
        "events": hooks_repo.EVENT_CATALOG,
        "families": sorted({e["family"] for e in hooks_repo.EVENT_CATALOG}),
    }


@router.get("/webhooks")
async def list_webhooks(
    request: Request,
    session: SessionDep,
    tenant: str | None = Query(default=None),
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session, request, user_id=uid, email=email, name=x_bevel_user_name
    )
    row = await _authorized_tenant(session, user, tenant)
    hooks = await hooks_repo.list_for_tenant(session, row.id)
    return {
        "ok": True,
        "tenant": row.slug,
        "webhooks": [hooks_repo.to_api_dict(h) for h in hooks],
    }


@router.post("/webhooks")
async def create_webhook(
    body: CreateWebhookBody,
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session, request, user_id=uid, email=email, name=x_bevel_user_name
    )
    row = await _authorized_tenant(session, user, body.tenant)
    try:
        hook = await hooks_repo.create(
            session,
            tenant_id=row.id,
            name=body.name,
            direction=body.direction,
            target_kind=body.targetKind,
            target_id=body.targetId,
            url=body.url,
            events=body.events,
            created_by=user.id,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {
        "ok": True,
        "webhook": hooks_repo.to_api_dict(hook, include_secret=True),
        "hint": "Copy the secret now — it is not shown again.",
    }


@router.patch("/webhooks/{hook_id}")
async def patch_webhook(
    hook_id: str,
    body: PatchWebhookBody,
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session, request, user_id=uid, email=email, name=x_bevel_user_name
    )
    row = await _authorized_tenant(session, user, body.tenant)
    hook = await _hook_for_tenant(session, hook_id, row.id)
    try:
        hook = await hooks_repo.update(
            session,
            hook,
            name=body.name,
            enabled=body.enabled,
            url=body.url,
            target_kind=body.targetKind,
            target_id=body.targetId,
            events=body.events,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "webhook": hooks_repo.to_api_dict(hook)}


@router.delete("/webhooks/{hook_id}")
async def delete_webhook(
    hook_id: str,
    request: Request,
    session: SessionDep,
    tenant: str | None = Query(default=None),
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session, request, user_id=uid, email=email, name=x_bevel_user_name
    )
    row = await _authorized_tenant(session, user, tenant)
    hook = await _hook_for_tenant(session, hook_id, row.id)
    await hooks_repo.delete(session, hook)
    return {"ok": True}


@router.get("/webhooks/{hook_id}/deliveries")
async def list_webhook_deliveries(
    hook_id: str,
    request: Request,
    session: SessionDep,
    tenant: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session, request, user_id=uid, email=email, name=x_bevel_user_name
    )
    row = await _authorized_tenant(session, user, tenant)
    hook = await _hook_for_tenant(session, hook_id, row.id)
    rows = await hooks_repo.list_deliveries(session, hook_id, limit=limit)
    return {
        "ok": True,
        "webhookId": hook.id,
        "deliveries": [hooks_repo.delivery_to_api(r) for r in rows],
    }


@router.post("/webhooks/inbound/{hook_id}")
async def inbound(
    hook_id: str,
    request: Request,
    session: SessionDep,
) -> dict[str, Any]:
    """Public ingest — HMAC or Bearer secret. Lands in a track or conversation."""
    raw = (await request.body()).decode("utf-8", errors="replace")
    hook = await hooks_repo.get_by_id(session, hook_id)
    if hook is None or not hook.enabled or hook.direction != "inbound":
        raise HTTPException(404, "webhook not found")
    auth = request.headers.get("authorization") or ""
    bearer = auth[7:].strip() if auth.lower().startswith("bearer ") else None
    signature = request.headers.get("x-bevel-signature")
    if not hooks_repo.verify_request(
        hook.secret, raw, signature=signature, bearer=bearer
    ):
        raise HTTPException(401, "invalid webhook signature")
    try:
        import json

        parsed = json.loads(raw) if raw.strip() else {}
    except Exception as exc:
        raise HTTPException(400, "JSON object required") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(400, "JSON object required")
    body = parsed

    event = str(body.get("event") or body.get("type") or "message").strip()
    status = str(body.get("status") or "").strip().lower()
    if event in {"ftue.started", "user.created"}:
        event = "ftue.started"
        phase = "ftue"
    elif event == "ftue.completed":
        phase = "ftue"
    elif event in {"workflow.started"} or status == "started":
        event = "workflow.started"
        phase = "started"
    elif event in {"workflow.failed"} or status in {"failed", "error"}:
        event = "workflow.failed"
        phase = "failed"
    elif event in {"workflow.completed"} or status in {"completed", "done", "success"}:
        event = "workflow.completed"
        phase = "completed"
    else:
        event = event if event else "message.created"
        if event == "message":
            event = "message.created"
        phase = "message"

    name = str(body.get("name") or hook.name or "workflow").strip()
    text = str(body.get("body") or body.get("text") or "").strip()
    agent_id = str(body.get("agentId") or body.get("agent") or "").strip().lower()
    speaker_name = str(body.get("speakerName") or name or "Workflow")
    actor = None

    if phase == "ftue":
        email = str(body.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(400, "ftue events require email")
        user, _created = await users_repo.upsert_identity(
            session,
            email=email,
            name=str(body.get("userName") or body.get("displayName") or name or ""),
            tenant_id=hook.tenant_id,
        )
        actor = {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "handle": user.handle,
        }
        agent_id = agent_id or (user.personal_agent_id or "hermes")
        if not hooks_repo.resolve_inbound_slug(hook, body):
            safe = str(user.id).replace("/", "_")
            body = {**body, "conversation": f"dm-{safe}-{agent_id}"}
        if not text:
            text = (
                f"Welcome to Bevel, {user.name or 'friend'}. Hermes is your personal agent."
                if event == "ftue.started"
                else f"{user.name or user.email} finished first-time setup."
            )
        speaker_name = speaker_name or "Bevel"

    slug = hooks_repo.resolve_inbound_slug(hook, body)
    if not slug:
        raise HTTPException(400, "track or conversation required")

    if not text:
        text = f"Workflow {phase}: {name}"
    elif phase not in {"message", "ftue"}:
        text = f"**{name}** {phase}\n\n{text}"
    ch = await channels_repo.ensure_channel(
        session,
        hook.tenant_id,
        slug,
        name=slug,
        tags=["webhook", "workflow"],
    )
    record = await messages_repo.append(
        session,
        tenant_id=hook.tenant_id,
        channel_id=ch.id,
        channel_slug=ch.slug,
        msg={
            "speakerId": f"webhook:{hook.id}",
            "speakerName": speaker_name[:80],
            "speakerType": "agent" if agent_id else "system",
            "agentId": agent_id or None,
            "body": text[:8000],
            "status": "final",
            "tags": ["webhook", "workflow", phase],
        },
    )
    await hooks_repo.mark_delivery(session, hook, status="received")
    is_dm = ch.slug.startswith("dm-")
    try:
        tenant = await tenants_repo.get_by_id(session, hook.tenant_id)
        if tenant:
            await hooks_repo.emit(
                session,
                tenant_id=hook.tenant_id,
                tenant_slug=tenant.slug,
                event=event if event != "message" else "message.created",
                data={
                    "message": messages_repo.to_api_dict(record),
                    "phase": phase,
                    "name": name,
                },
                track=None if is_dm else ch.slug,
                conversation=ch.slug if is_dm else None,
                actor=actor,
            )
    except Exception:
        pass
    return {
        "ok": True,
        "event": event,
        "phase": phase,
        "track": None if is_dm else ch.slug,
        "conversation": ch.slug if is_dm else None,
        "message": messages_repo.to_api_dict(record),
        "href": f"/talk/{agent_id}" if is_dm and agent_id else f"/~{ch.slug}",
    }


async def dispatch_message_created(
    session: AsyncSession,
    *,
    tenant_id: str,
    tenant_slug: str,
    channel_slug: str,
    message: dict[str, Any],
    first_in_room: bool = False,
) -> int:
    """Best-effort outbound fan-out after a durable message write."""
    tags = message.get("tags") or []
    if isinstance(tags, list) and "webhook" in tags:
        return 0
    status = str(message.get("status") or "final")
    if status in {"pending", "streaming", "partial"}:
        return 0
    is_dm = channel_slug.startswith("dm-")
    track = None if is_dm else channel_slug
    conversation = channel_slug if is_dm else None
    speaker_type = str(message.get("speakerType") or "")
    sent = await hooks_repo.emit(
        session,
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
        event="message.created",
        data=message,
        track=track,
        conversation=conversation,
        actor={"id": message.get("speakerId"), "name": message.get("speakerName")},
        skip_if_webhook_tagged=True,
    )
    mentions = message.get("mentionedHandles") or message.get("mentionedAgentIds") or []
    escalations = message.get("escalatedHandles") or []
    if mentions or escalations:
        sent += await hooks_repo.emit(
            session,
            tenant_id=tenant_id,
            tenant_slug=tenant_slug,
            event="mention.created",
            data={
                "messageId": message.get("id"),
                "mentions": mentions,
                "escalations": escalations,
            },
            track=track,
            conversation=conversation,
        )
    if first_in_room and is_dm:
        sent += await hooks_repo.emit(
            session,
            tenant_id=tenant_id,
            tenant_slug=tenant_slug,
            event="conversation.started",
            data={"conversation": channel_slug, "message": message},
            conversation=channel_slug,
        )
        if speaker_type == "human":
            sent += await hooks_repo.emit(
                session,
                tenant_id=tenant_id,
                tenant_slug=tenant_slug,
                event="ftue.first_message",
                data={"conversation": channel_slug, "message": message},
                conversation=channel_slug,
            )
    return sent
