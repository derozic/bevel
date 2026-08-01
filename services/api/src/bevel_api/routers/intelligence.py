"""Onboard default intelligence (Google Antigravity SDK)."""

from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib import antigravity_intel
from bevel_api.lib.antigravity_intel import IntelligenceMode, IntelligenceRequest
from bevel_api.lib.internal_auth import internal_ok

router = APIRouter(prefix="/v1", tags=["Intelligence"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class IntelligenceBody(BaseModel):
    mode: IntelligenceMode = "chat"
    prompt: str = Field(min_length=1, max_length=32_000)
    context: Optional[str] = Field(default=None, max_length=64_000)
    tenantId: Optional[str] = None
    roomKind: Optional[str] = None
    roomId: Optional[str] = None
    agentId: str = "bevel-intel"
    conversationId: Optional[str] = None
    recordTrace: bool = True


@router.get("/intelligence/status")
async def intelligence_status() -> dict[str, Any]:
    """Public-ish status for admin/prefs (no secrets)."""
    return {"ok": True, **antigravity_intel.status()}


@router.post("/intelligence")
async def run_intelligence(
    body: IntelligenceBody,
    request: Request,
    session: SessionDep,
) -> dict[str, Any]:
    """Run onboard intelligence. Prefer BFF with internal key in production."""
    # Allow loopback without key for local dev; prod BFF always sends key
    if not internal_ok(request):
        # Soft allow only when SDK unavailable would 503 anyway — still require trust
        from fastapi import HTTPException

        raise HTTPException(
            401,
            "Unauthorized — intelligence requires X-Fleet-Internal-Key (web BFF)",
        )

    req = IntelligenceRequest(
        mode=body.mode,
        prompt=body.prompt,
        context=body.context,
        tenantId=body.tenantId,
        roomKind=body.roomKind,
        roomId=body.roomId,
        agentId=body.agentId,
        conversationId=body.conversationId,
    )
    result = await antigravity_intel.run_intelligence(req)
    if body.recordTrace and body.tenantId and body.roomKind and body.roomId:
        await antigravity_intel.maybe_record_trace(session, result=result, req=req)

    return {
        "ok": result.ok,
        "text": result.text,
        "mode": result.mode,
        "provider": result.provider,
        "model": result.model,
        "thoughts": result.thoughts,
        "toolCalls": result.toolCalls,
        "runId": result.runId,
        "error": result.error,
    }
