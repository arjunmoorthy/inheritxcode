"""Add password_hash and is_first_login to fax_patients - Doctor API

Revision ID: 20260217_0007
Revises: 20260217_0006
Create Date: 2026-02-17

Only adds:
- password_hash column to fax_patients
- is_first_login column to fax_patients

No other tables are modified.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260217_0007"
down_revision: Union[str, None] = "20260217_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "fax_patients",
        sa.Column("password_hash", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "fax_patients",
        sa.Column("is_first_login", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("fax_patients", "is_first_login")
    op.drop_column("fax_patients", "password_hash")
