"""linkedin metrics + connections tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-02

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "linkedinsnapshot",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profile.id"), nullable=False),
        sa.Column("follower_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("connection_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("profile_views_7d", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("search_appearances_7d", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("captured_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_linkedinsnapshot_profile_id", "linkedinsnapshot", ["profile_id"])
    op.create_index("ix_linkedinsnapshot_captured_at", "linkedinsnapshot", ["captured_at"])

    op.create_table(
        "linkedinconnection",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profile.id"), nullable=False),
        sa.Column("urn", sa.String(), nullable=False),
        sa.Column("public_id", sa.String(), nullable=False, server_default=""),
        sa.Column("full_name", sa.String(), nullable=False, server_default=""),
        sa.Column("headline", sa.String(), nullable=False, server_default=""),
        sa.Column("current_company", sa.String(), nullable=False, server_default=""),
        sa.Column("current_title", sa.String(), nullable=False, server_default=""),
        sa.Column("location", sa.String(), nullable=False, server_default=""),
        sa.Column("industry", sa.String(), nullable=False, server_default=""),
        sa.Column("picture_url", sa.String(), nullable=False, server_default=""),
        sa.Column("connected_at", sa.DateTime(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_linkedinconnection_profile_id", "linkedinconnection", ["profile_id"])
    op.create_index("ix_linkedinconnection_urn", "linkedinconnection", ["urn"])


def downgrade() -> None:
    op.drop_table("linkedinconnection")
    op.drop_table("linkedinsnapshot")
