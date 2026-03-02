"""Add physician_id to staff (nurse assigned to doctor) - Doctor API

Revision ID: 20260227_0012
Revises: 20260227_0011
Create Date: 2026-02-27

- staff: add physician_id column (FK to staff.id, SET NULL on delete)
  Used when role is nurse: links nurse to the physician they belong to.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260227_0012"
down_revision: Union[str, None] = "20260227_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "staff",
        sa.Column(
            "physician_id",
            sa.Integer(),
            nullable=True,
            comment="For nurses: the physician this nurse is assigned to",
        ),
    )
    op.create_foreign_key(
        "staff_physician_id_fkey",
        "staff",
        "staff",
        ["physician_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_staff_physician_id", "staff", ["physician_id"])


def downgrade() -> None:
    op.drop_index("ix_staff_physician_id", table_name="staff")
    op.drop_constraint("staff_physician_id_fkey", "staff", type_="foreignkey")
    op.drop_column("staff", "physician_id")
