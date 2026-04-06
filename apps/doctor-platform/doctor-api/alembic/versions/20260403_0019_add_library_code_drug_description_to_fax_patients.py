"""Add library_code and drug_description to fax_patients

Revision ID: 20260403_0019
Revises: 20260401_0018
Create Date: 2026-04-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260403_0019"
down_revision: Union[str, None] = "20260401_0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "fax_patients",
        sa.Column("library_code", sa.String(255), nullable=True),
    )
    op.add_column(
        "fax_patients",
        sa.Column("drug_description", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fax_patients", "drug_description")
    op.drop_column("fax_patients", "library_code")
