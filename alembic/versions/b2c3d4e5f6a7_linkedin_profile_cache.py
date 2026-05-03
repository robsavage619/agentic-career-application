"""linkedin profile cache columns

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-02

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("linkedintoken") as batch:
        batch.add_column(sa.Column("li_name", sa.String(), nullable=False, server_default=""))
        batch.add_column(sa.Column("li_headline", sa.String(), nullable=False, server_default=""))
        batch.add_column(sa.Column("li_picture_url", sa.String(), nullable=False, server_default=""))
        batch.add_column(sa.Column("li_vanity_name", sa.String(), nullable=False, server_default=""))


def downgrade() -> None:
    with op.batch_alter_table("linkedintoken") as batch:
        batch.drop_column("li_vanity_name")
        batch.drop_column("li_picture_url")
        batch.drop_column("li_headline")
        batch.drop_column("li_name")
