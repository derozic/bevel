"""User preferences — full profile / appearance / settings stored in Postgres."""

from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.repositories import users as users_repo
from bevel_api.routers.timeline import _require_user, _user_id_from_headers

router = APIRouter(prefix="/v1", tags=["preferences"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class PreferencesPutBody(BaseModel):
    """Full or partial BevelUserPreferences document."""

    preferences: dict[str, Any] = Field(default_factory=dict)
    """When true (default), deep-merge into existing prefs. When false, replace."""
    merge: bool = True
    tenantId: Optional[str] = None


@router.get("/me/preferences")
async def get_me_preferences(
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session,
        request,
        user_id=uid,
        email=email,
        name=x_bevel_user_name,
    )
    prefs = dict(user.preferences or {})
    # Ensure profile mirrors denorm columns so clients always see identity
    profile = dict(prefs.get("profile") or {})
    if user.name and not profile.get("displayName"):
        profile["displayName"] = user.name
    if user.handle and not profile.get("handle"):
        profile["handle"] = user.handle
    if user.image_url and not profile.get("photoUrl"):
        profile["photoUrl"] = user.image_url
    if user.personal_agent_id and not profile.get("personalAgentId"):
        profile["personalAgentId"] = user.personal_agent_id
    if profile:
        prefs["profile"] = profile

    return {
        "ok": True,
        "userId": user.id,
        "email": user.email,
        "tenantId": user.tenant_id,
        "preferences": prefs,
        "user": users_repo.to_public_dict(
            user, include_email=True, include_agent_config=True, include_preferences=True
        ),
        "updatedAt": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.put("/me/preferences")
async def put_me_preferences(
    body: PreferencesPutBody,
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session,
        request,
        user_id=uid,
        email=email,
        name=x_bevel_user_name,
        tenant_id=body.tenantId,
    )
    try:
        updated = await users_repo.save_preferences(
            session,
            user_id=user.id,
            preferences=body.preferences,
            merge=body.merge,
            tenant_id=body.tenantId,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not updated:
        raise HTTPException(404, "User not found")
    return {
        "ok": True,
        "preferences": dict(updated.preferences or {}),
        "user": users_repo.to_public_dict(
            updated,
            include_email=True,
            include_agent_config=True,
            include_preferences=True,
        ),
        "updatedAt": updated.updated_at.isoformat() if updated.updated_at else None,
    }
