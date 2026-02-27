"""Add role to users and user_id to fax_patients - Doctor API

Revision ID: 20260224_0008
Revises: 20260217_0007
Create Date: 2026-02-24

- users: add role column (staff, physician, admin, patient)
- fax_patients: add user_id FK to users (links patient profile to auth)

No other tables modified.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260224_0008"
down_revision: Union[str, None] = "20260217_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(50), nullable=False, server_default="staff"),
    )
    op.create_index("ix_users_role", "users", ["role"])

    op.add_column(
        "fax_patients",
        sa.Column("user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fax_patients_user_id_fkey",
        "fax_patients",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_fax_patients_user_id", "fax_patients", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_fax_patients_user_id", table_name="fax_patients")
    op.drop_constraint("fax_patients_user_id_fkey", "fax_patients", type_="foreignkey")
    op.drop_column("fax_patients", "user_id")

    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "role")
