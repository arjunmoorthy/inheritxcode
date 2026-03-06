"""Replace patient_uuid with patient_id FK on physician_patients

Revision ID: 20260305_0015
Revises: 20260227_0014
Create Date: 2026-03-05

This migration replaces the UUID-based patient reference on
`physician_patients` with an integer FK `patient_id` referencing
`fax_patients.id`.

Only touches the `physician_patients` table: adds `patient_id` FK/index,
drops the `patient_uuid` column and related indexes/unique constraint,
and creates a new unique constraint on (physician_id, patient_id).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260305_0015"
down_revision: Union[str, None] = "20260227_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Add patient_id column (nullable initially)
    op.add_column(
        "physician_patients",
        sa.Column("patient_id", sa.Integer(), nullable=True),
    )

    # 2) Create FK -> fax_patients.id and index
    op.create_foreign_key(
        "physician_patients_patient_id_fkey",
        "physician_patients",
        "fax_patients",
        ["patient_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_physician_patients_patient_id", "physician_patients", ["patient_id"])

    # 3) Drop old unique constraint and index on patient_uuid, then drop the column
    #    (existing data in patient_uuid will be lost — ensure backups if needed)
    op.drop_constraint("uq_physician_patient", "physician_patients", type_="unique")
    op.drop_index("ix_physician_patients_patient_uuid", table_name="physician_patients")
    op.drop_column("physician_patients", "patient_uuid")

    # 4) Create new unique constraint on physician_id + patient_id
    op.create_unique_constraint(
        "uq_physician_patient",
        "physician_patients",
        ["physician_id", "patient_id"],
    )


def downgrade() -> None:
    # Reverse: drop new unique constraint, drop patient_id FK/index/column,
    # then re-add patient_uuid (UUID) column, index and unique constraint.
    op.drop_constraint("uq_physician_patient", "physician_patients", type_="unique")

    op.drop_index("ix_physician_patients_patient_id", table_name="physician_patients")
    op.drop_constraint("physician_patients_patient_id_fkey", "physician_patients", type_="foreignkey")
    op.drop_column("physician_patients", "patient_id")

    # Re-create patient_uuid column (note: making non-nullable may fail if rows exist).
    op.add_column(
        "physician_patients",
        sa.Column("patient_uuid", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_index("ix_physician_patients_patient_uuid", "physician_patients", ["patient_uuid"])
    op.create_unique_constraint(
        "uq_physician_patient",
        "physician_patients",
        ["physician_id", "patient_uuid"],
    )
