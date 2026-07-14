"""Device push token registration (APNs / FCM hooks)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from bevel_api.lib import push_tokens as store
from bevel_api.lib.internal_auth import require_internal

router = APIRouter(prefix="/v1/devices", tags=["Devices"])

InternalAuth = Annotated[None, Depends(require_internal)]


class PushTokenIn(BaseModel):
    token: str = Field(min_length=8, max_length=4096)
    platform: str
    userId: str = ""
    tenantSlug: str = ""
    deviceModel: str = ""
    appVersion: str = ""


@router.post("/push-tokens", status_code=201)
def register_push_token(body: PushTokenIn) -> dict[str, Any]:
    """Register or refresh a device push token.

    Public for the native client after OS permission grant.
    Tokens are stored for the control plane to target APNs/FCM later.
    """
    try:
        record = store.register_token(body.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "device": record}


@router.get("/push-tokens")
def list_push_tokens(
    _auth: InternalAuth,
    tenant: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    return {
        "tokens": store.list_tokens(
            tenant_slug=tenant,
            platform=platform,
            limit=limit,
        )
    }


@router.delete("/push-tokens/{token}")
def delete_push_token(token: str, _auth: InternalAuth) -> dict[str, str]:
    ok = store.unregister_token(token)
    if not ok:
        raise HTTPException(404, "Token not found")
    return {"status": "deleted"}
