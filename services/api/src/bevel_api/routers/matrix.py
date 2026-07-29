"""Matrix status, room ensure, and Application Service endpoints."""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.matrix_client import hs_token, matrix_enabled, server_name
from bevel_api.lib.matrix_agents import agent_identity_payload, ensure_agent_mxid
from bevel_api.lib.matrix_bridges import bridge_registry_status
from bevel_api.lib.matrix_dual_write import (
    ensure_channel_room,
    matrix_status_payload,
    publish_message_to_matrix,
)
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import matrix as matrix_repo
from bevel_api.repositories import messages as messages_repo
from bevel_api.repositories import tenants as tenants_repo

log = logging.getLogger("bevel_api.matrix.router")

router = APIRouter(prefix="/v1/matrix", tags=["matrix"])
as_router = APIRouter(tags=["matrix-appservice"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _check_hs_token(authorization: str | None = Header(default=None)) -> None:
    expected = hs_token()
    if not expected:
        if not matrix_enabled():
            return
        raise HTTPException(status_code=503, detail="MATRIX_HS_TOKEN not configured")
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if token != expected:
        raise HTTPException(status_code=401, detail="Invalid HS token")


class EnsureRoomBody(BaseModel):
    tenant_slug: str = Field(..., min_length=1)
    channel_slug: str = Field(..., min_length=1)
    channel_name: str | None = None


class PublishBody(BaseModel):
    tenant_slug: str
    channel_slug: str
    message: dict[str, Any]


@router.get("/status")
async def matrix_status() -> dict[str, Any]:
    return matrix_status_payload()


@router.post("/rooms/ensure")
async def ensure_room(
    body: EnsureRoomBody,
    session: SessionDep,
) -> dict[str, Any]:
    if not matrix_enabled():
        raise HTTPException(status_code=503, detail="Matrix disabled")
    tenant = await tenants_repo.get_by_slug(session, body.tenant_slug.lower().strip())
    if not tenant:
        raise HTTPException(status_code=404, detail="tenant not found")
    await channels_repo.ensure_channel(
        session, tenant.id, body.channel_slug.lower().strip()
    )
    row = await ensure_channel_room(
        session,
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        channel_slug=body.channel_slug,
        channel_name=body.channel_name,
    )
    if not row:
        return {"ok": False, "reason": "homeserver_unavailable_or_unconfigured"}
    return {"ok": True, "room": matrix_repo.room_to_dict(row)}


@router.post("/publish")
async def publish(
    body: PublishBody,
    session: SessionDep,
) -> dict[str, Any]:
    if not matrix_enabled():
        raise HTTPException(status_code=503, detail="Matrix disabled")
    tenant = await tenants_repo.get_by_slug(session, body.tenant_slug.lower().strip())
    if not tenant:
        raise HTTPException(status_code=404, detail="tenant not found")
    event_id = await publish_message_to_matrix(
        session,
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        channel_slug=body.channel_slug,
        message=body.message,
    )
    return {"ok": bool(event_id), "eventId": event_id}


@router.get("/rooms/{tenant_slug}/{channel_slug}")
async def get_room_map(
    tenant_slug: str,
    channel_slug: str,
    session: SessionDep,
) -> dict[str, Any]:
    tenant = await tenants_repo.get_by_slug(session, tenant_slug.lower().strip())
    if not tenant:
        raise HTTPException(status_code=404, detail="tenant not found")
    row = await matrix_repo.get_room_map(
        session, tenant_id=tenant.id, channel_slug=channel_slug
    )
    if not row:
        raise HTTPException(status_code=404, detail="room map not found")
    return matrix_repo.room_to_dict(row)


@router.get("/bridges")
async def list_bridges() -> dict[str, Any]:
    return {"bridges": bridge_registry_status()}


@router.get("/agents/{tenant_slug}")
async def list_agent_mxids(
    tenant_slug: str,
    agents: str = "",
) -> dict[str, Any]:
    """Return Matrix ids for comma-separated agent ids (Phase 4)."""
    ids = [a.strip() for a in agents.split(",") if a.strip()]
    return {
        "tenantSlug": tenant_slug,
        "agents": agent_identity_payload(tenant_slug, ids or ["brain"]),
    }


class EnsureAgentBody(BaseModel):
    tenant_slug: str
    agent_id: str
    display_name: str | None = None


@router.post("/agents/ensure")
async def ensure_agent(
    body: EnsureAgentBody,
    session: SessionDep,
) -> dict[str, Any]:
    tenant = await tenants_repo.get_by_slug(session, body.tenant_slug.lower().strip())
    if not tenant:
        raise HTTPException(status_code=404, detail="tenant not found")
    mxid = await ensure_agent_mxid(
        session,
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        agent_id=body.agent_id,
        display_name=body.display_name or "",
    )
    return {"ok": True, "mxid": mxid, "agentId": body.agent_id}


# ── Application Service API (Synapse → BEVEL) ───────────────────────────────


@as_router.put("/transactions/{txn_id}")
async def as_transaction(
    txn_id: str,
    request: Request,
    session: SessionDep,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Receive events from the homeserver (appservice push)."""
    _check_hs_token(authorization)
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid json") from exc

    events = payload.get("events") or []
    ingested = 0
    for ev in events:
        if not isinstance(ev, dict):
            continue
        if ev.get("type") != "m.room.message":
            continue
        event_id = str(ev.get("event_id") or "")
        room_id = str(ev.get("room_id") or "")
        if not event_id or not room_id:
            continue
        if await matrix_repo.get_event_by_matrix_id(session, event_id):
            continue
        room = await matrix_repo.get_room_by_matrix_id(session, room_id)
        if not room:
            log.debug("matrix event for unmapped room %s", room_id)
            continue
        content = ev.get("content") or {}
        body = str(content.get("body") or "")
        sender = str(ev.get("sender") or "matrix")
        ch = await channels_repo.ensure_channel(
            session, room.tenant_id, room.channel_slug
        )
        msg = {
            "id": f"msg_mx_{event_id[-16:].replace('$', '')}",
            "body": body,
            "speakerId": sender,
            "speakerName": sender.split(":")[0].lstrip("@"),
            "speakerType": "human",
            "status": "final",
            "kind": "message",
            "source": "matrix",
            "matrixEventId": event_id,
        }
        try:
            record = await messages_repo.append(
                session,
                tenant_id=room.tenant_id,
                channel_id=ch.id,
                channel_slug=ch.slug,
                msg=msg,
            )
            await matrix_repo.record_event(
                session,
                tenant_id=room.tenant_id,
                message_id=record.id,
                event_id=event_id,
                room_id=room_id,
                direction="in",
            )
            ingested += 1
        except Exception:
            log.exception("failed to ingest matrix event %s", event_id)

    return {"ok": True, "txnId": txn_id, "ingested": ingested}


@as_router.get("/users/{user_id}")
async def as_query_user(
    user_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_hs_token(authorization)
    return {}


@as_router.get("/rooms/{room_alias}")
async def as_query_room(
    room_alias: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_hs_token(authorization)
    return {}


@as_router.get("/thirdparty/protocol/bevel")
async def as_protocol(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_hs_token(authorization)
    return {
        "user_fields": ["bevel_id"],
        "location_fields": ["channel"],
        "icon": "",
        "field_types": {
            "bevel_id": {"regexp": r".+", "placeholder": "user@example.com"},
            "channel": {"regexp": r"[a-z0-9-]+", "placeholder": "general"},
        },
        "instances": [
            {
                "desc": "BEVEL",
                "icon": "",
                "fields": {"server": server_name()},
                "network_id": "bevel",
            }
        ],
    }
