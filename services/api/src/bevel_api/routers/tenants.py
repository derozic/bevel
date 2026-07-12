"""Tenant + product surface REST routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from bevel_api.lib import realtime_proxy, tenants

router = APIRouter(prefix="/v1", tags=["Product"])


@router.get("/tenants")
def list_tenants() -> dict[str, Any]:
    return {"tenants": tenants.list_tenants()}


@router.get("/tenants/{slug}")
def get_tenant(slug: str) -> dict[str, Any]:
    try:
        raw = tenants.load_tenant(slug)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    return tenants.summarize_tenant(raw)


@router.get("/tenants/{slug}/raw")
def get_tenant_raw(slug: str) -> dict[str, Any]:
    try:
        return tenants.load_tenant(slug)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/tenants/{slug}/channels")
def list_channels(slug: str) -> dict[str, Any]:
    try:
        channels = tenants.tenant_channels(slug)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {"channels": channels}


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
