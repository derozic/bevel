"""channel_agent_members + channel_workflows + workflow_runs

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-03

Agents as channel members (ACL) and channel-scoped YAML workflows.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "channel_agent_members",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("channel_id", sa.String(length=64), nullable=False),
        sa.Column("agent_id", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="bot"),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("added_by", sa.String(length=128), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "channel_id",
            "agent_id",
            name="uq_channel_agent_members_channel_agent",
        ),
    )
    op.create_index(
        "ix_channel_agent_members_tenant_channel",
        "channel_agent_members",
        ["tenant_id", "channel_id"],
    )
    op.create_index(
        "ix_channel_agent_members_agent",
        "channel_agent_members",
        ["agent_id"],
    )

    op.create_table(
        "channel_workflows",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("channel_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("definition", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "channel_id",
            "name",
            name="uq_channel_workflows_channel_name",
        ),
    )
    op.create_index(
        "ix_channel_workflows_tenant_channel",
        "channel_workflows",
        ["tenant_id", "channel_id"],
    )

    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("workflow_id", sa.String(length=64), nullable=False),
        sa.Column("channel_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="completed"),
        sa.Column("trigger_kind", sa.String(length=64), nullable=False, server_default="message_posted"),
        sa.Column("trigger_message_id", sa.String(length=64), nullable=True),
        sa.Column("trace", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_workflow_runs_workflow_created",
        "workflow_runs",
        ["workflow_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_workflow_runs_workflow_created", table_name="workflow_runs")
    op.drop_table("workflow_runs")
    op.drop_index("ix_channel_workflows_tenant_channel", table_name="channel_workflows")
    op.drop_table("channel_workflows")
    op.drop_index("ix_channel_agent_members_agent", table_name="channel_agent_members")
    op.drop_index("ix_channel_agent_members_tenant_channel", table_name="channel_agent_members")
    op.drop_table("channel_agent_members")
