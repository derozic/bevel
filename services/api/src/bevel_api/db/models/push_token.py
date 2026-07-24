"""Device push tokens (APNs / FCM) — Postgres SoT (replaces data/push_tokens.json)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from bevel_api.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PushToken(Base):
    __tablename__ = "push_tokens"
    __table_args__ = (
        Index("ix_push_tokens_tenant_platform", "tenant_slug", "platform"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    token: Mapped[str] = mapped_column(String(4096), nullable=False, unique=True, index=True)
    platform: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    tenant_slug: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    device_model: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    app_version: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
