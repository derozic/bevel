"""Tenant + product surface REST routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from bevel_api.database import database, get_session
from bevel_api.lib import realtime_proxy, tenants
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import tenants as tenants_repo

router = APIRouter(prefix="/v1", tags=["Product"])


@router.get("/tenants")
async def list_tenants() -> dict[str, Any]:
    if database.is_connected:
        try:
            async with get_session() as session:
                rows = await tenants_repo.list_tenants(session)
                if rows:
                    return {
                        "tenants": [tenants_repo.row_to_summary(r) for r in rows],
                        "source": "postgres",
                    }
        except Exception:
            pass
    return {"tenants": tenants.list_tenants(), "source": "yaml"}


@router.get("/tenants/{slug}")
async def get_tenant(slug: str) -> dict[str, Any]:
    if database.is_connected:
        try:
            async with get_session() as session:
                row = await tenants_repo.get_by_slug(session, slug)
                if row:
                    return {**tenants_repo.row_to_summary(row), "source": "postgres"}
        except Exception:
            pass
    try:
        raw = tenants.load_tenant(slug)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {**tenants.summarize_tenant(raw), "source": "yaml"}


@router.get("/tenants/{slug}/raw")
def get_tenant_raw(slug: str) -> dict[str, Any]:
    try:
        return tenants.load_tenant(slug)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/tenants/{slug}/channels")
async def list_channels(slug: str) -> dict[str, Any]:
    if database.is_connected:
        try:
            async with get_session() as session:
                row = await tenants_repo.get_by_slug(session, slug)
                if row:
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
        except Exception:
            pass
    try:
        channels = tenants.tenant_channels(slug)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {"channels": channels, "source": "yaml"}


@router.get("/agents")
def list_agents() -> dict[str, Any]:
    return {"agents": tenants.catalog_agents()}


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
