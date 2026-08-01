"""Agent runs + append-only trace events (parallel to chat)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from bevel_api.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AgentRun(Base):
    """One agent work unit / turn — groups trace events."""

    __tablename__ = "agent_runs"
    __table_args__ = (
        Index("ix_agent_runs_tenant_room_started", "tenant_id", "room_kind", "room_id", "started_at"),
        Index("ix_agent_runs_tenant_agent_started", "tenant_id", "agent_id", "started_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # channel | agent_session | computer | cloud
    room_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    room_id: Mapped[str] = mapped_column(String(256), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    parent_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # running | ok | error | cancelled
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class AgentTraceEvent(Base):
    """One human+machine readable agent action step."""

    __tablename__ = "agent_trace_events"
    __table_args__ = (
        Index(
            "ix_trace_events_tenant_room_ts",
            "tenant_id",
            "room_kind",
            "room_id",
            "ts",
        ),
        Index("ix_trace_events_tenant_run_ts", "tenant_id", "run_id", "ts"),
        Index("ix_trace_events_tenant_agent_ts", "tenant_id", "agent_id", "ts"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    run_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    room_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    room_id: Mapped[str] = mapped_column(String(256), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False)
    message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # thinking | tool_call | handoff | computer | …
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    # pending | running | ok | error | cancelled
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ok")
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    span_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    parent_span_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # none | partial | secrets_stripped
    redaction: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
