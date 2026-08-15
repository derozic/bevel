"""Folksonomy taggings for agents, people, and tracks.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "taggings",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("slug", sa.String(length=32), nullable=False),
        sa.Column("entity_kind", sa.String(length=16), nullable=False),
        sa.Column("entity_id", sa.String(length=128), nullable=False),
        sa.Column("tagged_by", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_taggings_tenant_slug", "taggings", ["tenant_id", "slug"])
    op.create_index(
        "ix_taggings_tenant_entity",
        "taggings",
        ["tenant_id", "entity_kind", "entity_id"],
    )
    op.create_unique_constraint(
        "uq_taggings_tenant_slug_kind_id",
        "taggings",
        ["tenant_id", "slug", "entity_kind", "entity_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_taggings_tenant_slug_kind_id", "taggings", type_="unique")
    op.drop_index("ix_taggings_tenant_entity", table_name="taggings")
    op.drop_index("ix_taggings_tenant_slug", table_name="taggings")
    op.drop_table("taggings")
