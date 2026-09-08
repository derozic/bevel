"""Global agent settings API — fleet defaults + admin overrides."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from bevel_api.lib import agent_global_settings as gs
from bevel_api.lib.internal_auth import require_internal

router = APIRouter(prefix="/v1/agent-settings", tags=["Agent settings"])

InternalAuth = Annotated[None, Depends(require_internal)]


class PrinciplesIn(BaseModel):
    thinkBeforeActing: bool | None = None
    simplicityFirst: bool | None = None
    surgicalChanges: bool | None = None
    goalDrivenExecution: bool | None = None


class GlobalSettingsPatch(BaseModel):
    enabled: bool | None = None
    principles: PrinciplesIn | None = None
    customMarkdown: str | None = Field(
        default=None,
        description="Replace built-in GLOBAL_SETTINGS.md when non-empty; null clears override body",
    )
    notes: str | None = None
    updatedBy: str | None = None
    clearCustomMarkdown: bool = False


@router.get("/global")
async def get_global_settings(_auth: InternalAuth) -> dict[str, Any]:
    """Effective global agent guidelines + built-in markdown for admin UI."""
    return gs.public_payload()


@router.put("/global")
async def put_global_settings(
    body: GlobalSettingsPatch,
    request: Request,
    _auth: InternalAuth,
) -> dict[str, Any]:
    """Create/update deployment override (Bevel admin)."""
    payload = body.model_dump(exclude_unset=True)
    if body.clearCustomMarkdown:
        payload["customMarkdown"] = None
    payload.pop("clearCustomMarkdown", None)
    if body.principles is not None:
        payload["principles"] = {
            k: v
            for k, v in body.principles.model_dump(exclude_unset=True).items()
            if v is not None
        }
    updated_by = body.updatedBy or request.headers.get("x-operator-email") or "admin"
    effective = gs.save_override(payload, updated_by=updated_by)
    out = gs.public_payload()
    out["effective"] = effective
    out["saved"] = True
    return out


@router.delete("/global")
async def reset_global_settings(_auth: InternalAuth) -> dict[str, Any]:
    """Remove override file — fall back to agents-repo defaults."""
    path = gs.override_path()
    if path.is_file():
        path.unlink()
    return {**gs.public_payload(), "reset": True}
