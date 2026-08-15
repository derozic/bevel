"""Webhook delivery log.

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("webhook_id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("event", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("response_status", sa.String(length=32), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_webhook_deliveries_hook_created",
        "webhook_deliveries",
        ["webhook_id", "created_at"],
    )
    op.create_index("ix_webhook_deliveries_webhook_id", "webhook_deliveries", ["webhook_id"])


def downgrade() -> None:
    op.drop_index("ix_webhook_deliveries_webhook_id", table_name="webhook_deliveries")
    op.drop_index("ix_webhook_deliveries_hook_created", table_name="webhook_deliveries")
    op.drop_table("webhook_deliveries")
