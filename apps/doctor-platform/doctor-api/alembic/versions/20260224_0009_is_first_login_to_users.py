"""Move is_first_login from fax_patients to users - Doctor API

Revision ID: 20260224_0009
Revises: 20260224_0008
Create Date: 2026-02-24

- users: add is_first_login column (default False)
- fax_patients: drop is_first_login column

No other tables modified.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260224_0009"
down_revision: Union[str, None] = "20260224_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_first_login", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.drop_column("fax_patients", "is_first_login")


def downgrade() -> None:
    op.add_column(
        "fax_patients",
        sa.Column("is_first_login", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.drop_column("users", "is_first_login")
