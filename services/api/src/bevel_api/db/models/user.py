"""Workspace user identity (platform login maps here)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from bevel_api.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    tenant_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    role: Mapped[str] = mapped_column(String(64), nullable=False, default="member")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Public @handle for mentions / escalations (unique per tenant when set)
    handle: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Personal assistant agent (e.g. hermes) — helps on ^escalations + PA features
    personal_agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    personal_agent_config: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    # Full BevelUserPreferences blob (profile, appearance, notifications, …)
    # Source of truth for settings UI; localStorage is cache only.
    preferences: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
