"""matrix room / event / user maps

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-29

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "matrix_room_maps",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("channel_slug", sa.String(length=64), nullable=False),
        sa.Column("room_id", sa.String(length=255), nullable=False),
        sa.Column("room_alias", sa.String(length=255), nullable=False),
        sa.Column("space_id", sa.String(length=255), nullable=False),
        sa.Column("e2ee", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("room_id", name="uq_matrix_room_id"),
        sa.UniqueConstraint(
            "tenant_id", "channel_slug", name="uq_matrix_room_tenant_channel"
        ),
    )
    op.create_index(
        "ix_matrix_room_maps_tenant_id", "matrix_room_maps", ["tenant_id"]
    )
    op.create_index(
        "ix_matrix_room_maps_channel_slug", "matrix_room_maps", ["channel_slug"]
    )
    op.create_index("ix_matrix_room_maps_room_id", "matrix_room_maps", ["room_id"])

    op.create_table(
        "matrix_event_maps",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("message_id", sa.String(length=64), nullable=False),
        sa.Column("event_id", sa.String(length=255), nullable=False),
        sa.Column("room_id", sa.String(length=255), nullable=False),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id", name="uq_matrix_event_message"),
        sa.UniqueConstraint("event_id", name="uq_matrix_event_id"),
    )
    op.create_index(
        "ix_matrix_event_maps_tenant_id", "matrix_event_maps", ["tenant_id"]
    )
    op.create_index(
        "ix_matrix_event_maps_message_id", "matrix_event_maps", ["message_id"]
    )
    op.create_index(
        "ix_matrix_event_maps_event_id", "matrix_event_maps", ["event_id"]
    )
    op.create_index("ix_matrix_event_maps_room_id", "matrix_event_maps", ["room_id"])

    op.create_table(
        "matrix_user_maps",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("local_id", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("mxid", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mxid", name="uq_matrix_user_mxid"),
        sa.UniqueConstraint(
            "tenant_id", "local_id", name="uq_matrix_user_tenant_local"
        ),
    )
    op.create_index(
        "ix_matrix_user_maps_tenant_id", "matrix_user_maps", ["tenant_id"]
    )
    op.create_index(
        "ix_matrix_user_maps_local_id", "matrix_user_maps", ["local_id"]
    )
    op.create_index("ix_matrix_user_maps_mxid", "matrix_user_maps", ["mxid"])


def downgrade() -> None:
    op.drop_table("matrix_user_maps")
    op.drop_table("matrix_event_maps")
    op.drop_table("matrix_room_maps")
