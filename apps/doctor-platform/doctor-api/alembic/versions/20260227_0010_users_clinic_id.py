"""Add clinic_id to users - Doctor API

Revision ID: 20260227_0010
Revises: 20260224_0009
Create Date: 2026-02-27

- users: add clinic_id column (FK to clinics.id, RESTRICT on delete)

No other tables modified.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260227_0010"
down_revision: Union[str, None] = "20260224_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "clinic_id",
            sa.Integer(),
            nullable=True,
            comment="Clinic this user belongs to",
        ),
    )
    op.create_foreign_key(
        "users_clinic_id_fkey",
        "users",
        "clinics",
        ["clinic_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_users_clinic_id", "users", ["clinic_id"])


def downgrade() -> None:
    op.drop_index("ix_users_clinic_id", table_name="users")
    op.drop_constraint("users_clinic_id_fkey", "users", type_="foreignkey")
    op.drop_column("users", "clinic_id")
