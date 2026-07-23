"""One-time cross-host auth handoff codes (bevel.is → org host)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from bevel_api.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuthHandoffCode(Base):
    __tablename__ = "auth_handoff_codes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    tenant_slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    callback_path: Mapped[str] = mapped_column(
        String(512), nullable=False, default="/^general"
    )
    # Opaque JWT claims blob (optional) for richer session restore
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
