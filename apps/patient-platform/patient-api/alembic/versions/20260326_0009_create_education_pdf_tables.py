"""Create education_pdfs, education_handbooks, and education_regimen_pdfs tables

These tables store metadata for the S3-hosted education PDF catalog,
separate from the clinician-approved education_documents table.

Revision ID: 20260326_0009
Revises: 20260325_0008
Create Date: 2026-03-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260326_0009"
down_revision: Union[str, None] = "20260325_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "education_pdfs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("symptom_code", sa.String(20), nullable=False),
        sa.Column("symptom_name", sa.String(100), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("source", sa.String(100)),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("summary", sa.Text),
        sa.Column("keywords", postgresql.JSONB, server_default="[]"),
        sa.Column("display_order", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_education_pdfs_symptom_code", "education_pdfs", ["symptom_code"])
    op.create_index("ix_education_pdfs_is_active", "education_pdfs", ["is_active"])

    op.create_table(
        "education_handbooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("handbook_type", sa.String(50), server_default="general"),
        sa.Column("display_order", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_education_handbooks_is_active", "education_handbooks", ["is_active"])

    op.create_table(
        "education_regimen_pdfs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("regimen_code", sa.String(20), nullable=False),
        sa.Column("regimen_name", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("source", sa.String(100)),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("document_type", sa.String(50), server_default="overview"),
        sa.Column("drug_name", sa.String(255)),
        sa.Column("display_order", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_education_regimen_pdfs_regimen_code", "education_regimen_pdfs", ["regimen_code"])
    op.create_index("ix_education_regimen_pdfs_is_active", "education_regimen_pdfs", ["is_active"])


def downgrade() -> None:
    op.drop_table("education_regimen_pdfs")
    op.drop_table("education_handbooks")
    op.drop_table("education_pdfs")
