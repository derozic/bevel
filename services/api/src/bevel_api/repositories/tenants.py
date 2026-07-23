"""Tenant repository — Postgres SoT; YAML is seed input."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.tenant import Tenant


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex


def row_to_summary(row: Tenant) -> dict[str, Any]:
    return {
        "id": row.id,
        "slug": row.slug,
        "name": row.name,
        "domain": row.domain,
        "hosts": list(row.hosts or []),
        "plan": row.plan,
        "feature_access": row.feature_access,
        "auth_mode": row.auth_mode,
        "auth_policy": dict(row.auth_policy or {}),
        "features": dict(row.features or {}),
        "theme": dict(row.theme or {}),
        "realtime_namespace": row.realtime_namespace,
        "realtime_url": row.realtime_url,
        "status": row.status,
        "is_active": row.is_active,
        "has_theme": bool(row.theme),
    }


async def list_tenants(session: AsyncSession) -> list[Tenant]:
    result = await session.execute(
        select(Tenant).where(Tenant.is_active.is_(True)).order_by(Tenant.slug)
    )
    return list(result.scalars().all())


async def get_by_slug(session: AsyncSession, slug: str) -> Tenant | None:
    result = await session.execute(select(Tenant).where(Tenant.slug == slug))
    return result.scalar_one_or_none()


async def get_by_id(session: AsyncSession, tenant_id: str) -> Tenant | None:
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    return result.scalar_one_or_none()


async def upsert_from_yaml(
    session: AsyncSession,
    slug: str,
    raw: dict[str, Any],
) -> Tenant:
    """Upsert tenant row from a parsed bevel.yaml payload."""
    brand = raw.get("brand") if isinstance(raw.get("brand"), dict) else {}
    auth = raw.get("auth") if isinstance(raw.get("auth"), dict) else {}
    realtime = raw.get("realtime") if isinstance(raw.get("realtime"), dict) else {}
    features = raw.get("features") if isinstance(raw.get("features"), dict) else {}
    hosts = raw.get("hosts") if isinstance(raw.get("hosts"), list) else []
    name = str(raw.get("name") or brand.get("product_name") or slug)

    auth_policy = {
        "allowed_domains": auth.get("allowed_domains") or [],
        "allowed_emails": auth.get("allowed_emails") or [],
        "default_for_domains": auth.get("default_for_domains") or [],
        "require_github_for_work": bool(auth.get("require_github_for_work")),
        "mode": auth.get("mode") or "google",
    }

    existing = await get_by_slug(session, slug)
    if existing:
        existing.name = name
        existing.domain = raw.get("domain")
        existing.hosts = list(hosts)
        existing.plan = str(raw.get("plan") or existing.plan or "free")
        existing.feature_access = str(
            raw.get("feature_access") or existing.feature_access or "stable"
        )
        existing.auth_mode = str(auth.get("mode") or existing.auth_mode or "google")
        existing.auth_policy = auth_policy
        existing.features = dict(features)
        existing.realtime_namespace = str(
            realtime.get("namespace") or existing.realtime_namespace or slug
        )
        existing.realtime_url = realtime.get("url") or existing.realtime_url
        existing.status = str(raw.get("status") or existing.status or "active")
        existing.is_active = True
        existing.updated_at = _utcnow()
        await session.flush()
        return existing

    row = Tenant(
        id=_id(),
        slug=slug,
        name=name,
        domain=raw.get("domain"),
        hosts=list(hosts),
        plan=str(raw.get("plan") or "free"),
        feature_access=str(raw.get("feature_access") or "stable"),
        auth_mode=str(auth.get("mode") or "google"),
        auth_policy=auth_policy,
        features=dict(features),
        theme={},
        realtime_namespace=str(realtime.get("namespace") or slug),
        realtime_url=realtime.get("url"),
        status=str(raw.get("status") or "active"),
        is_active=True,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(row)
    await session.flush()
    return row
