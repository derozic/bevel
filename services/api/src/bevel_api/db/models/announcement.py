"""Platform announcement bars — Postgres SoT (replaces data/announcements.json)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from bevel_api.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    icon: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    link_label: Mapped[str] = mapped_column(String(255), nullable=False, default="Learn more")
    link_href: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    link_kind: Mapped[str] = mapped_column(String(32), nullable=False, default="app")
    cta_variant: Mapped[str] = mapped_column(String(32), nullable=False, default="link")
    placement: Mapped[str] = mapped_column(String(32), nullable=False, default="top")
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="static")
    dismissible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    audience: Mapped[str] = mapped_column(String(32), nullable=False, default="all")
    tenant_slugs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    style: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
