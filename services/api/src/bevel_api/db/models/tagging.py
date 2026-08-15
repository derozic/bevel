"""Folksonomy tagging — freeform slugs on agents, people, and tracks."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from bevel_api.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Tagging(Base):
    __tablename__ = "taggings"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "slug",
            "entity_kind",
            "entity_id",
            name="uq_taggings_tenant_slug_kind_id",
        ),
        Index("ix_taggings_tenant_slug", "tenant_id", "slug"),
        Index("ix_taggings_tenant_entity", "tenant_id", "entity_kind", "entity_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False)
    slug: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(128), nullable=False)
    tagged_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
