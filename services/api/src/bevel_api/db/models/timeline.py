"""Personal timeline feed items + source configuration."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from bevel_api.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimelineItem(Base):
    """One feed entry for a recipient (mention, escalation, git, channel, …)."""

    __tablename__ = "timeline_items"
    __table_args__ = (
        UniqueConstraint(
            "recipient_user_id",
            "source_type",
            "source_id",
            "kind",
            name="uq_timeline_recipient_source_kind",
        ),
        Index("ix_timeline_recipient_created", "recipient_user_id", "created_at"),
        Index("ix_timeline_tenant_kind_created", "tenant_id", "kind", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    recipient_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # mention | escalation | git | channel | workspace | system
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="mention")
    # normal | high (escalations are high)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="normal")
    actor_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    actor_label: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    # message | git_event | channel_activity | system
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="message")
    source_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    channel_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    body_preview: Mapped[str] = mapped_column(Text, nullable=False, default="")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TimelineSource(Base):
    """Opt-in feed sources for a user (git, workspace, ~channel, …)."""

    __tablename__ = "timeline_sources"
    __table_args__ = (
        Index("ix_timeline_sources_user_tenant", "user_id", "tenant_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # git | workspace | channel | self
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    channel_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    github_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
