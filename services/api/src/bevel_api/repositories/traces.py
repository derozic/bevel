"""Agent runs + trace events — append-only action log (parallel to chat)."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.trace import AgentRun, AgentTraceEvent

# Max serialized payload size (bytes) after redaction
_MAX_PAYLOAD_BYTES = 64_000
_MAX_BODY_CHARS = 32_000

_SECRET_KEY_RE = re.compile(
    r"(api[_-]?key|secret|password|token|authorization|cookie|private[_-]?key)",
    re.I,
)
_SECRET_VALUE_RE = re.compile(
    r"(?i)(sk-[a-z0-9]{20,}|ghp_[a-z0-9]{20,}|xox[baprs]-[a-z0-9-]{20,}"
    r"|Bearer\s+[A-Za-z0-9._\-]{20,})"
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def _parse_ts(value: str | None) -> datetime:
    if not value:
        return _utcnow()
    try:
        # Support Z and offset forms
        cleaned = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return _utcnow()


def redact_payload(payload: dict[str, Any] | None) -> tuple[dict[str, Any], str]:
    """Strip obvious secrets from payload. Returns (payload, redaction level)."""
    if not payload:
        return {}, "none"

    redaction = "none"

    def walk(obj: Any) -> Any:
        nonlocal redaction
        if isinstance(obj, dict):
            out: dict[str, Any] = {}
            for k, v in obj.items():
                if _SECRET_KEY_RE.search(str(k)):
                    out[k] = "[redacted]"
                    redaction = "secrets_stripped"
                else:
                    out[k] = walk(v)
            return out
        if isinstance(obj, list):
            return [walk(x) for x in obj]
        if isinstance(obj, str):
            if _SECRET_VALUE_RE.search(obj):
                redaction = "secrets_stripped"
                return _SECRET_VALUE_RE.sub("[redacted]", obj)
            return obj
        return obj

    cleaned = walk(payload)
    try:
        raw = json.dumps(cleaned, default=str)
    except (TypeError, ValueError):
        return {"_error": "payload_not_serializable"}, "partial"

    if len(raw.encode("utf-8")) > _MAX_PAYLOAD_BYTES:
        redaction = "partial" if redaction == "none" else redaction
        # Truncate by keeping only shallow keys
        shallow = {
            k: (v if not isinstance(v, (dict, list)) else "[truncated]")
            for k, v in list(cleaned.items())[:40]
        }
        shallow["_truncated"] = True
        return shallow, redaction

    return cleaned, redaction


def run_to_api_dict(row: AgentRun) -> dict[str, Any]:
    return {
        "id": row.id,
        "tenantId": row.tenant_id,
        "roomKind": row.room_kind,
        "roomId": row.room_id,
        "agentId": row.agent_id,
        "parentRunId": row.parent_run_id,
        "messageId": row.message_id,
        "status": row.status,
        "title": row.title,
        "startedAt": row.started_at.isoformat() if row.started_at else None,
        "endedAt": row.ended_at.isoformat() if row.ended_at else None,
        "meta": dict(row.meta or {}),
    }


def event_to_api_dict(row: AgentTraceEvent) -> dict[str, Any]:
    return {
        "id": row.id,
        "schemaVersion": row.schema_version,
        "tenantId": row.tenant_id,
        "runId": row.run_id,
        "roomKind": row.room_kind,
        "roomId": row.room_id,
        "agentId": row.agent_id,
        "messageId": row.message_id,
        "kind": row.kind,
        "status": row.status,
        "title": row.title,
        "summary": row.summary,
        "bodyMarkdown": row.body_markdown,
        "payload": dict(row.payload or {}),
        "spanId": row.span_id,
        "parentSpanId": row.parent_span_id,
        "ts": row.ts.isoformat() if row.ts else None,
        "durationMs": row.duration_ms,
        "redaction": row.redaction,
    }


async def open_run(
    session: AsyncSession,
    *,
    tenant_id: str,
    room_kind: str,
    room_id: str,
    agent_id: str,
    run_id: str | None = None,
    parent_run_id: str | None = None,
    message_id: str | None = None,
    title: str | None = None,
    meta: dict[str, Any] | None = None,
) -> AgentRun:
    rid = run_id or _id("run")
    existing = await session.get(AgentRun, rid)
    if existing is not None:
        return existing

    row = AgentRun(
        id=rid,
        tenant_id=tenant_id,
        room_kind=room_kind,
        room_id=room_id,
        agent_id=agent_id,
        parent_run_id=parent_run_id,
        message_id=message_id,
        status="running",
        title=title,
        started_at=_utcnow(),
        meta=dict(meta or {}),
    )
    session.add(row)
    await session.flush()
    return row


async def close_run(
    session: AsyncSession,
    *,
    tenant_id: str,
    run_id: str,
    status: str,
    title: str | None = None,
    meta: dict[str, Any] | None = None,
) -> AgentRun | None:
    row = await session.get(AgentRun, run_id)
    if row is None or row.tenant_id != tenant_id:
        return None
    row.status = status
    row.ended_at = _utcnow()
    if title is not None:
        row.title = title
    if meta:
        merged = dict(row.meta or {})
        merged.update(meta)
        row.meta = merged
    await session.flush()
    return row


async def ensure_run_for_event(
    session: AsyncSession,
    *,
    tenant_id: str,
    run_id: str,
    room_kind: str,
    room_id: str,
    agent_id: str,
    message_id: str | None = None,
    parent_run_id: str | None = None,
) -> AgentRun:
    existing = await session.get(AgentRun, run_id)
    if existing is not None:
        return existing
    return await open_run(
        session,
        tenant_id=tenant_id,
        room_kind=room_kind,
        room_id=room_id,
        agent_id=agent_id,
        run_id=run_id,
        parent_run_id=parent_run_id,
        message_id=message_id,
    )


async def append_event(
    session: AsyncSession,
    *,
    data: dict[str, Any],
) -> AgentTraceEvent:
    """Append one event. Ensures parent run exists. Applies redaction + size limits."""
    tenant_id = str(data["tenantId"])
    run_id = str(data["runId"])
    room_kind = str(data["roomKind"])
    room_id = str(data["roomId"])
    agent_id = str(data["agentId"])
    message_id = data.get("messageId")
    parent_run_id = data.get("parentRunId")

    await ensure_run_for_event(
        session,
        tenant_id=tenant_id,
        run_id=run_id,
        room_kind=room_kind,
        room_id=room_id,
        agent_id=agent_id,
        message_id=str(message_id) if message_id else None,
        parent_run_id=str(parent_run_id) if parent_run_id else None,
    )

    payload_in = data.get("payload") if isinstance(data.get("payload"), dict) else {}
    payload, auto_redaction = redact_payload(payload_in)
    redaction = str(data.get("redaction") or auto_redaction)
    if auto_redaction != "none" and redaction == "none":
        redaction = auto_redaction

    body = data.get("bodyMarkdown")
    if isinstance(body, str) and len(body) > _MAX_BODY_CHARS:
        body = body[:_MAX_BODY_CHARS] + "\n\n…[truncated]"

    event_id = str(data.get("id") or _id("tr"))
    existing = await session.get(AgentTraceEvent, event_id)
    if existing is not None:
        return existing

    # Close run on terminal kinds
    kind = str(data["kind"])
    status = str(data.get("status") or "ok")
    if kind in ("run_end", "run_error"):
        close_status = "error" if kind == "run_error" or status == "error" else status
        if close_status == "running":
            close_status = "ok" if kind == "run_end" else "error"
        await close_run(
            session,
            tenant_id=tenant_id,
            run_id=run_id,
            status=close_status if close_status in ("ok", "error", "cancelled") else "ok",
            title=str(data["title"]) if data.get("title") else None,
        )

    row = AgentTraceEvent(
        id=event_id,
        tenant_id=tenant_id,
        run_id=run_id,
        room_kind=room_kind,
        room_id=room_id,
        agent_id=agent_id,
        message_id=str(message_id) if message_id else None,
        kind=kind,
        status=status,
        title=str(data["title"])[:500],
        summary=str(data["summary"])[:4000] if data.get("summary") else None,
        body_markdown=body,
        payload=payload,
        span_id=str(data["spanId"]) if data.get("spanId") else None,
        parent_span_id=str(data["parentSpanId"]) if data.get("parentSpanId") else None,
        ts=_parse_ts(data.get("ts") if isinstance(data.get("ts"), str) else None),
        duration_ms=int(data["durationMs"]) if data.get("durationMs") is not None else None,
        redaction=redaction,
        schema_version=int(data.get("schemaVersion") or 1),
    )
    session.add(row)
    await session.flush()
    return row


async def append_events(
    session: AsyncSession,
    *,
    events: list[dict[str, Any]],
) -> list[AgentTraceEvent]:
    out: list[AgentTraceEvent] = []
    for ev in events:
        out.append(await append_event(session, data=ev))
    return out


async def list_events_for_room(
    session: AsyncSession,
    *,
    tenant_id: str,
    room_kind: str,
    room_id: str,
    limit: int = 100,
    before: datetime | None = None,
    kind: str | None = None,
    agent_id: str | None = None,
) -> list[AgentTraceEvent]:
    lim = max(1, min(limit, 500))
    q = select(AgentTraceEvent).where(
        AgentTraceEvent.tenant_id == tenant_id,
        AgentTraceEvent.room_kind == room_kind,
        AgentTraceEvent.room_id == room_id,
    )
    if before is not None:
        q = q.where(AgentTraceEvent.ts < before)
    if kind:
        q = q.where(AgentTraceEvent.kind == kind)
    if agent_id:
        q = q.where(AgentTraceEvent.agent_id == agent_id)
    q = q.order_by(AgentTraceEvent.ts.desc()).limit(lim)
    result = await session.execute(q)
    return list(result.scalars().all())


async def list_events_for_run(
    session: AsyncSession,
    *,
    tenant_id: str,
    run_id: str,
    limit: int = 500,
) -> list[AgentTraceEvent]:
    lim = max(1, min(limit, 1000))
    q = (
        select(AgentTraceEvent)
        .where(
            AgentTraceEvent.tenant_id == tenant_id,
            AgentTraceEvent.run_id == run_id,
        )
        .order_by(AgentTraceEvent.ts.asc())
        .limit(lim)
    )
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_run(
    session: AsyncSession,
    *,
    tenant_id: str,
    run_id: str,
) -> AgentRun | None:
    row = await session.get(AgentRun, run_id)
    if row is None or row.tenant_id != tenant_id:
        return None
    return row
