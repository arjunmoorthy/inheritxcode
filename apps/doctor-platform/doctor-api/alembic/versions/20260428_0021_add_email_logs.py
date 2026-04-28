"""Add email_logs

Revision ID: 20260428_0021
Revises: 20260403_0020
Create Date: 2026-04-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260428_0021"
down_revision: Union[str, None] = "20260403_0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("recipient_email", sa.String(255), nullable=False),
        sa.Column("email_type", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("provider_message_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index('ix_email_logs_recipient_email', 'email_logs', ['recipient_email'])
    op.create_index('ix_email_logs_email_type', 'email_logs', ['email_type'])
    op.create_index('ix_email_logs_status', 'email_logs', ['status'])
    op.create_index('ix_email_logs_created_at', 'email_logs', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_email_logs_created_at', table_name='email_logs')
    op.drop_index('ix_email_logs_status', table_name='email_logs')
    op.drop_index('ix_email_logs_email_type', table_name='email_logs')
    op.drop_index('ix_email_logs_recipient_email', table_name='email_logs')
    op.drop_table('email_logs')
