"""Personal timeline feed + user lookup for @ / ^ mentions."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.user import User
from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import internal_ok
from bevel_api.repositories import messages as messages_repo
from bevel_api.repositories import timeline as timeline_repo
from bevel_api.repositories import users as users_repo

router = APIRouter(prefix="/v1", tags=["Timeline"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _user_id_from_headers(
    x_bevel_user_id: str | None,
    x_bevel_user_email: str | None,
) -> tuple[str | None, str | None]:
    uid = (x_bevel_user_id or "").strip() or None
    email = (x_bevel_user_email or "").strip().lower() or None
    return uid, email


def _assert_trusted_identity(request: Request) -> None:
    """Identity headers may only be set by a trusted caller (BFF / internal).

    Without this check, anyone who can reach the API could spoof
    X-Bevel-User-Email and read or mutate another member's timeline/profile.
    The Next.js BFF always attaches FLEET_INTERNAL_API_KEY when proxying.
    """
    if not internal_ok(request):
        raise HTTPException(
            401,
            "Unauthorized — timeline/profile identity requires X-Fleet-Internal-Key "
            "(use the web BFF or internal services)",
        )


async def _require_user(
    session: AsyncSession,
    request: Request,
    *,
    user_id: str | None,
    email: str | None,
    name: str | None = None,
    image_url: str | None = None,
    tenant_id: str | None = None,
) -> User:
    _assert_trusted_identity(request)
    if user_id:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            return user
    if email:
        user = await users_repo.get_by_email(session, email)
        if user:
            return user
        # Bootstrap identity so first timeline/profile call creates a row
        user, _created = await users_repo.upsert_identity(
            session,
            email=email,
            name=name or "",
            image_url=image_url,
            tenant_id=tenant_id,
        )
        return user
    raise HTTPException(
        401, "Sign in required — pass X-Bevel-User-Id or X-Bevel-User-Email"
    )


class ProfileUpdateBody(BaseModel):
    handle: Optional[str] = None
    name: Optional[str] = None
    imageUrl: Optional[str] = None
    personalAgentId: Optional[str] = Field(default=None)
    clearPersonalAgent: bool = False
    tenantId: Optional[str] = None
    personalAgentConfig: Optional[dict[str, Any]] = None
    # Full h-card profile section (bio, socials, tags, …) → users.preferences.profile
    profile: Optional[dict[str, Any]] = None
    # Optional full preferences patch alongside profile
    preferences: Optional[dict[str, Any]] = None


class TimelineSourceBody(BaseModel):
    sourceKind: str  # git | workspace | channel | self
    tenantId: str
    channelSlug: Optional[str] = None
    githubConfig: Optional[dict[str, Any]] = None
    enabled: bool = True
    id: Optional[str] = None


class FanOutBody(BaseModel):
    """Internal: fan-out timeline from a message after write."""

    tenantId: str
    messageId: str
    actorUserId: Optional[str] = None


@router.get("/timeline")
async def get_timeline(
    request: Request,
    session: SessionDep,
    kind: str = Query(default="all"),
    limit: int = Query(default=50, ge=1, le=200),
    before: Optional[str] = Query(default=None),
    unacked: bool = Query(default=False, description="Only unacked escalations"),
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session,
        request,
        user_id=uid,
        email=email,
        name=x_bevel_user_name,
    )
    before_dt: datetime | None = None
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(400, "before must be ISO datetime") from exc
    rows = await timeline_repo.list_for_user(
        session,
        user_id=user.id,
        kind=None if kind == "all" else kind,
        limit=limit,
        before=before_dt,
    )
    if unacked:
        rows = [r for r in rows if r.acked_at is None]
    return {
        "ok": True,
        "items": [timeline_repo.to_api_dict(r) for r in rows],
        "userId": user.id,
        "handle": user.handle,
        "personalAgentId": user.personal_agent_id,
    }


@router.post("/timeline/{item_id}/read")
async def read_timeline_item(
    item_id: str,
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(session, request, user_id=uid, email=email)
    row = await timeline_repo.mark_read(session, item_id=item_id, user_id=user.id)
    if not row:
        raise HTTPException(404, "Timeline item not found")
    return {"ok": True, "item": timeline_repo.to_api_dict(row)}


@router.post("/timeline/{item_id}/ack")
async def ack_timeline_item(
    item_id: str,
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(session, request, user_id=uid, email=email)
    row = await timeline_repo.mark_acked(session, item_id=item_id, user_id=user.id)
    if not row:
        raise HTTPException(404, "Timeline item not found")
    return {"ok": True, "item": timeline_repo.to_api_dict(row)}


@router.get("/timeline/sources")
async def list_timeline_sources(
    request: Request,
    session: SessionDep,
    tenant: Optional[str] = Query(default=None),
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(session, request, user_id=uid, email=email)
    rows = await timeline_repo.list_sources(
        session, user_id=user.id, tenant_id=tenant or user.tenant_id
    )
    return {
        "ok": True,
        "sources": [timeline_repo.source_to_api_dict(r) for r in rows],
    }


@router.put("/timeline/sources")
async def put_timeline_source(
    body: TimelineSourceBody,
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Admin/user: include git activity, workspace members, or a ~channel in feed."""
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(session, request, user_id=uid, email=email)
    kind = body.sourceKind.strip().lower()
    if kind not in {"git", "workspace", "channel", "self"}:
        raise HTTPException(
            400, "sourceKind must be one of: git, workspace, channel, self"
        )
    if kind == "channel" and not (body.channelSlug or "").strip():
        raise HTTPException(400, "channelSlug required for channel sources")
    row = await timeline_repo.upsert_source(
        session,
        user_id=user.id,
        tenant_id=body.tenantId,
        source_kind=kind,
        channel_slug=body.channelSlug,
        github_config=body.githubConfig,
        enabled=body.enabled,
        source_id=body.id,
    )
    return {"ok": True, "source": timeline_repo.source_to_api_dict(row)}


