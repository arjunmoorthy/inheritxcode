"""Drop FK from conversations.patient_uuid to patients.uuid so fax patients can use chat.

Fax patients (from doctor-api) do not have a row in patient-api's patients table.
Dropping this constraint allows any UUID (e.g. doctor-api user.uuid) to have conversations.

Revision ID: 20260226_0002
Revises: 20260206_0001
Create Date: 2026-02-26

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '20260226_0002'
down_revision = '20260206_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the foreign key so conversations can reference any patient_uuid
    # (e.g. doctor-api user.uuid for fax patients who don't exist in patients table)
    op.drop_constraint(
        'conversations_patient_uuid_fkey',
        'conversations',
        type_='foreignkey',
    )


def downgrade() -> None:
    # Re-adding the FK would require all conversation patient_uuids to exist in patients.
    # If you have fax-patient conversations, re-adding will fail. Skip re-add by default.
    op.create_foreign_key(
        'conversations_patient_uuid_fkey',
        'conversations',
        'patients',
        ['patient_uuid'],
        ['uuid'],
        ondelete='CASCADE',
    )
