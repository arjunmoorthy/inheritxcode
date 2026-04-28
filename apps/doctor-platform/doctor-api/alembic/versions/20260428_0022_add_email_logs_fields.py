"""Add email_logs fields and change status to enum

Revision ID: 20260428_0022
Revises: 20260428_0021
Create Date: 2026-04-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260428_0022"
down_revision: Union[str, None] = "20260428_0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create new enum type for status
    emailstatus = postgresql.ENUM('PENDING', 'SUCCESS', 'FAILED', name='emailstatus')
    emailstatus.create(op.get_bind(), checkfirst=True)

    # Add new columns
    op.add_column('email_logs', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_index('ix_email_logs_user_id', 'email_logs', ['user_id'])

    op.add_column('email_logs', sa.Column('request_id', sa.String(length=100), nullable=True))
    op.create_index('ix_email_logs_request_id', 'email_logs', ['request_id'])

    op.add_column('email_logs', sa.Column('metadata', sa.JSON(), nullable=True))

    # Alter status column from String(50) to the new enum using explicit cast
    # PostgreSQL requires a USING clause to convert existing text values to enum
    op.execute(
        "ALTER TABLE email_logs ALTER COLUMN status TYPE emailstatus USING status::emailstatus"
    )


def downgrade() -> None:
    # Revert status column back to String(50) using explicit cast to text
    emailstatus = postgresql.ENUM('PENDING', 'SUCCESS', 'FAILED', name='emailstatus')
    op.execute(
        "ALTER TABLE email_logs ALTER COLUMN status TYPE VARCHAR(50) USING status::text"
    )

    # Drop added columns and indexes
    op.drop_index('ix_email_logs_request_id', table_name='email_logs')
    op.drop_index('ix_email_logs_user_id', table_name='email_logs')
    op.drop_column('email_logs', 'request_id')
    op.drop_column('email_logs', 'user_id')
    op.drop_column('email_logs', 'metadata')

    # Drop enum type
    emailstatus.drop(op.get_bind(), checkfirst=True)
