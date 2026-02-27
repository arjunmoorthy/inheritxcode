"""Add chat_patients table and link conversations to it (links to fax_patient via same UUID).

chat_patients holds the UUID that identifies a patient allowed to use chat.
For fax patients, this UUID = doctor-api users.uuid (same person as fax_patients.user_id).
Creates the table, backfills from existing conversations, then adds FK.

Revision ID: 20260226_0003
Revises: 20260226_0002
Create Date: 2026-02-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260226_0003"
down_revision = "20260226_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create chat_patients (registry of patients who can use chat; uuid = doctor-api user.uuid for fax)
    op.create_table(
        "chat_patients",
        sa.Column("uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(50), nullable=True, server_default="fax"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("uuid"),
    )
    # 2. Backfill: every distinct patient_uuid in conversations must exist in chat_patients
    op.execute("""
        INSERT INTO chat_patients (uuid, source)
        SELECT DISTINCT patient_uuid, 'fax'
        FROM conversations
        ON CONFLICT (uuid) DO NOTHING
    """)

    # 3. Add FK so conversations.patient_uuid references chat_patients (the link to fax_patient)
    op.create_foreign_key(
        "conversations_patient_uuid_fkey",
        "conversations",
        "chat_patients",
        ["patient_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "conversations_patient_uuid_fkey",
        "conversations",
        type_="foreignkey",
    )
    op.drop_table("chat_patients")
