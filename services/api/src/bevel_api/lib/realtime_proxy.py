"""Proxy to BEVEL realtime HTTP APIs (sessions, search, health)."""

from __future__ import annotations

from typing import Any

import httpx

from bevel_api.config import settings


async def realtime_health() -> dict[str, Any]:
    url = f"{settings.realtime_server_url.rstrip('/')}/health"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(url)
            if res.status_code >= 400:
                return {"status": "down", "code": res.status_code}
            return res.json()
    except httpx.HTTPError as exc:
        return {"status": "down", "error": str(exc)}


async def list_sessions(*, token: str | None = None) -> dict[str, Any]:
    url = f"{settings.realtime_server_url.rstrip('/')}/api/sessions"
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        res = await client.get(url, headers=headers)
        if res.status_code == 401:
            return {"error": "Sign in required", "sessions": []}
        res.raise_for_status()
        return res.json()


async def search_conversations(
    q: str,
    *,
    limit: int = 25,
    token: str | None = None,
) -> dict[str, Any]:
    url = f"{settings.realtime_server_url.rstrip('/')}/api/search"
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        res = await client.get(
            url,
            params={"q": q, "limit": str(limit)},
            headers=headers,
        )
        if res.status_code == 401:
            return {"error": "Sign in required", "hits": [], "count": 0}
        res.raise_for_status()
        return res.json()
