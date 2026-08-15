"""Folksonomy REST — tags on agents, people, and tracks."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib import tenants as yaml_tenants
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import folksonomy as folk_repo
from bevel_api.repositories import tenants as tenants_repo
from bevel_api.repositories import users as users_repo
from bevel_api.routers.timeline import _require_user, _user_id_from_headers

router = APIRouter(prefix="/v1", tags=["Folksonomy"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

DEFAULT_TENANT = "2x4m"


async def _tenant(session: AsyncSession, slug: str | None) -> Any:
    key = (slug or DEFAULT_TENANT).strip().lower()
    row = await tenants_repo.get_by_slug(session, key)
    if row:
        return row
    try:
        raw = yaml_tenants.load_tenant(key)
        return await tenants_repo.upsert_from_yaml(session, key, raw)
    except FileNotFoundError as exc:
        raise HTTPException(404, f"tenant not found: {key}") from exc


def _hydrate_agents(ids: list[str]) -> list[dict[str, Any]]:
    catalog = {str(a.get("id") or "").lower(): a for a in yaml_tenants.catalog_agents()}
    out: list[dict[str, Any]] = []
    for raw_id in ids:
        meta = catalog.get(raw_id.lower()) or {}
        out.append(
            {
                "kind": "agent",
                "id": raw_id,
                "name": meta.get("name") or raw_id,
                "role": meta.get("role") or "",
                "href": f"/talk/{raw_id.lower()}",
            }
        )
    return out


async def _hydrate_tracks(
    session: AsyncSession, tenant_id: str, slugs: list[str]
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for slug in slugs:
        ch = await channels_repo.get_by_slug(session, tenant_id, slug)
        out.append(
            {
                "kind": "track",
                "id": slug,
                "name": ch.name if ch else slug,
                "href": f"/~{slug}",
            }
        )
    return out


async def _hydrate_people(
    session: AsyncSession, ids: list[str]
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for raw in ids:
        user = await users_repo.get_by_handle(session, handle=raw)
        if user is None:
            user = await users_repo.get_by_id(session, raw)
        handle = (user.handle if user else raw) or raw
        out.append(
            {
                "kind": "person",
                "id": user.id if user else raw,
                "name": (user.name if user else raw) or raw,
                "handle": handle,
                "href": f"/u/{handle}",
            }
        )
    return out


class TagBody(BaseModel):
    slug: str = Field(min_length=2, max_length=64)
    kind: str = Field(min_length=2, max_length=16)
    id: str = Field(min_length=1, max_length=128)
    tenant: str | None = None


@router.get("/tags")
async def list_tags(
    session: SessionDep,
    tenant: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    id: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _tenant(session, tenant)
    if kind and id:
        if kind not in folk_repo.KINDS:
            raise HTTPException(400, f"unknown kind: {kind}")
        tags = await folk_repo.list_for_entity(
            session, tenant_id=row.id, kind=kind, entity_id=id
        )
        return {"ok": True, "tenant": row.slug, "kind": kind, "id": id, "tags": tags}
    cloud = await folk_repo.list_cloud(session, tenant_id=row.id)
    return {"ok": True, "tenant": row.slug, "tags": cloud}


@router.get("/tags/{slug}")
async def get_tag(
    slug: str,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _tenant(session, tenant)
    page = await folk_repo.page_for_tag(session, tenant_id=row.id, slug=slug)
    return {
        "ok": True,
        "tenant": row.slug,
        "slug": page["slug"],
        "href": f"/tags/{page['slug']}",
        "agents": _hydrate_agents(list(page["agents"])),
        "people": await _hydrate_people(session, list(page["people"])),
        "tracks": await _hydrate_tracks(session, row.id, list(page["tracks"])),
    }


@router.post("/tags")
async def apply_tag(
    body: TagBody,
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    kind = body.kind.strip().lower()
    if kind not in folk_repo.KINDS:
        raise HTTPException(400, f"unknown kind: {body.kind}")
    uid, email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    user = await _require_user(
        session, request, user_id=uid, email=email, name=x_bevel_user_name
    )
    row = await _tenant(session, body.tenant)
    tagging = await folk_repo.apply(
        session,
        tenant_id=row.id,
        slug=body.slug,
        kind=kind,
        entity_id=body.id,
        tagged_by=user.id,
    )
    if tagging is None:
        raise HTTPException(400, "invalid tag")
    tags = await folk_repo.list_for_entity(
        session, tenant_id=row.id, kind=kind, entity_id=body.id
    )
    return {"ok": True, "tagging": folk_repo.to_api_dict(tagging), "tags": tags}


@router.delete("/tags")
async def remove_tag(
    body: TagBody,
    request: Request,
    session: SessionDep,
    x_bevel_user_id: Annotated[str | None, Header()] = None,
    x_bevel_user_email: Annotated[str | None, Header()] = None,
    x_bevel_user_name: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    kind = body.kind.strip().lower()
    if kind not in folk_repo.KINDS:
        raise HTTPException(400, f"unknown kind: {body.kind}")
    _uid, _email = _user_id_from_headers(x_bevel_user_id, x_bevel_user_email)
    await _require_user(session, request, user_id=_uid, email=_email)
    row = await _tenant(session, body.tenant)
    await folk_repo.remove(
        session,
        tenant_id=row.id,
        slug=body.slug,
        kind=kind,
        entity_id=body.id,
    )
    tags = await folk_repo.list_for_entity(
        session, tenant_id=row.id, kind=kind, entity_id=body.id
    )
    return {"ok": True, "tags": tags}
