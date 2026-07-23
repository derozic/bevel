"""Public workspace channel/message routes (product clients)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import internal_ok
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import messages as messages_repo
from bevel_api.repositories import tenants as tenants_repo

router = APIRouter(prefix="/v1/workspaces", tags=["Workspaces"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def _tenant_or_404(session: AsyncSession, slug: str) -> Any:
    tenant = await tenants_repo.get_by_slug(session, slug.lower().strip())
    if tenant is None:
        raise HTTPException(404, f"workspace not found: {slug}")
    return tenant


@router.get("/{slug}/channels")
async def list_workspace_channels(
    slug: str,
    session: SessionDep,
) -> dict[str, Any]:
    tenant = await _tenant_or_404(session, slug)
    channels = await channels_repo.list_for_tenant(session, tenant.id)
    if not channels:
        channels = await channels_repo.ensure_defaults(session, tenant.id)
    return {
        "workspace": tenant.slug,
        "channels": [channels_repo.to_api_dict(c) for c in channels],
    }


@router.get("/{slug}/channels/{channel}/messages")
async def list_workspace_messages(
    slug: str,
    channel: str,
    session: SessionDep,
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    tenant = await _tenant_or_404(session, slug)
    ch = await channels_repo.get_by_slug(session, tenant.id, channel)
    if ch is None:
        ch = await channels_repo.ensure_channel(session, tenant.id, channel)
    msgs = await messages_repo.list_for_channel(
        session,
        tenant_id=tenant.id,
        channel_id=ch.id,
        limit=limit,
    )
    return {
        "workspace": tenant.slug,
        "channel": ch.slug,
        "messages": [messages_repo.to_api_dict(m) for m in msgs],
    }


@router.post("/{slug}/channels/{channel}/messages")
async def post_workspace_message(
    slug: str,
    channel: str,
    request: Request,
    session: SessionDep,
) -> dict[str, Any]:
    if not internal_ok(request):
        raise HTTPException(401, "Unauthorized — provide X-Fleet-Internal-Key")
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    if not isinstance(body, dict):
        raise HTTPException(400, "JSON object required")
    if not (body.get("body") or "").strip():
        raise HTTPException(400, "body required")

    tenant = await _tenant_or_404(session, slug)
    ch = await channels_repo.ensure_channel(session, tenant.id, channel)
    record = await messages_repo.append(
        session,
        tenant_id=tenant.id,
        channel_id=ch.id,
        channel_slug=ch.slug,
        msg=body,
    )
    return {"ok": True, "message": messages_repo.to_api_dict(record)}
