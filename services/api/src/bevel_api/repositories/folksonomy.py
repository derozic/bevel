"""Folksonomy — shared tags on agents, people, and tracks."""

from __future__ import annotations

import re
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.channel import Channel
from bevel_api.db.models.tagging import Tagging
from bevel_api.db.models.user import User

KINDS = frozenset({"agent", "person", "track"})
_TAG_RE = re.compile(r"[^a-z0-9]+")


def normalize_tag(raw: str) -> str:
    slug = _TAG_RE.sub("-", (raw or "").strip().lower()).strip("-")
    return slug[:32]


def parse_tags(raw: Any) -> list[str]:
    if isinstance(raw, str):
        parts = re.split(r"[,;\s]+", raw)
    elif isinstance(raw, list):
        parts = raw
    else:
        parts = []
    seen: set[str] = set()
    out: list[str] = []
    for item in parts:
        slug = normalize_tag(str(item or ""))
        if len(slug) < 2 or slug in seen:
            continue
        seen.add(slug)
        out.append(slug)
    return out


def _id() -> str:
    return uuid.uuid4().hex


def to_api_dict(row: Tagging) -> dict[str, Any]:
    return {
        "id": row.id,
        "slug": row.slug,
        "kind": row.entity_kind,
        "entityId": row.entity_id,
        "taggedBy": row.tagged_by,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


async def list_for_entity(
    session: AsyncSession,
    *,
    tenant_id: str,
    kind: str,
    entity_id: str,
) -> list[str]:
    kind = kind.strip().lower()
    entity_id = entity_id.strip()
    result = await session.execute(
        select(Tagging.slug)
        .where(
            Tagging.tenant_id == tenant_id,
            Tagging.entity_kind == kind,
            Tagging.entity_id == entity_id,
        )
        .order_by(Tagging.slug)
    )
    slugs = [str(s) for s in result.scalars().all()]
    extra = await _legacy_tags(session, tenant_id=tenant_id, kind=kind, entity_id=entity_id)
    return parse_tags([*slugs, *extra])


async def list_cloud(
    session: AsyncSession,
    *,
    tenant_id: str,
) -> list[dict[str, Any]]:
    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    result = await session.execute(
        select(Tagging).where(Tagging.tenant_id == tenant_id)
    )
    for row in result.scalars().all():
        counts[row.slug][row.entity_kind] += 1
        counts[row.slug]["_all"] += 1

    for slug, kind in await _legacy_pairs(session, tenant_id):
        counts[slug][kind] += 1
        counts[slug]["_all"] += 1

    out: list[dict[str, Any]] = []
    for slug, kinds in sorted(counts.items()):
        out.append(
            {
                "slug": slug,
                "count": kinds.get("_all", 0),
                "agents": kinds.get("agent", 0),
                "people": kinds.get("person", 0),
                "tracks": kinds.get("track", 0),
            }
        )
    out.sort(key=lambda r: (-int(r["count"]), str(r["slug"])))
    return out


async def page_for_tag(
    session: AsyncSession,
    *,
    tenant_id: str,
    slug: str,
) -> dict[str, Any]:
    key = normalize_tag(slug)
    result = await session.execute(
        select(Tagging).where(Tagging.tenant_id == tenant_id, Tagging.slug == key)
    )
    rows = list(result.scalars().all())
    by_kind: dict[str, list[str]] = {"agent": [], "person": [], "track": []}
    for row in rows:
        if row.entity_kind in by_kind:
            by_kind[row.entity_kind].append(row.entity_id)
    for extra_slug, kind, entity_id in await _legacy_triples(session, tenant_id):
        if extra_slug == key and kind in by_kind and entity_id not in by_kind[kind]:
            by_kind[kind].append(entity_id)
    return {
        "slug": key,
        "agents": by_kind["agent"],
        "people": by_kind["person"],
        "tracks": by_kind["track"],
    }


async def apply(
    session: AsyncSession,
    *,
    tenant_id: str,
    slug: str,
    kind: str,
    entity_id: str,
    tagged_by: str | None = None,
) -> Tagging | None:
    key = normalize_tag(slug)
    kind = kind.strip().lower()
    entity_id = entity_id.strip()
    if len(key) < 2 or kind not in KINDS or not entity_id:
        return None
    existing = await session.execute(
        select(Tagging).where(
            Tagging.tenant_id == tenant_id,
            Tagging.slug == key,
            Tagging.entity_kind == kind,
            Tagging.entity_id == entity_id,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        return row
    row = Tagging(
        id=_id(),
        tenant_id=tenant_id,
        slug=key,
        entity_kind=kind,
        entity_id=entity_id,
        tagged_by=tagged_by,
    )
    session.add(row)
    await session.flush()
    return row


async def remove(
    session: AsyncSession,
    *,
    tenant_id: str,
    slug: str,
    kind: str,
    entity_id: str,
) -> bool:
    key = normalize_tag(slug)
    result = await session.execute(
        select(Tagging).where(
            Tagging.tenant_id == tenant_id,
            Tagging.slug == key,
            Tagging.entity_kind == kind.strip().lower(),
            Tagging.entity_id == entity_id.strip(),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    await session.delete(row)
    await session.flush()
    return True


async def _legacy_tags(
    session: AsyncSession,
    *,
    tenant_id: str,
    kind: str,
    entity_id: str,
) -> list[str]:
    if kind == "track":
        result = await session.execute(
            select(Channel).where(
                Channel.tenant_id == tenant_id,
                Channel.slug == entity_id.lower(),
            )
        )
        ch = result.scalar_one_or_none()
        return parse_tags(ch.tags if ch else [])
    if kind == "person":
        user = await _find_person(session, tenant_id, entity_id)
        if not user:
            return []
        profile = dict((user.preferences or {}).get("profile") or {})
        return parse_tags(profile.get("tags") or [])
    return []


async def _legacy_pairs(
    session: AsyncSession, tenant_id: str
) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for slug, kind, _eid in await _legacy_triples(session, tenant_id):
        out.append((slug, kind))
    return out


async def _legacy_triples(
    session: AsyncSession, tenant_id: str
) -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    chs = await session.execute(select(Channel).where(Channel.tenant_id == tenant_id))
    for ch in chs.scalars().all():
        for slug in parse_tags(ch.tags):
            out.append((slug, "track", ch.slug))
    users = await session.execute(
        select(User).where((User.tenant_id == tenant_id) | (User.tenant_id.is_(None)))
    )
    for user in users.scalars().all():
        profile = dict((user.preferences or {}).get("profile") or {})
        hid = (user.handle or user.id or "").strip()
        if not hid:
            continue
        for slug in parse_tags(profile.get("tags") or []):
            out.append((slug, "person", hid))
    return out


async def _find_person(
    session: AsyncSession, tenant_id: str, entity_id: str
) -> User | None:
    key = entity_id.strip().lstrip("@")
    result = await session.execute(select(User).where(User.id == key))
    user = result.scalar_one_or_none()
    if user:
        return user
    result = await session.execute(
        select(User).where(User.handle == key.lower())
    )
    return result.scalar_one_or_none()
