"""Add clinical_narrative_summary to conversations.

Revision ID: 20260329_0010
Revises: 20260326_0009
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa


revision = "20260329_0010"
down_revision = "20260326_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("clinical_narrative_summary", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversations", "clinical_narrative_summary")
