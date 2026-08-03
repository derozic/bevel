"""Agent membership on a channel — ACL, not decoration."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from bevel_api.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ChannelAgentMember(Base):
    """Roster row: agent is a first-class channel member (role defaults to bot)."""

    __tablename__ = "channel_agent_members"
    __table_args__ = (
        UniqueConstraint(
            "channel_id",
            "agent_id",
            name="uq_channel_agent_members_channel_agent",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    channel_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="bot")
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    added_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
