"""Add patient_narrative_summary to conversations.

Revision ID: 20260406_0011
Revises: 20260329_0010
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20260406_0011"
down_revision = "20260329_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("patient_narrative_summary", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversations", "patient_narrative_summary")
