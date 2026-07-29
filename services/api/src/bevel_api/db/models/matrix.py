"""Matrix room / event / user mappings (BEVEL ↔ Synapse)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from bevel_api.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MatrixRoomMap(Base):
    """Maps a BEVEL channel to a Matrix room id."""

    __tablename__ = "matrix_room_maps"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "channel_slug", name="uq_matrix_room_tenant_channel"
        ),
        UniqueConstraint("room_id", name="uq_matrix_room_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    channel_slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    room_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    room_alias: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    space_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    e2ee: Mapped[str] = mapped_column(String(8), nullable=False, default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )


class MatrixEventMap(Base):
    """Maps a BEVEL message id to a Matrix event id."""

    __tablename__ = "matrix_event_maps"
    __table_args__ = (
        UniqueConstraint("message_id", name="uq_matrix_event_message"),
        UniqueConstraint("event_id", name="uq_matrix_event_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    message_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    room_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(
        String(16), nullable=False, default="out"
    )  # out = BEVEL→Matrix, in = Matrix→BEVEL
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )


class MatrixUserMap(Base):
    """Maps a BEVEL user / agent identity to a Matrix user id."""

    __tablename__ = "matrix_user_maps"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "local_id", name="uq_matrix_user_tenant_local"
        ),
        UniqueConstraint("mxid", name="uq_matrix_user_mxid"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    local_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(
        String(32), nullable=False, default="user"
    )  # user | agent | bot
    mxid: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
