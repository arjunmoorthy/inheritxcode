"""Add fax_patients table and fax_records.patient_id FK - Doctor API

Revision ID: 20260217_0005
Revises: 4a6bf86cd469
Create Date: 2026-02-17

Only adds:
- New table fax_patients (Patient model)
- Column fax_records.patient_id (FK to fax_patients.id)

No other tables or columns are modified.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260217_0005"
down_revision: Union[str, None] = "4a6bf86cd469"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create fax_patients table (must exist before fax_records.patient_id FK)
    op.create_table(
        "fax_patients",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("mrn", sa.String(100), nullable=True),
        sa.Column("first_name", sa.String(255), nullable=True),
        sa.Column("last_name", sa.String(255), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("phone_number", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("bmi", sa.String(20), nullable=True),
        sa.Column("cancer_type", sa.String(255), nullable=True),
        sa.Column("oncologist", sa.String(255), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("plan_name", sa.Text(), nullable=True),
        sa.Column("past_medical_history", sa.Text(), nullable=True),
        sa.Column("past_surgical_history", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fax_patients_id", "fax_patients", ["id"])
    op.create_index("ix_fax_patients_mrn", "fax_patients", ["mrn"], unique=True)
    op.create_index("ix_fax_patients_phone_number", "fax_patients", ["phone_number"])
    op.create_index("ix_fax_patients_email", "fax_patients", ["email"])

    # 2. Add patient_id to fax_records (FK to fax_patients.id)
    op.add_column(
        "fax_records",
        sa.Column("patient_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fax_records_patient_id_fkey",
        "fax_records",
        "fax_patients",
        ["patient_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_fax_records_patient_id", "fax_records", ["patient_id"])


def downgrade() -> None:
    op.drop_index("ix_fax_records_patient_id", table_name="fax_records")
    op.drop_constraint("fax_records_patient_id_fkey", "fax_records", type_="foreignkey")
    op.drop_column("fax_records", "patient_id")

    op.drop_index("ix_fax_patients_email", table_name="fax_patients")
    op.drop_index("ix_fax_patients_phone_number", table_name="fax_patients")
    op.drop_index("ix_fax_patients_mrn", table_name="fax_patients")
    op.drop_index("ix_fax_patients_id", table_name="fax_patients")
    op.drop_table("fax_patients")
