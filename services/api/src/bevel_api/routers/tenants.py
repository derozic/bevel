"""Tenant + product surface REST routes — Postgres is SoT at runtime."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib import realtime_proxy, tenants
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import tenants as tenants_repo

router = APIRouter(prefix="/v1", tags=["Product"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/tenants")
async def list_tenants(session: SessionDep) -> dict[str, Any]:
    rows = await tenants_repo.list_tenants(session)
    return {
        "tenants": [tenants_repo.row_to_summary(r) for r in rows],
        "source": "postgres",
    }


@router.get("/tenants/{slug}")
async def get_tenant(slug: str, session: SessionDep) -> dict[str, Any]:
    row = await tenants_repo.get_by_slug(session, slug)
    if not row:
        raise HTTPException(404, f"tenant not found: {slug}")
    return {**tenants_repo.row_to_summary(row), "source": "postgres"}


@router.get("/tenants/{slug}/raw")
def get_tenant_raw(slug: str) -> dict[str, Any]:
    """GitOps YAML view for operators (declarative seed, not runtime SoT)."""
    try:
        return {**tenants.load_tenant(slug), "source": "yaml"}
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/tenants/{slug}/channels")
async def list_channels(slug: str, session: SessionDep) -> dict[str, Any]:
    row = await tenants_repo.get_by_slug(session, slug)
    if not row:
        raise HTTPException(404, f"tenant not found: {slug}")
    channels = await channels_repo.list_for_tenant(session, row.id)
    if not channels:
        channels = await channels_repo.ensure_defaults(session, row.id)
    return {
        "channels": [
            {
                "slug": c.slug,
                "name": c.name,
                "tags": list(c.tags or []),
                "href": f"/bevel/{c.slug}",
            }
            for c in channels
        ],
        "source": "postgres",
    }


@router.get("/agents")
def list_agents() -> dict[str, Any]:
    return {"agents": tenants.catalog_agents(), "source": "catalog"}


@router.get("/sessions")
async def list_sessions(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    return await realtime_proxy.list_sessions(token=token)


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(25, ge=1, le=50),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    return await realtime_proxy.search_conversations(q, limit=limit, token=token)


@router.get("/urls")
def public_urls() -> dict[str, str]:
    from bevel_api.config import settings

    return {
        "web": settings.public_web_url,
        "api": settings.public_api_url,
        "api_docs": f"{settings.public_api_url}/docs",
        "graphql": f"{settings.public_api_url}/graphql",
        "realtime_health": f"{settings.public_realtime_url}/health",
        "admin": "https://admin.bevel.lvh.me",
        "login": f"{settings.public_web_url}/login",
        "workspace": f"{settings.public_web_url}/bevel/general",
    }
