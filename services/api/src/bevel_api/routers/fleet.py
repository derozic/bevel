"""Fleet channel + message REST — Postgres-backed."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
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
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    msgs = await messages_repo.list_for_channel(
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


@router.post("/channels/{slug}/messages")
async def post_message(
    slug: str,
    request: Request,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    if not isinstance(body, dict):
        raise HTTPException(400, "JSON object required")
    if not (body.get("body") or "").strip() and not body.get("id"):
        raise HTTPException(400, "body required")

    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    record = await messages_repo.append(
        session,
        tenant_id=row.id,
        channel_id=ch.id,
        channel_slug=ch.slug,
        msg=body,
    )
    return {"ok": True, "message": messages_repo.to_api_dict(record)}
