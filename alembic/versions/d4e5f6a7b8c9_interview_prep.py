"""interview prep table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interviewprep",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profile.id"), nullable=False),
        sa.Column("pipeline_card_id", sa.Integer(), sa.ForeignKey("pipelinecard.id"), nullable=False),
        sa.Column("job_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("evidence_json", sa.Text(), nullable=False, server_default=""),
        sa.Column("vault_path", sa.String(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_interviewprep_profile_id", "interviewprep", ["profile_id"])
    op.create_index("ix_interviewprep_pipeline_card_id", "interviewprep", ["pipeline_card_id"])


def downgrade() -> None:
    op.drop_table("interviewprep")
