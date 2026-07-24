"""Announcement bar REST — public active list + operator CRUD (Postgres)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import enforce_internal, require_internal
from bevel_api.repositories import announcements as announcements_repo

router = APIRouter(prefix="/v1", tags=["Announcements"])

InternalAuth = Annotated[None, Depends(require_internal)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class GradientStopIn(BaseModel):
    color: str
    p3: str | None = None
    at: float | None = None


class GradientIn(BaseModel):
    angleDeg: float = 90
    stops: list[GradientStopIn] = Field(min_length=2, max_length=8)


class StyleIn(BaseModel):
    textColor: str = "#1a1200"
    linkColor: str | None = None
    ctaBg: str | None = None
    ctaText: str | None = None
    ctaBorder: str | None = None
    iconBg: str | None = None
    iconColor: str | None = None
    gradient: GradientIn


class AnnouncementCreateIn(BaseModel):
    title: str = ""
    body: str
    icon: str = ""
    linkLabel: str = "Learn more"
    linkHref: str
    linkKind: str = "app"
    ctaVariant: str = "link"
    placement: str = "top"
    kind: str = "static"
    dismissible: bool = True
    enabled: bool = True
    priority: int = 0
    audience: str = "all"
    tenantSlugs: list[str] = Field(default_factory=list)
    style: StyleIn | None = None
    startsAt: str = ""
    endsAt: str = ""


class AnnouncementUpdateIn(BaseModel):
    title: str | None = None
    body: str | None = None
    icon: str | None = None
    linkLabel: str | None = None
    linkHref: str | None = None
    linkKind: str | None = None
    ctaVariant: str | None = None
    placement: str | None = None
    kind: str | None = None
    dismissible: bool | None = None
    enabled: bool | None = None
    priority: int | None = None
    audience: str | None = None
    tenantSlugs: list[str] | None = None
    style: StyleIn | None = None
    startsAt: str | None = None
    endsAt: str | None = None


@router.get("/announcements")
async def list_announcements(
    request: Request,
    session: SessionDep,
    active: bool = Query(default=False),
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    """List announcements.

    - active=true → public member-facing bars (no auth)
    - active=false → full operator list (requires internal key / loopback)
    """
    if active:
        rows = await announcements_repo.list_active(session, tenant_slug=tenant)
        return {
            "announcements": [announcements_repo.to_api_dict(r) for r in rows],
            "source": "postgres",
        }
    enforce_internal(request)
    rows = await announcements_repo.list_all(session)
    return {
        "announcements": [announcements_repo.to_api_dict(r) for r in rows],
        "source": "postgres",
    }


@router.get("/announcements/{announcement_id}")
async def get_announcement(
    announcement_id: str,
    request: Request,
    session: SessionDep,
) -> dict[str, Any]:
    enforce_internal(request)
    item = await announcements_repo.get_one(session, announcement_id)
    if not item:
        raise HTTPException(404, "Announcement not found")
    return announcements_repo.to_api_dict(item)


@router.post("/announcements", status_code=201)
async def create_announcement(
    body: AnnouncementCreateIn,
    _auth: InternalAuth,
    session: SessionDep,
) -> dict[str, Any]:
    payload = body.model_dump(exclude_none=True)
    if payload.get("style"):
        payload["style"] = body.style.model_dump() if body.style else None
    try:
        row = await announcements_repo.create(session, payload)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return announcements_repo.to_api_dict(row)


@router.patch("/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: str,
    body: AnnouncementUpdateIn,
    _auth: InternalAuth,
    session: SessionDep,
) -> dict[str, Any]:
    payload = body.model_dump(exclude_unset=True)
    if "style" in payload and body.style is not None:
        payload["style"] = body.style.model_dump()
    item = await announcements_repo.update(session, announcement_id, payload)
    if not item:
        raise HTTPException(404, "Announcement not found")
    return announcements_repo.to_api_dict(item)


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    _auth: InternalAuth,
    session: SessionDep,
) -> dict[str, str]:
    ok = await announcements_repo.delete(session, announcement_id)
    if not ok:
        raise HTTPException(404, "Announcement not found")
    return {"status": "deleted", "id": announcement_id}
