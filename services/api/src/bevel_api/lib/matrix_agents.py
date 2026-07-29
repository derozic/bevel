"""Phase 4 — agent Matrix identities + federation helpers."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.lib.matrix_client import agent_mxid, server_name
from bevel_api.repositories import matrix as matrix_repo


async def ensure_agent_mxid(
    session: AsyncSession,
    *,
    tenant_id: str,
    tenant_slug: str,
    agent_id: str,
    display_name: str = "",
) -> str:
    """Mint or return @agent_{tenant}_{agent}:server for fleet agents."""
    local_id = f"agent:{agent_id}"
    existing = await matrix_repo.get_user_map(
        session, tenant_id=tenant_id, local_id=local_id
    )
    if existing:
        return existing.mxid
    mxid = agent_mxid(tenant_slug, agent_id)
    await matrix_repo.upsert_user_map(
        session,
        tenant_id=tenant_id,
        local_id=local_id,
        mxid=mxid,
        kind="agent",
        display_name=display_name or agent_id,
    )
    return mxid


def federation_allowed(
    *,
    matrix_federation: bool,
    remote_server: str,
    allowlist: list[str] | None = None,
) -> bool:
    """Enterprise federation gate — empty allowlist means any when flag on."""
    if not matrix_federation:
        return False
    remote = remote_server.lower().strip()
    if remote == server_name().lower():
        return True
    if not allowlist:
        return True
    return remote in {a.lower().strip() for a in allowlist}


def agent_identity_payload(
    tenant_slug: str, agent_ids: list[str]
) -> list[dict[str, Any]]:
    return [
        {
            "agentId": a,
            "mxid": agent_mxid(tenant_slug, a),
            "kind": "agent",
        }
        for a in agent_ids
    ]
