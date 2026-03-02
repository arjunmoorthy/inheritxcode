"""Drop physician_id from staff - Doctor API

Revision ID: 20260227_0014
Revises: 20260227_0013
Create Date: 2026-02-27

- staff: drop physician_id column (nurse–doctor link now via physician_nurse_assignments only)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260227_0014"
down_revision: Union[str, None] = "20260227_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_staff_physician_id", table_name="staff")
    op.drop_constraint("staff_physician_id_fkey", "staff", type_="foreignkey")
    op.drop_column("staff", "physician_id")


def downgrade() -> None:
    op.add_column(
        "staff",
        sa.Column("physician_id", sa.Integer(), nullable=True),
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
