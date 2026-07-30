"""timeline items/sources + user handle/personal agent + message people handles

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("handle", sa.String(length=64), nullable=True))
    op.add_column(
        "users",
        sa.Column("personal_agent_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "personal_agent_config",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.create_index("ix_users_handle", "users", ["handle"], unique=False)
    op.create_index(
        "uq_users_tenant_handle",
        "users",
        ["tenant_id", "handle"],
        unique=True,
        postgresql_where=sa.text("handle IS NOT NULL"),
    )

    op.add_column(
        "messages",
        sa.Column(
            "mentioned_handles",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "messages",
        sa.Column(
            "escalated_handles",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    op.create_table(
        "timeline_items",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("recipient_user_id", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.String(length=16), nullable=False),
        sa.Column("actor_user_id", sa.String(length=64), nullable=True),
        sa.Column("actor_label", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_id", sa.String(length=128), nullable=False),
        sa.Column("channel_slug", sa.String(length=64), nullable=True),
        sa.Column("body_preview", sa.Text(), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "recipient_user_id",
            "source_type",
            "source_id",
            "kind",
            name="uq_timeline_recipient_source_kind",
        ),
    )
    op.create_index(
        "ix_timeline_items_tenant_id", "timeline_items", ["tenant_id"]
    )
    op.create_index(
        "ix_timeline_items_recipient_user_id",
        "timeline_items",
        ["recipient_user_id"],
    )
    op.create_index(
        "ix_timeline_items_created_at", "timeline_items", ["created_at"]
    )
    op.create_index(
        "ix_timeline_recipient_created",
        "timeline_items",
        ["recipient_user_id", "created_at"],
    )
    op.create_index(
        "ix_timeline_tenant_kind_created",
        "timeline_items",
        ["tenant_id", "kind", "created_at"],
    )

    op.create_table(
        "timeline_sources",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("source_kind", sa.String(length=32), nullable=False),
        sa.Column("channel_slug", sa.String(length=64), nullable=True),
        sa.Column(
            "github_config",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_timeline_sources_user_id", "timeline_sources", ["user_id"]
    )
    op.create_index(
        "ix_timeline_sources_tenant_id", "timeline_sources", ["tenant_id"]
    )
    op.create_index(
        "ix_timeline_sources_user_tenant",
        "timeline_sources",
        ["user_id", "tenant_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_timeline_sources_user_tenant", table_name="timeline_sources")
    op.drop_index("ix_timeline_sources_tenant_id", table_name="timeline_sources")
    op.drop_index("ix_timeline_sources_user_id", table_name="timeline_sources")
    op.drop_table("timeline_sources")

    op.drop_index("ix_timeline_tenant_kind_created", table_name="timeline_items")
    op.drop_index("ix_timeline_recipient_created", table_name="timeline_items")
    op.drop_index("ix_timeline_items_created_at", table_name="timeline_items")
    op.drop_index(
        "ix_timeline_items_recipient_user_id", table_name="timeline_items"
    )
    op.drop_index("ix_timeline_items_tenant_id", table_name="timeline_items")
    op.drop_table("timeline_items")

    op.drop_column("messages", "escalated_handles")
    op.drop_column("messages", "mentioned_handles")

    op.drop_index("uq_users_tenant_handle", table_name="users")
    op.drop_index("ix_users_handle", table_name="users")
    op.drop_column("users", "personal_agent_config")
    op.drop_column("users", "personal_agent_id")
    op.drop_column("users", "handle")
