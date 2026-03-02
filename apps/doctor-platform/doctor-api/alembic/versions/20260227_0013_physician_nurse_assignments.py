"""Add physician_nurse_assignments table - Doctor API

Revision ID: 20260227_0013
Revises: 20260227_0012
Create Date: 2026-02-27

- Creates physician_nurse_assignments (many-to-many between physicians and nurses)
- UniqueConstraint on (physician_id, nurse_id) to avoid duplicate assignments
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260227_0013"
down_revision: Union[str, None] = "20260227_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "physician_nurse_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("physician_id", sa.Integer(), nullable=False),
        sa.Column("nurse_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["physician_id"], ["staff.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["nurse_id"], ["staff.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("physician_id", "nurse_id", name="uq_physician_nurse_assignment"),
    )
    op.create_index("ix_physician_nurse_assignments_physician_id", "physician_nurse_assignments", ["physician_id"])
    op.create_index("ix_physician_nurse_assignments_nurse_id", "physician_nurse_assignments", ["nurse_id"])


def downgrade() -> None:
    op.drop_index("ix_physician_nurse_assignments_nurse_id", table_name="physician_nurse_assignments")
    op.drop_index("ix_physician_nurse_assignments_physician_id", table_name="physician_nurse_assignments")
    op.drop_table("physician_nurse_assignments")
