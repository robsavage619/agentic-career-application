"""savedjob: dismiss_reason + decided_at for the application decision log

Revision ID: a1b2c3d4e5f6
Revises: 122fa6101515
Create Date: 2026-05-02 19:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "122fa6101515"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("savedjob") as batch:
        batch.add_column(sa.Column("dismiss_reason", sa.String(), nullable=False, server_default=""))
        batch.add_column(sa.Column("decided_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("savedjob") as batch:
        batch.drop_column("decided_at")
        batch.drop_column("dismiss_reason")
