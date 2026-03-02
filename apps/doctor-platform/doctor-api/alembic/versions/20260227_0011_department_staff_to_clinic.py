"""Move department from staff to clinic - Doctor API

Revision ID: 20260227_0011
Revises: 20260227_0010
Create Date: 2026-02-27

- clinics: add department column (String 100, nullable)
- staff: drop department column

No data migration: department values on staff are not copied to clinic
(one staff can have multiple clinics; department is now per-clinic).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260227_0011"
down_revision: Union[str, None] = "20260227_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clinics",
        sa.Column(
            "department",
            sa.String(100),
            nullable=True,
            comment="Department within the clinic",
        ),
    )
    op.drop_column("staff", "department")


def downgrade() -> None:
    op.add_column(
        "staff",
        sa.Column(
            "department",
            sa.String(100),
            nullable=True,
            comment="Department within clinic",
        ),
    )
    op.drop_column("clinics", "department")
