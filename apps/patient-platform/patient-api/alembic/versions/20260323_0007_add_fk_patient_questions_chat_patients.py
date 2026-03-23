"""Add FK from patient_questions.patient_uuid -> chat_patients.uuid

Revision ID: 20260323_0007
Revises: 20260309_0006
Create Date: 2026-03-23
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260323_0007"
down_revision: Union[str, None] = "20260309_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfill any chat_patients rows for UUIDs referenced by patient_questions
    op.execute(
        """
        INSERT INTO chat_patients (uuid, source, created_at)
        SELECT DISTINCT pq.patient_uuid, 'migrated', now()
        FROM patient_questions pq
        WHERE NOT EXISTS (
            SELECT 1 FROM chat_patients cp WHERE cp.uuid = pq.patient_uuid
        );
        """
    )

    # Create FK constraint to chat_patients.uuid
    op.create_foreign_key(
        "patient_questions_patient_uuid_fkey",
        "patient_questions",
        "chat_patients",
        ["patient_uuid"],
        ["uuid"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    # Drop FK constraint
    op.drop_constraint(
        "patient_questions_patient_uuid_fkey",
        "patient_questions",
        type_="foreignkey",
    )
