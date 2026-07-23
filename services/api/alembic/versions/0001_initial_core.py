"""initial core tables: tenants users channels messages handoff

Revision ID: 0001
Revises:
Create Date: 2026-07-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("hosts", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("plan", sa.String(length=32), nullable=False),
        sa.Column("feature_access", sa.String(length=32), nullable=False),
        sa.Column("auth_mode", sa.String(length=32), nullable=False),
        sa.Column("auth_policy", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("features", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("theme", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("realtime_namespace", sa.String(length=64), nullable=False),
        sa.Column("realtime_url", sa.String(length=512), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tenants_slug", "tenants", ["slug"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("image_url", sa.String(length=512), nullable=True),
        sa.Column("tenant_id", sa.String(length=64), nullable=True),
        sa.Column("role", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"], unique=False)

    op.create_table(
        "channels",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "default_agent_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_channels_tenant_slug"),
    )
    op.create_index("ix_channels_tenant_id", "channels", ["tenant_id"], unique=False)
    op.create_index("ix_channels_slug", "channels", ["slug"], unique=False)

    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("channel_id", sa.String(length=64), nullable=False),
        sa.Column("channel_slug", sa.String(length=64), nullable=False),
        sa.Column("speaker_id", sa.String(length=128), nullable=False),
        sa.Column("speaker_name", sa.String(length=255), nullable=False),
        sa.Column("speaker_avatar", sa.String(length=512), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column(
            "mentioned_agent_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_messages_tenant_id", "messages", ["tenant_id"], unique=False)
    op.create_index("ix_messages_channel_id", "messages", ["channel_id"], unique=False)
    op.create_index("ix_messages_channel_slug", "messages", ["channel_slug"], unique=False)
    op.create_index("ix_messages_speaker_id", "messages", ["speaker_id"], unique=False)
    op.create_index("ix_messages_created_at", "messages", ["created_at"], unique=False)
    op.create_index(
        "ix_messages_channel_created",
        "messages",
        ["channel_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_messages_tenant_created",
        "messages",
        ["tenant_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "auth_handoff_codes",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("image_url", sa.String(length=512), nullable=True),
        sa.Column("tenant_slug", sa.String(length=64), nullable=False),
        sa.Column("callback_path", sa.String(length=512), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_auth_handoff_codes_code_hash",
        "auth_handoff_codes",
        ["code_hash"],
        unique=True,
    )
    op.create_index(
        "ix_auth_handoff_codes_email",
        "auth_handoff_codes",
        ["email"],
        unique=False,
    )
    op.create_index(
        "ix_auth_handoff_codes_tenant_slug",
        "auth_handoff_codes",
        ["tenant_slug"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("auth_handoff_codes")
    op.drop_table("messages")
    op.drop_table("channels")
    op.drop_table("users")
    op.drop_table("tenants")
