"""announcements + push_tokens tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-24

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "announcements",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("icon", sa.String(length=128), nullable=False),
        sa.Column("link_label", sa.String(length=255), nullable=False),
        sa.Column("link_href", sa.String(length=1024), nullable=False),
        sa.Column("link_kind", sa.String(length=32), nullable=False),
        sa.Column("cta_variant", sa.String(length=32), nullable=False),
        sa.Column("placement", sa.String(length=32), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("dismissible", sa.Boolean(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("audience", sa.String(length=32), nullable=False),
        sa.Column(
            "tenant_slugs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "style",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_announcements_enabled", "announcements", ["enabled"], unique=False)
    op.create_index("ix_announcements_priority", "announcements", ["priority"], unique=False)

    op.create_table(
        "push_tokens",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("token", sa.String(length=4096), nullable=False),
        sa.Column("platform", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("tenant_slug", sa.String(length=64), nullable=False),
        sa.Column("device_model", sa.String(length=255), nullable=False),
        sa.Column("app_version", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_push_tokens_token", "push_tokens", ["token"], unique=True)
    op.create_index("ix_push_tokens_platform", "push_tokens", ["platform"], unique=False)
    op.create_index("ix_push_tokens_tenant_slug", "push_tokens", ["tenant_slug"], unique=False)
    op.create_index(
        "ix_push_tokens_tenant_platform",
        "push_tokens",
        ["tenant_slug", "platform"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("push_tokens")
    op.drop_table("announcements")
