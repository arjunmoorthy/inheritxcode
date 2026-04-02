"""Add oncologist staff relation to fax_patients

Revision ID: 20260401_0018
Revises: 20260323_0017
Create Date: 2026-04-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260401_0018"
down_revision: Union[str, None] = "20260323_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "fax_patients",
        sa.Column("oncologist_staff_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_fax_patients_oncologist_staff_id",
        "fax_patients",
        ["oncologist_staff_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_fax_patients_oncologist_staff_id_staff",
        "fax_patients",
        "staff",
        ["oncologist_staff_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_fax_patients_oncologist_staff_id_staff",
        "fax_patients",
        type_="foreignkey",
    )
    op.drop_index("ix_fax_patients_oncologist_staff_id", table_name="fax_patients")
    op.drop_column("fax_patients", "oncologist_staff_id")
