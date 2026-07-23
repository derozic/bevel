"""Boot seed: YAML tenants → Postgres + default channels; optional JSONL import."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.config import settings
from bevel_api.db.models.channel import Channel
from bevel_api.db.models.message import Message
from bevel_api.db.models.tenant import Tenant
from bevel_api.lib import tenants as yaml_tenants
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import messages as messages_repo
from bevel_api.repositories import tenants as tenants_repo

log = logging.getLogger("bevel_api.seed")


async def seed_if_empty(session: AsyncSession) -> dict[str, Any]:
    """Upsert all YAML tenants and ensure default channels. Import JSONL once."""
    stats: dict[str, Any] = {
        "tenants_upserted": 0,
        "channels_ensured": 0,
        "jsonl_imported": 0,
    }

    for slug in yaml_tenants.list_tenant_slugs():
        try:
            raw = yaml_tenants.load_tenant(slug)
        except (OSError, ValueError) as exc:
            log.warning("skip tenant %s: %s", slug, exc)
            continue
        row = await tenants_repo.upsert_from_yaml(session, slug, raw)
        stats["tenants_upserted"] += 1
        ensured = await channels_repo.ensure_defaults(session, row.id)
        stats["channels_ensured"] += len(ensured)

        # One-time JSONL import when tenant has no messages yet
        msg_count = await session.scalar(
            select(func.count()).select_from(Message).where(Message.tenant_id == row.id)
        )
        if not msg_count:
            imported = await _import_jsonl_for_tenant(session, row)
            stats["jsonl_imported"] += imported

    await session.flush()
    return stats


async def _import_jsonl_for_tenant(session: AsyncSession, tenant: Tenant) -> int:
    """Import fleet JSONL files into messages for a tenant (seed-only)."""
    data_dir = _fleet_data_dir()
    if not data_dir.is_dir():
        return 0

    count = 0
    for path in sorted(data_dir.glob("*.jsonl")):
        slug = path.stem.lower()
        channel = await channels_repo.ensure_channel(session, tenant.id, slug)
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(msg, dict):
                continue
            await messages_repo.append(
                session,
                tenant_id=tenant.id,
                channel_id=channel.id,
                channel_slug=channel.slug,
                msg=msg,
            )
            count += 1
    if count:
        log.info("imported %s JSONL messages for tenant %s", count, tenant.slug)
    return count


def _fleet_data_dir() -> Path:
    import os

    env = os.getenv("BEVEL_FLEET_DATA_DIR")
    if env:
        return Path(env)
    # services/api/data/fleet
    return Path(__file__).resolve().parents[2] / "data" / "fleet"


async def database_counts(session: AsyncSession) -> dict[str, int]:
    tenants = await session.scalar(select(func.count()).select_from(Tenant)) or 0
    channels = await session.scalar(select(func.count()).select_from(Channel)) or 0
    messages = await session.scalar(select(func.count()).select_from(Message)) or 0
    return {
        "tenants": int(tenants),
        "channels": int(channels),
        "messages": int(messages),
    }


async def run_seed() -> dict[str, Any]:
    """Standalone entry used from lifespan."""
    from bevel_api.database import get_session

    async with get_session() as session:
        stats = await seed_if_empty(session)
        counts = await database_counts(session)
        return {"seed": stats, "counts": counts, "tenants_root": str(settings.tenants_root())}
