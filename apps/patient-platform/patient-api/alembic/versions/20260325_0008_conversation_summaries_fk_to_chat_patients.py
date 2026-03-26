"""Re-point conversation_summaries.patient_uuid FK from patients -> chat_patients

Revision ID: 20260325_0008
Revises: 20260323_0007
Create Date: 2026-03-25
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260325_0008"
down_revision: Union[str, None] = "20260323_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfill any chat_patients rows for UUIDs referenced by conversation_summaries
    op.execute(
        """
        INSERT INTO chat_patients (uuid, source, created_at)
        SELECT DISTINCT cs.patient_uuid, 'migrated', now()
        FROM conversation_summaries cs
        WHERE NOT EXISTS (
            SELECT 1 FROM chat_patients cp WHERE cp.uuid = cs.patient_uuid
        );
        """
    )

    # Drop old FK pointing to patients.uuid
    op.drop_constraint(
        "conversation_summaries_patient_uuid_fkey",
        "conversation_summaries",
        type_="foreignkey",
    )

    # Create new FK pointing to chat_patients.uuid
    op.create_foreign_key(
        "conversation_summaries_patient_uuid_fkey",
        "conversation_summaries",
        "chat_patients",
        ["patient_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # Drop FK to chat_patients
    op.drop_constraint(
        "conversation_summaries_patient_uuid_fkey",
        "conversation_summaries",
        type_="foreignkey",
    )

    # Restore original FK to patients
    op.create_foreign_key(
        "conversation_summaries_patient_uuid_fkey",
        "conversation_summaries",
        "patients",
        ["patient_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )
