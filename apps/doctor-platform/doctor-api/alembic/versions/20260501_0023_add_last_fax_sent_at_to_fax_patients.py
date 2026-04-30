"""Add last_fax_sent_at to fax_patients

Revision ID: 20260501_0023
Revises: 20260428_0022
Create Date: 2026-05-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260501_0023"
down_revision: Union[str, None] = "20260428_0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "fax_patients",
        sa.Column("last_fax_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fax_patients", "last_fax_sent_at")
