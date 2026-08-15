"""Workflow webhooks for tracks and conversations.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "webhooks",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column("secret", sa.String(length=128), nullable=False),
        sa.Column("target_kind", sa.String(length=16), nullable=False),
        sa.Column("target_id", sa.String(length=64), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column(
            "events",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("last_status", sa.String(length=32), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_webhooks_tenant_id", "webhooks", ["tenant_id"])
    op.create_index(
        "ix_webhooks_tenant_direction", "webhooks", ["tenant_id", "direction"]
    )


def downgrade() -> None:
    op.drop_index("ix_webhooks_tenant_direction", table_name="webhooks")
    op.drop_index("ix_webhooks_tenant_id", table_name="webhooks")
    op.drop_table("webhooks")