@router.get("/users/lookup")
async def users_lookup(
    session: SessionDep,
    q: str = Query(default="", min_length=0),
    tenant: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict[str, Any]:
    rows = await users_repo.lookup_handles(
        session, q=q, tenant_id=tenant, limit=limit
    )
    return {
        "ok": True,
        "users": [users_repo.to_public_dict(u) for u in rows],
    }


@router.get("/users/by-handle/{handle}")
async def user_by_handle(
    handle: str,
    session: SessionDep,
    tenant: Optional[str] = Query(default=None),
) -> dict[str, Any]:
    # Prefer tenant-scoped lookup; only broaden when no tenant filter given
    user = await users_repo.get_by_handle(
        session, handle=handle, tenant_id=tenant
    )
    if not user and tenant is None:
        user = await users_repo.get_by_handle(
            session, handle=handle, tenant_id=None
        )
    if not user:
        raise HTTPException(404, "User not found")
    return {"ok": True, "user": users_repo.to_public_dict(user)}


@router.put("/me/profile")
async def put_me_profile(
    body: ProfileUpdateBody,
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session,
        request,
        user_id=uid,
        email=email,
        name=body.name or x_bevel_user_name,
        image_url=body.imageUrl,
        tenant_id=body.tenantId,
    )
    if body.tenantId and not user.tenant_id:
        user.tenant_id = body.tenantId

    personal_agent: str | None | object = ...
    if body.clearPersonalAgent:
        personal_agent = None
    elif "personalAgentId" in body.model_fields_set:
        personal_agent = body.personalAgentId

    try:
        updated = await users_repo.update_profile(
            session,
            user_id=user.id,
            handle=body.handle,
            name=body.name,
            image_url=body.imageUrl,
            personal_agent_id=personal_agent,
            personal_agent_config=body.personalAgentConfig,
            tenant_id=body.tenantId,
            profile=body.profile,
            preferences=body.preferences,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not updated:
        raise HTTPException(404, "User not found")
    return {
        "ok": True,
        "user": users_repo.to_public_dict(
            updated,
            include_email=True,
            include_agent_config=True,
            include_preferences=True,
        ),
        "preferences": dict(updated.preferences or {}),
    }


@router.get("/extensions/sendgrid")
async def sendgrid_extension_status() -> dict[str, Any]:
    """Whether SendGrid is configured for escalation email (no secrets)."""
    from bevel_api.lib import sendgrid as sg

    return {
        "ok": True,
        "extension": "sendgrid",
        "configured": sg.sendgrid_configured(),
        "fromEmail": sg.from_address()[0] if sg.sendgrid_configured() else None,
        "uses": ["escalation_email"],
        "docs": "Set SENDGRID_API_KEY + SENDGRID_FROM_EMAIL on the API host.",
    }


@router.get("/me/personal-agent")
async def get_personal_agent(
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(session, request, user_id=uid, email=email)
    agent_id = user.personal_agent_id or None
    return {
        "ok": True,
        "personalAgentId": agent_id,
        "handle": user.handle,
        "desktopIntegration": agent_id == "hermes",
        "config": dict(user.personal_agent_config or {}),
    }


@router.post("/timeline/fan-out")
async def fan_out_message(
    body: FanOutBody,
    request: Request,
    session: SessionDep,
) -> dict[str, Any]:
    """Internal endpoint — fan-out @/^ people from a persisted message."""
    if not internal_ok(request):
        raise HTTPException(401, "Unauthorized")
    msg = await messages_repo.get_by_id(session, body.messageId)
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg.tenant_id != body.tenantId:
        raise HTTPException(400, "tenantId does not match message")
    # Only fan-out when status is final (or missing = final)
    meta = dict(msg.metadata_ or {})
    status = str(meta.get("status") or "final")
    if status in {"pending", "streaming", "partial"}:
        return {"ok": True, "skipped": True, "reason": "in_progress", "created": 0}
    result = await timeline_repo.fan_out_from_message(
        session,
        message=msg,
        actor_user_id=body.actorUserId,
    )
    return result
