"""Agent Trace ingest + list — parallel to conversation (not Timeline inbox)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import internal_ok
from bevel_api.repositories import traces as traces_repo

router = APIRouter(prefix="/v1", tags=["Traces"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _require_internal(request: Request) -> None:
    if not internal_ok(request):
        raise HTTPException(
            401,
            "Unauthorized — traces ingest requires X-Fleet-Internal-Key "
            "(fleet runner, Hermes skill, or web BFF)",
        )


class TraceEventIn(BaseModel):
    id: Optional[str] = None
    schemaVersion: Optional[int] = 1
    tenantId: str
    runId: str
    parentRunId: Optional[str] = None
    spanId: Optional[str] = None
    parentSpanId: Optional[str] = None
    roomKind: str
    roomId: str
    messageId: Optional[str] = None
    agentId: str
    actor: Optional[str] = None
    ts: Optional[str] = None
    durationMs: Optional[int] = None
    kind: str
    title: str
    summary: Optional[str] = None
    bodyMarkdown: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    status: Optional[str] = "ok"
    redaction: Optional[str] = None


class TraceBatchIn(BaseModel):
    events: list[TraceEventIn] = Field(min_length=1, max_length=100)


class RunOpenIn(BaseModel):
    id: Optional[str] = None
    tenantId: str
    roomKind: str
    roomId: str
    agentId: str
    parentRunId: Optional[str] = None
    messageId: Optional[str] = None
    title: Optional[str] = None
    meta: Optional[dict[str, Any]] = None


class RunCloseIn(BaseModel):
    status: str = "ok"
    title: Optional[str] = None
    meta: Optional[dict[str, Any]] = None


@router.post("/traces")
async def ingest_traces(
    body: TraceBatchIn,
    request: Request,
    session: SessionDep,
) -> dict[str, Any]:
    """Batch ingest agent action events (machine + human readable)."""
    _require_internal(request)
    rows = await traces_repo.append_events(
        session,
        events=[e.model_dump(exclude_none=True) for e in body.events],
    )
    await session.commit()
    return {
        "ok": True,
        "count": len(rows),
        "events": [traces_repo.event_to_api_dict(r) for r in rows],
    }


@router.post("/traces/runs")
async def open_run(
    body: RunOpenIn,
    request: Request,
    session: SessionDep,
) -> dict[str, Any]:
    _require_internal(request)
    row = await traces_repo.open_run(
        session,
        tenant_id=body.tenantId,
        room_kind=body.roomKind,
        room_id=body.roomId,
        agent_id=body.agentId,
        run_id=body.id,
        parent_run_id=body.parentRunId,
        message_id=body.messageId,
        title=body.title,
        meta=body.meta,
    )
    await session.commit()
    return {"ok": True, "run": traces_repo.run_to_api_dict(row)}


@router.post("/traces/runs/{run_id}/close")
async def close_run(
    run_id: str,
    body: RunCloseIn,
    request: Request,
    session: SessionDep,
    x_bevel_tenant_id: Annotated[str | None, Header()] = None,
    tenantId: Optional[str] = Query(default=None),
) -> dict[str, Any]:
    _require_internal(request)
    tenant = (tenantId or x_bevel_tenant_id or "").strip()
    if not tenant:
        from bevel_api.db.models.trace import AgentRun

        raw = await session.get(AgentRun, run_id)
        if raw is None:
            raise HTTPException(404, "run not found")
        tenant = raw.tenant_id

    status = body.status if body.status in ("ok", "error", "cancelled") else "ok"
    row = await traces_repo.close_run(
        session,
        tenant_id=tenant,
        run_id=run_id,
        status=status,
        title=body.title,
        meta=body.meta,
    )
    if row is None:
        raise HTTPException(404, "run not found")
    await session.commit()
    return {"ok": True, "run": traces_repo.run_to_api_dict(row)}


@router.get("/traces")
async def list_traces(
    request: Request,
    session: SessionDep,
    roomKind: str = Query(...),
    roomId: str = Query(...),
    tenantId: str = Query(...),
    limit: int = Query(default=100, ge=1, le=500),
    before: Optional[str] = Query(default=None),
    kind: Optional[str] = Query(default=None),
    agentId: Optional[str] = Query(default=None),
) -> dict[str, Any]:
    """Hydrate Trace pane for a room (channel slug or agent session id)."""
    _require_internal(request)
    before_dt: datetime | None = None
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except ValueError:
            before_dt = None
    rows = await traces_repo.list_events_for_room(
        session,
        tenant_id=tenantId,
        room_kind=roomKind,
        room_id=roomId,
        limit=limit,
        before=before_dt,
        kind=kind,
        agent_id=agentId,
    )
    # API returns chronological for UI (oldest first within page); query was desc
    items = [traces_repo.event_to_api_dict(r) for r in reversed(rows)]
    return {
        "ok": True,
        "items": items,
        "nextBefore": rows[-1].ts.isoformat() if rows else None,
    }


@router.get("/traces/runs/{run_id}")
async def get_run(
    run_id: str,
    request: Request,
    session: SessionDep,
    tenantId: str = Query(...),
) -> dict[str, Any]:
    _require_internal(request)
    run = await traces_repo.get_run(session, tenant_id=tenantId, run_id=run_id)
    if run is None:
        raise HTTPException(404, "run not found")
    events = await traces_repo.list_events_for_run(
        session, tenant_id=tenantId, run_id=run_id
    )
    return {
        "ok": True,
        "run": traces_repo.run_to_api_dict(run),
        "events": [traces_repo.event_to_api_dict(e) for e in events],
    }


@router.get("/traces/export")
async def export_traces(
    request: Request,
    session: SessionDep,
    roomKind: str = Query(...),
    roomId: str = Query(...),
    tenantId: str = Query(...),
    limit: int = Query(default=500, ge=1, le=2000),
) -> Response:
    """Machine-readable NDJSON export of room traces."""
    _require_internal(request)
    rows = await traces_repo.list_events_for_room(
        session,
        tenant_id=tenantId,
        room_kind=roomKind,
        room_id=roomId,
        limit=limit,
    )
    import json

    lines = [
        json.dumps(traces_repo.event_to_api_dict(r), default=str)
        for r in reversed(rows)
    ]
    return PlainTextResponse(
        "\n".join(lines) + ("\n" if lines else ""),
        media_type="application/x-ndjson",
    )
