"""Add location, chemotherapy_day, next_chemotherapy_at to fax_patients

Revision ID: 20260322_0016
Revises: 20260305_0015
Create Date: 2026-03-22

Adds optional profile fields used by the doctor portal patient profile editor.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260322_0016"
down_revision: Union[str, None] = "20260305_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("fax_patients", sa.Column("location", sa.String(255), nullable=True))
    op.add_column(
        "fax_patients",
        sa.Column("chemotherapy_day", sa.String(50), nullable=True),
    )
    op.add_column(
        "fax_patients",
        sa.Column("next_chemotherapy_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fax_patients", "next_chemotherapy_at")
    op.drop_column("fax_patients", "chemotherapy_day")
    op.drop_column("fax_patients", "location")
