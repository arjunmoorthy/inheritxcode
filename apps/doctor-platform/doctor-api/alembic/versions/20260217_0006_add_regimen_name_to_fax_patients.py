"""Add regimen_name to fax_patients - Doctor API

Revision ID: 20260217_0006
Revises: 20260217_0005
Create Date: 2026-02-17

Only adds:
- regimen_name column to fax_patients table

No other tables are modified.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260217_0006"
down_revision: Union[str, None] = "20260217_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "fax_patients",
        sa.Column("regimen_name", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fax_patients", "regimen_name")
