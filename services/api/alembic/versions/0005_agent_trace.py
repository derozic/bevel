"""agent_runs + agent_trace_events for agent action tracing

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("room_kind", sa.String(length=32), nullable=False),
        sa.Column("room_id", sa.String(length=256), nullable=False),
        sa.Column("agent_id", sa.String(length=64), nullable=False),
        sa.Column("parent_run_id", sa.String(length=64), nullable=True),
        sa.Column("message_id", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "meta",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_runs_tenant_id", "agent_runs", ["tenant_id"])
    op.create_index("ix_agent_runs_agent_id", "agent_runs", ["agent_id"])
    op.create_index(
        "ix_agent_runs_tenant_room_started",
        "agent_runs",
        ["tenant_id", "room_kind", "room_id", "started_at"],
    )
    op.create_index(
        "ix_agent_runs_tenant_agent_started",
        "agent_runs",
        ["tenant_id", "agent_id", "started_at"],
    )

    op.create_table(
        "agent_trace_events",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("run_id", sa.String(length=64), nullable=False),
        sa.Column("room_kind", sa.String(length=32), nullable=False),
        sa.Column("room_id", sa.String(length=256), nullable=False),
        sa.Column("agent_id", sa.String(length=64), nullable=False),
        sa.Column("message_id", sa.String(length=128), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("body_markdown", sa.Text(), nullable=True),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("span_id", sa.String(length=64), nullable=True),
        sa.Column("parent_span_id", sa.String(length=64), nullable=True),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("redaction", sa.String(length=32), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_agent_trace_events_tenant_id", "agent_trace_events", ["tenant_id"]
    )
    op.create_index(
        "ix_agent_trace_events_run_id", "agent_trace_events", ["run_id"]
    )
    op.create_index("ix_agent_trace_events_ts", "agent_trace_events", ["ts"])
    op.create_index(
        "ix_trace_events_tenant_room_ts",
        "agent_trace_events",
        ["tenant_id", "room_kind", "room_id", "ts"],
    )
    op.create_index(
        "ix_trace_events_tenant_run_ts",
        "agent_trace_events",
        ["tenant_id", "run_id", "ts"],
    )
    op.create_index(
        "ix_trace_events_tenant_agent_ts",
        "agent_trace_events",
        ["tenant_id", "agent_id", "ts"],
    )


def downgrade() -> None:
    op.drop_index("ix_trace_events_tenant_agent_ts", table_name="agent_trace_events")
    op.drop_index("ix_trace_events_tenant_run_ts", table_name="agent_trace_events")
    op.drop_index("ix_trace_events_tenant_room_ts", table_name="agent_trace_events")
    op.drop_index("ix_agent_trace_events_ts", table_name="agent_trace_events")
    op.drop_index("ix_agent_trace_events_run_id", table_name="agent_trace_events")
    op.drop_index("ix_agent_trace_events_tenant_id", table_name="agent_trace_events")
    op.drop_table("agent_trace_events")

    op.drop_index("ix_agent_runs_tenant_agent_started", table_name="agent_runs")
    op.drop_index("ix_agent_runs_tenant_room_started", table_name="agent_runs")
    op.drop_index("ix_agent_runs_agent_id", table_name="agent_runs")
    op.drop_index("ix_agent_runs_tenant_id", table_name="agent_runs")
    op.drop_table("agent_runs")
