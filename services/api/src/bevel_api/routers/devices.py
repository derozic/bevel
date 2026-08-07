"""Device push token registration (APNs / FCM) — Postgres SoT."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import require_internal
from bevel_api.repositories import push_tokens as push_tokens_repo

router = APIRouter(prefix="/v1/devices", tags=["Devices"])

InternalAuth = Annotated[None, Depends(require_internal)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class PushTokenIn(BaseModel):
    token: str = Field(min_length=8, max_length=4096)
    platform: str
    userId: str = ""
    tenantSlug: str = ""
    deviceModel: str = ""
    appVersion: str = ""


@router.post("/push-tokens", status_code=201)
async def register_push_token(
    body: PushTokenIn,
    session: SessionDep,
) -> dict[str, Any]:
    """Register or refresh a device push token.

    Public for the native client after OS permission grant.
    Tokens live in Postgres for the control plane to target APNs/FCM later.
    """
    try:
        record = await push_tokens_repo.register(session, body.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "device": push_tokens_repo.to_api_dict(record), "source": "postgres"}


@router.get("/push-tokens")
async def list_push_tokens(
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    rows = await push_tokens_repo.list_tokens(
        session,
        tenant_slug=tenant,
        platform=platform,
        limit=limit,
    )
    return {
        "tokens": [push_tokens_repo.to_api_dict(r) for r in rows],
        "source": "postgres",
    }


@router.delete("/push-tokens/{token}")
async def delete_push_token(
    token: str,
    _auth: InternalAuth,
    session: SessionDep,
) -> dict[str, str]:
    ok = await push_tokens_repo.unregister(session, token)
    if not ok:
        raise HTTPException(404, "Token not found")
    return {"status": "deleted"}


class PushSendIn(BaseModel):
    """Internal test / operator push to a user or raw FCM token."""

    userId: str = ""
    token: str = ""
    title: str = "BEVEL"
    body: str = "Test notification"
    deepLink: str = "bevel://timeline"
    highPriority: bool = False
    kind: str = "test"


@router.post("/push-send")
async def send_push(
    body: PushSendIn,
    _auth: InternalAuth,
    session: SessionDep,
) -> dict[str, Any]:
    """Fan-out a test push via FCM HTTP v1 (requires Firebase service account)."""
    from bevel_api.lib import fcm as fcm_lib

    if not fcm_lib.fcm_configured():
        raise HTTPException(
            503,
            "FCM not configured — set FIREBASE_SERVICE_ACCOUNT_JSON or PATH",
        )
    data = {
        "kind": body.kind or "test",
        "deepLink": body.deepLink or "bevel://timeline",
        "payload": body.deepLink or "bevel://timeline",
    }
    channel = (
        "bevel_escalation" if body.highPriority else "bevel_workspace"
    )
    if body.token.strip():
        result = await fcm_lib.send_to_token(
            token=body.token.strip(),
            title=body.title,
            body=body.body,
            data=data,
            high_priority=body.highPriority,
            android_channel=channel,
        )
        return {"ok": bool(result.get("ok")), "mode": "token", "result": result}
    if not body.userId.strip():
        raise HTTPException(400, "userId or token required")
    result = await fcm_lib.send_to_user_tokens(
        session,
        user_id=body.userId.strip(),
        title=body.title,
        body=body.body,
        data=data,
        high_priority=body.highPriority,
        android_channel=channel,
    )
    return {"ok": True, "mode": "user", "result": result}


@router.get("/push-status")
async def push_status(_auth: InternalAuth) -> dict[str, Any]:
    """Whether the API can mint FCM credentials (no secrets returned)."""
    from bevel_api.lib import fcm as fcm_lib

    return {
        "fcmConfigured": fcm_lib.fcm_configured(),
        "hint": "FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH",
    }
