"""Fleet channel + message REST used by realtime and agent program events."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from bevel_api.lib import fleet_messages
from bevel_api.lib.internal_auth import require_internal

router = APIRouter(prefix="/v1/fleet", tags=["Fleet"])

InternalAuth = Annotated[None, Depends(require_internal)]


@router.get("/channels")
def list_channels(_auth: InternalAuth) -> dict[str, Any]:
    return {"channels": fleet_messages.list_channels()}


@router.get("/channels/{slug}")
def get_channel(slug: str, _auth: InternalAuth) -> dict[str, Any]:
    ch = fleet_messages.get_channel(slug)
    if not ch:
        raise HTTPException(404, "Channel not found")
    return ch


@router.get("/channels/{slug}/messages")
def get_messages(
    slug: str,
    _auth: InternalAuth,
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    return {"messages": fleet_messages.read_messages(slug, limit=limit)}


@router.post("/channels/{slug}/messages")
async def post_message(
    slug: str,
    request: Request,
    _auth: InternalAuth,
) -> dict[str, Any]:
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
