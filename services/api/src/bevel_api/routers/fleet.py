"""Fleet channel + message REST — Postgres-backed."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import require_internal
from bevel_api.repositories import channel_agents as channel_agents_repo
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import messages as messages_repo
from bevel_api.repositories import tenants as tenants_repo
from bevel_api.repositories import workflows as workflows_repo

router = APIRouter(prefix="/v1/fleet", tags=["Fleet"])

InternalAuth = Annotated[None, Depends(require_internal)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]

DEFAULT_TENANT_SLUG = "2x4m"


async def _resolve_tenant(
    session: AsyncSession,
    tenant_slug: str | None,
) -> Any:
    slug = (tenant_slug or DEFAULT_TENANT_SLUG).strip().lower()
    tenant = await tenants_repo.get_by_slug(session, slug)
    if tenant is None:
        # Soft-create from YAML if present
        from bevel_api.lib import tenants as yaml_tenants

        try:
            raw = yaml_tenants.load_tenant(slug)
            tenant = await tenants_repo.upsert_from_yaml(session, slug, raw)
            await channels_repo.ensure_defaults(session, tenant.id)
        except FileNotFoundError as exc:
            raise HTTPException(404, f"tenant not found: {slug}") from exc
    return tenant


@router.get("/channels")
async def list_channels(
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None, description="Tenant slug"),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    channels = await channels_repo.list_for_tenant(session, row.id)
    if not channels:
        channels = await channels_repo.ensure_defaults(session, row.id)
    out = []
    for c in channels:
        out.append(await channels_repo.to_api_dict_with_members(session, c))
    return {
        "tenant": row.slug,
        "channels": out,
    }


@router.get("/channels/{slug}")
async def get_channel(
    slug: str,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    return await channels_repo.to_api_dict_with_members(session, ch)


@router.get("/channels/{slug}/messages")
async def get_messages(
    slug: str,
    _auth: InternalAuth,
    session: SessionDep,
    limit: int = Query(default=100, ge=1, le=500),
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    msgs = await messages_repo.list_for_channel(
        session,
        tenant_id=row.id,
        channel_id=ch.id,
        limit=limit,
    )
    return {
        "tenant": row.slug,
        "channel": ch.slug,
        "messages": [messages_repo.to_api_dict(m) for m in msgs],
    }


@router.post("/channels/{slug}/messages")
async def post_message(
    slug: str,
    request: Request,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    """Upsert a channel message (idempotent by ``id``).

    Clients may re-POST the same id for retries or streaming status updates
    (``pending`` / ``streaming`` / ``final``). Postgres is the durable SoT.
    """
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    if not isinstance(body, dict):
        raise HTTPException(400, "JSON object required")
    # New message needs body; updates (same id) may only change status/body
    has_id = bool(str(body.get("id") or "").strip())
    has_body = bool(str(body.get("body") or "").strip())
    if not has_body and not has_id:
        raise HTTPException(400, "body required (or id for status update)")

    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    try:
        record = await messages_repo.append(
            session,
            tenant_id=row.id,
            channel_id=ch.id,
            channel_slug=ch.slug,
            msg=body,
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc

    # Fan-out @mentions (soft) and ^escalations into personal timelines
    timeline_fanout: dict[str, Any] | None = None
    meta = dict(record.metadata_ or {})
    status = str(meta.get("status") or "final")
    if status not in {"pending", "streaming", "partial"} and (
        record.mentioned_handles or record.escalated_handles
    ):
        try:
            from bevel_api.repositories import timeline as timeline_repo

            actor_user_id = (
                str(body.get("actorUserId") or body.get("actor_user_id") or "")
                .strip()
                or None
            )
            # speakerId may be human:<id>
            if not actor_user_id:
                sid = str(record.speaker_id or "")
                if sid.startswith("human:"):
                    actor_user_id = sid.split(":", 1)[1] or None
            timeline_fanout = await timeline_repo.fan_out_from_message(
                session,
                message=record,
                actor_user_id=actor_user_id,
            )
        except Exception:
            # Never block message write on timeline failures
            timeline_fanout = {"ok": False, "error": "fanout_failed"}

    # Channel YAML workflows (message_posted) — best-effort, non-blocking on failure
    workflow_runs: list[dict[str, Any]] = []
    speaker_type = str(meta.get("speakerType") or meta.get("speaker_type") or "agent")
    if status not in {"pending", "streaming", "partial"} and record.body:
        try:
            workflow_runs = await workflows_repo.evaluate_message_posted(
                session,
                tenant_id=row.id,
                channel_id=ch.id,
                channel_slug=ch.slug,
                message_id=record.id,
                body=record.body,
                speaker_type=speaker_type,
            )
            # Execute post_message / mention_agent side effects as system messages
            for wr in workflow_runs:
                for action in wr.get("actions") or []:
                    atype = action.get("type")
                    if atype in {"post_message", "mention_agent"}:
                        body_text = str(action.get("body") or "").strip()
                        if not body_text:
                            continue
                        agent_id = str(action.get("agentId") or "workflow").lower()
                        # ACL: mention_agent only if member
                        if atype == "mention_agent":
                            if not await channel_agents_repo.is_member(
                                session, channel_id=ch.id, agent_id=agent_id
                            ):
                                continue
                        await messages_repo.append(
                            session,
                            tenant_id=row.id,
                            channel_id=ch.id,
                            channel_slug=ch.slug,
                            msg={
                                "speakerId": f"workflow:{wr['workflow']['id']}",
                                "speakerName": wr["workflow"].get("name") or "workflow",
                                "speakerType": "system",
                                "agentId": agent_id if atype == "mention_agent" else "",
                                "body": body_text,
                                "status": "final",
                                "tags": ["workflow"],
                            },
                        )
                    elif atype == "request_approval":
                        await messages_repo.append(
                            session,
                            tenant_id=row.id,
                            channel_id=ch.id,
                            channel_slug=ch.slug,
                            msg={
                                "speakerId": "system:workflow",
                                "speakerName": "workflow",
                                "speakerType": "system",
                                "body": (
                                    f"Approval required: {action.get('message') or 'Please approve'} "
                                    f"(from {action.get('from') or 'admin'})"
                                ),
                                "status": "final",
                                "tags": ["workflow", "approval"],
                            },
                        )
        except Exception:
            workflow_runs = [{"ok": False, "error": "workflow_eval_failed"}]

    return {
        "ok": True,
        "upserted": True,
        "message": messages_repo.to_api_dict(record),
        "timeline": timeline_fanout,
        "workflows": workflow_runs,
    }


@router.get("/channels/{slug}/agents")
async def list_channel_agents(
    slug: str,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    """Agent membership roster for a channel (ACL)."""
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    await channel_agents_repo.sync_defaults_from_channel(session, ch)
    members = await channel_agents_repo.list_for_channel(session, channel_id=ch.id)
    return {
        "tenant": row.slug,
        "channel": ch.slug,
        "agents": [channel_agents_repo.to_api_dict(m) for m in members],
        "agentIds": [m.agent_id for m in members],
    }


@router.put("/channels/{slug}/agents/{agent_id}")
async def add_channel_agent(
    slug: str,
    agent_id: str,
    request: Request,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    """Add agent as channel member (ACL)."""
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    added_by = None
    try:
        body = await request.json()
        if isinstance(body, dict):
            added_by = body.get("addedBy") or body.get("added_by")
    except Exception:
        pass
    member = await channel_agents_repo.add_member(
        session,
        tenant_id=row.id,
        channel_id=ch.id,
        agent_id=agent_id,
        added_by=str(added_by) if added_by else None,
    )
    return {"ok": True, "member": channel_agents_repo.to_api_dict(member)}


@router.delete("/channels/{slug}/agents/{agent_id}")
async def remove_channel_agent(
    slug: str,
    agent_id: str,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    removed = await channel_agents_repo.remove_member(
        session, channel_id=ch.id, agent_id=agent_id
    )
    return {"ok": True, "removed": removed}


@router.put("/channels/{slug}/agents")
async def replace_channel_agents(
    slug: str,
    request: Request,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    """Replace full agent roster. Body: { agentIds: string[] }."""
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    if not isinstance(body, dict):
        raise HTTPException(400, "JSON object required")
    ids = body.get("agentIds") or body.get("agent_ids") or []
    if not isinstance(ids, list):
        raise HTTPException(400, "agentIds must be an array")
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    members = await channel_agents_repo.replace_roster(
        session,
        tenant_id=row.id,
        channel_id=ch.id,
        agent_ids=[str(x) for x in ids],
        added_by=str(body.get("addedBy") or "") or None,
    )
    # Keep default_agent_ids in sync for older clients
    ch.default_agent_ids = [m.agent_id for m in members]
    return {
        "ok": True,
        "agentIds": [m.agent_id for m in members],
        "agents": [channel_agents_repo.to_api_dict(m) for m in members],
    }


@router.get("/search")
async def search_fleet_messages(
    _auth: InternalAuth,
    session: SessionDep,
    q: str = Query(..., min_length=1),
    tenant: str | None = Query(default=None),
    channel: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    """Search message bodies (ILIKE). JSON CLI / MCP entrypoint."""
    row = await _resolve_tenant(session, tenant)
    channel_id = None
    if channel:
        ch = await channels_repo.get_by_slug(session, row.id, channel)
        if ch is None:
            raise HTTPException(404, f"channel not found: {channel}")
        channel_id = ch.id
    hits = await messages_repo.search_messages(
        session,
        tenant_id=row.id,
        q=q,
        channel_id=channel_id,
        limit=limit,
    )
    return {
        "ok": True,
        "q": q,
        "tenant": row.slug,
        "count": len(hits),
        "messages": [messages_repo.to_api_dict(m) for m in hits],
    }


class WorkflowBody(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    enabled: bool = True
    definition: dict[str, Any] = Field(default_factory=dict)


@router.get("/channels/{slug}/workflows")
async def list_workflows(
    slug: str,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    wfs = await workflows_repo.list_for_channel(session, channel_id=ch.id)
    return {
        "tenant": row.slug,
        "channel": ch.slug,
        "workflows": [workflows_repo.to_api_dict(w) for w in wfs],
    }


@router.post("/channels/{slug}/workflows")
async def create_workflow(
    slug: str,
    body: WorkflowBody,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    defn = dict(body.definition or {})
    if "name" not in defn:
        defn["name"] = body.name
    wf = await workflows_repo.upsert(
        session,
        tenant_id=row.id,
        channel_id=ch.id,
        name=body.name,
        definition=defn,
        enabled=body.enabled,
    )
    return {"ok": True, "workflow": workflows_repo.to_api_dict(wf)}


@router.delete("/channels/{slug}/workflows/{workflow_id}")
async def delete_workflow(
    slug: str,
    workflow_id: str,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
) -> dict[str, Any]:
    row = await _resolve_tenant(session, tenant)
    await channels_repo.ensure_channel(session, row.id, slug)
    ok = await workflows_repo.delete_workflow(session, workflow_id)
    if not ok:
        raise HTTPException(404, "workflow not found")
    return {"ok": True, "deleted": workflow_id}


@router.get("/channels/{slug}/messages/in-progress")
async def get_in_progress_messages(
    slug: str,
    _auth: InternalAuth,
    session: SessionDep,
    tenant: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    """Recover pending/streaming messages after client reconnect."""
    row = await _resolve_tenant(session, tenant)
    ch = await channels_repo.ensure_channel(session, row.id, slug)
    msgs = await messages_repo.list_in_progress(
        session,
        tenant_id=row.id,
        channel_id=ch.id,
        limit=limit,
    )
    return {
        "tenant": row.slug,
        "channel": ch.slug,
        "messages": [messages_repo.to_api_dict(m) for m in msgs],
    }
