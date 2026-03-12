"""Move severity from symptom_time_series to symptom_details

Revision ID: 20260309_0005
Revises: 20260308_0004
Create Date: 2026-03-09

This migration moves the `severity` column out of the time-series table
into `symptom_details` (one row per symptom per conversation). It copies
existing severity values where present (taking the latest per symptom)
and then drops the column from `symptom_time_series`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = "20260309_0005"
down_revision: Union[str, None] = "20260226_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add severity to symptom_details, copy data, drop from symptom_time_series."""

    # 1) Add column to symptom_details
    op.add_column(
        "symptom_details",
        sa.Column("severity", sa.String(20), nullable=True),
    )

    # 2) Backfill: copy latest non-null severity per (patient_id, conversation_id, symptom_id)
    # Use DISTINCT ON to pick the latest recorded_at for each grouping.
    op.execute("""
    INSERT INTO symptom_details (id, patient_id, conversation_id, symptom_id, severity, created_at)
    SELECT gen_random_uuid(), t.patient_id, t.conversation_id, t.symptom_id, t.severity, now()
    FROM (
        SELECT DISTINCT ON (patient_id, conversation_id, symptom_id)
            patient_id, conversation_id, symptom_id, severity, recorded_at
        FROM symptom_time_series
        WHERE severity IS NOT NULL
        ORDER BY patient_id, conversation_id, symptom_id, recorded_at DESC
    ) t
    WHERE NOT EXISTS (
        SELECT 1 FROM symptom_details sd
        WHERE sd.patient_id = t.patient_id
          AND sd.conversation_id = t.conversation_id
          AND sd.symptom_id = t.symptom_id
    )
    """)

    # 3) Drop severity column from symptom_time_series
    # Some Postgres installations require CASCADE for dependent objects; keep simple drop.
    op.drop_column("symptom_time_series", "severity")


def downgrade() -> None:
    """Re-create severity on symptom_time_series and copy values back, then drop from symptom_details."""

    # 1) Add severity back to symptom_time_series
    op.add_column(
        "symptom_time_series",
        sa.Column("severity", sa.String(20), nullable=True),
    )

    # 2) Propagate severity from symptom_details into existing time-series rows where missing.
    # This will set severity for time-series rows that match by patient_id/conversation_id/symptom_id
    op.execute("""
    UPDATE symptom_time_series sts
    SET severity = sd.severity
    FROM symptom_details sd
    WHERE sts.patient_id = sd.patient_id
      AND sts.conversation_id = sd.conversation_id
      AND sts.symptom_id = sd.symptom_id
      AND (sts.severity IS NULL OR sts.severity = '')
    """)

    # 3) Drop severity from symptom_details
    op.drop_column("symptom_details", "severity")
