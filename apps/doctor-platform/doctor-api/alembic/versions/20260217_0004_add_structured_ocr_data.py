"""add structured_ocr_data to fax_records

Revision ID: 4a6bf86cd469
Revises: 9b9829825d96
Create Date: 2026-02-17 06:59:10.560254+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4a6bf86cd469'
down_revision: Union[str, None] = '9b9829825d96'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "fax_records",
        sa.Column(
            "structured_ocr_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True
        )
    )


def downgrade():
    op.drop_column("fax_records", "structured_ocr_data")
