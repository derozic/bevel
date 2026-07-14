"""Fleet channel + message REST used by realtime and agent program events."""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, Request

from bevel_api.lib import fleet_messages

router = APIRouter(prefix="/v1/fleet", tags=["Fleet"])


def _internal_ok(request: Request, x_fleet_internal_key: str | None) -> bool:
    key = os.getenv("FLEET_INTERNAL_API_KEY")
    if key and x_fleet_internal_key == key:
        return True
    # Local agent programs (JOHNNY) and realtime on loopback in development
    if os.getenv("NODE_ENV", "development") != "production":
        client = request.client.host if request.client else ""
        if client in {"127.0.0.1", "::1", "localhost"}:
            return True
    # If no key is configured, allow loopback only
    if not key:
        client = request.client.host if request.client else ""
        return client in {"127.0.0.1", "::1", "localhost"}
    return False


def _require_internal(
    request: Request,
    x_fleet_internal_key: str | None,
) -> None:
    if not _internal_ok(request, x_fleet_internal_key):
        raise HTTPException(401, "Unauthorized")


@router.get("/channels")
def list_channels(
    request: Request,
    x_fleet_internal_key: str | None = Header(default=None, alias="X-Fleet-Internal-Key"),
) -> dict[str, Any]:
    _require_internal(request, x_fleet_internal_key)
    return {"channels": fleet_messages.list_channels()}


@router.get("/channels/{slug}")
def get_channel(
    slug: str,
    request: Request,
    x_fleet_internal_key: str | None = Header(default=None, alias="X-Fleet-Internal-Key"),
) -> dict[str, Any]:
    _require_internal(request, x_fleet_internal_key)
    ch = fleet_messages.get_channel(slug)
    if not ch:
        raise HTTPException(404, "Channel not found")
    return ch


@router.get("/channels/{slug}/messages")
def get_messages(
    slug: str,
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    x_fleet_internal_key: str | None = Header(default=None, alias="X-Fleet-Internal-Key"),
) -> dict[str, Any]:
    _require_internal(request, x_fleet_internal_key)
    return {"messages": fleet_messages.read_messages(slug, limit=limit)}


@router.post("/channels/{slug}/messages")
async def post_message(
    slug: str,
    request: Request,
    x_fleet_internal_key: str | None = Header(default=None, alias="X-Fleet-Internal-Key"),
) -> dict[str, Any]:
    _require_internal(request, x_fleet_internal_key)
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    if not isinstance(body, dict):
        raise HTTPException(400, "JSON object required")
    if not (body.get("body") or "").strip() and not body.get("id"):
        raise HTTPException(400, "body required")
    record = fleet_messages.append_message(slug, body)
    return {"ok": True, "message": record}
