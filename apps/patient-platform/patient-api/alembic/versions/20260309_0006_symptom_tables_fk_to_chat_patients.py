"""Point symptom_details and symptom_time_series patient_id to chat_patients.uuid

Revision ID: 20260309_0006
Revises: 20260309_0005
Create Date: 2026-03-09

Chat/fax patients are identified by chat_patients.uuid (same as doctor-api User.uuid).
They may not have a row in the patients table, so the previous FK to patients.uuid
caused inserts to fail. This migration switches the FK to chat_patients.uuid so
symptom analytics are stored correctly when a conversation completes.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260309_0006"
down_revision: Union[str, None] = "20260309_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # symptom_details: drop FK to patients.uuid, add FK to chat_patients.uuid
    op.drop_constraint(
        "symptom_details_patient_id_fkey",
        "symptom_details",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "symptom_details_patient_id_fkey",
        "symptom_details",
        "chat_patients",
        ["patient_id"],
        ["uuid"],
        ondelete="CASCADE",
    )

    # symptom_time_series: drop FK to patients.uuid, add FK to chat_patients.uuid
    op.drop_constraint(
        "symptom_time_series_patient_id_fkey",
        "symptom_time_series",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "symptom_time_series_patient_id_fkey",
        "symptom_time_series",
        "chat_patients",
        ["patient_id"],
        ["uuid"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # Revert symptom_time_series to patients.uuid
    op.drop_constraint(
        "symptom_time_series_patient_id_fkey",
        "symptom_time_series",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "symptom_time_series_patient_id_fkey",
        "symptom_time_series",
        "patients",
        ["patient_id"],
        ["uuid"],
        ondelete="CASCADE",
    )

    # Revert symptom_details to patients.uuid
    op.drop_constraint(
        "symptom_details_patient_id_fkey",
        "symptom_details",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "symptom_details_patient_id_fkey",
        "symptom_details",
        "patients",
        ["patient_id"],
        ["uuid"],
        ondelete="CASCADE",
    )
