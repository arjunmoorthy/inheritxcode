"""Add diagnosis to fax_patients

Revision ID: 20260323_0017
Revises: 20260322_0016
Create Date: 2026-03-23

Adds an optional `diagnosis` text field to fax_patients for storing extracted/entered diagnosis notes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260323_0017"
down_revision: Union[str, None] = "20260322_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("fax_patients", sa.Column("diagnosis", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("fax_patients", "diagnosis")
