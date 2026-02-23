"""add ocr_confidence to fax_records

Revision ID: 9b9829825d96
Revises: 20260209_0002
Create Date: 2026-02-16 10:27:18.775088+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b9829825d96'
down_revision: Union[str, None] = '20260209_0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "fax_records",
        sa.Column("ocr_confidence", sa.Float(), nullable=True)
    )

def downgrade():
    op.drop_column("fax_records", "ocr_confidence")

