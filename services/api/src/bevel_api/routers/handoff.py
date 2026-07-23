"""Auth handoff codes — cross-host session continuity (bevel.is → org host)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import internal_ok
from bevel_api.repositories import handoff as handoff_repo
from bevel_api.repositories import users as users_repo

router = APIRouter(prefix="/v1/auth", tags=["Auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class IssueHandoffBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    name: str = ""
    imageUrl: str | None = None
    tenantSlug: str = Field(..., min_length=1, max_length=64)
    callbackPath: str = "/^general"
    payloadJson: str | None = None
    ttlSeconds: int = Field(default=120, ge=30, le=600)


class RedeemHandoffBody(BaseModel):
    code: str = Field(..., min_length=8, max_length=256)


@router.post("/handoff")
async def issue_handoff(
    body: IssueHandoffBody,
    request: Request,
    session: SessionDep,
) -> dict[str, Any]:
    """Issue a one-time handoff code. Requires internal key or loopback in non-prod.

    Called by Next.js after platform login before redirecting to org host.
    """
    if not internal_ok(request):
        raise HTTPException(401, "Unauthorized — provide X-Fleet-Internal-Key")

    plain, row = await handoff_repo.issue(
        session,
        email=body.email,
        name=body.name,
        image_url=body.imageUrl,
        tenant_slug=body.tenantSlug,
        callback_path=body.callbackPath,
        payload_json=body.payloadJson,
        ttl_seconds=body.ttlSeconds,
    )
    await users_repo.upsert_identity(
        session,
        email=body.email,
        name=body.name,
        image_url=body.imageUrl,
    )
    return {
        "ok": True,
        "code": plain,
        "expiresAt": row.expires_at.isoformat(),
        "tenantSlug": row.tenant_slug,
        "callbackPath": row.callback_path,
    }


@router.post("/handoff/redeem")
async def redeem_handoff(
    body: RedeemHandoffBody,
    session: SessionDep,
) -> dict[str, Any]:
    """Redeem a handoff code. Public but one-time + short-lived."""
    payload = await handoff_repo.redeem(session, body.code)
    if payload is None:
        raise HTTPException(400, "Invalid or expired handoff code")
    await users_repo.upsert_identity(
        session,
        email=payload["email"],
        name=payload.get("name") or "",
        image_url=payload.get("imageUrl"),
    )
    return {"ok": True, **payload}
