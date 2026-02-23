"""Users reset_token columns + fax_records table (single 0002) - Doctor API

Revision ID: 20260209_0002
Revises: 20260206_0001
Create Date: 2026-02-09

Single migration that adds:
- users.reset_token and users.reset_token_expires_at
- fax_records table with id as INTEGER auto-increment (SERIAL)

No other tables are modified. Idempotent where possible (skips if columns/table exist).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260209_0002"
down_revision: Union[str, None] = "20260206_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Users: add reset_token and reset_token_expires_at (skip if already exist)
    # -------------------------------------------------------------------------
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE users ADD COLUMN reset_token_expires_at TIMESTAMPTZ;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_reset_token ON users (reset_token)")

    # -------------------------------------------------------------------------
    # 2. fax_records: create with SERIAL id, or fix existing table
    # -------------------------------------------------------------------------
    conn = op.get_bind()
    r = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fax_records')"
    ))
    table_exists = r.scalar()

    if not table_exists:
        # Create table with id as SERIAL (auto-increment integer)
        op.execute("CREATE SEQUENCE fax_records_id_seq")
        op.create_table(
            "fax_records",
            sa.Column("id", sa.Integer(), server_default=sa.text("nextval('fax_records_id_seq')"), nullable=False, autoincrement=True),
            sa.Column("fax_id", sa.String(), nullable=True),
            sa.Column("from_number", sa.String(), nullable=False),
            sa.Column("to_number", sa.String(), nullable=False),
            sa.Column("file_url", sa.Text(), nullable=False),
            sa.Column("stored_file_path", sa.Text(), nullable=True),
            sa.Column("raw_ocr_text", sa.Text(), nullable=True),
            sa.Column("ocr_status", sa.String(), nullable=True, server_default="pending"),
            sa.Column("received_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.execute("ALTER SEQUENCE fax_records_id_seq OWNED BY fax_records.id")
        op.create_index("ix_fax_records_fax_id", "fax_records", ["fax_id"], unique=True)
        op.create_index("ix_fax_records_id", "fax_records", ["id"])
    else:
        # Table exists (from old migration) - ensure id has DEFAULT so INSERT works
        op.execute("CREATE SEQUENCE IF NOT EXISTS fax_records_id_seq")
        # If id is String, convert to Integer with new ids; if Integer, just set default
        r2 = conn.execute(sa.text("""
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'fax_records' AND column_name = 'id'
        """))
        row = r2.fetchone()
        if row and row[0] in ("character varying", "varchar", "text"):
            op.drop_constraint("fax_records_pkey", "fax_records", type_="primary")
            op.drop_index("ix_fax_records_id", table_name="fax_records")
            op.execute("ALTER TABLE fax_records ADD COLUMN id_new INTEGER")
            op.execute("UPDATE fax_records SET id_new = nextval('fax_records_id_seq')")
            op.execute("ALTER TABLE fax_records ALTER COLUMN id_new SET NOT NULL")
            op.execute("ALTER TABLE fax_records DROP COLUMN id")
            op.execute("ALTER TABLE fax_records RENAME COLUMN id_new TO id")
            op.execute("ALTER TABLE fax_records ALTER COLUMN id SET DEFAULT nextval('fax_records_id_seq')")
            op.execute("ALTER SEQUENCE fax_records_id_seq OWNED BY fax_records.id")
            op.create_primary_key("fax_records_pkey", "fax_records", ["id"])
            op.create_index("ix_fax_records_id", "fax_records", ["id"])
        else:
            op.execute("ALTER TABLE fax_records ALTER COLUMN id SET DEFAULT nextval('fax_records_id_seq')")
            op.execute("ALTER SEQUENCE fax_records_id_seq OWNED BY fax_records.id")


def downgrade() -> None:
    op.drop_index("ix_fax_records_id", table_name="fax_records", if_exists=True)
    op.drop_index("ix_fax_records_fax_id", table_name="fax_records", if_exists=True)
    op.drop_table("fax_records")
    op.execute("DROP SEQUENCE IF EXISTS fax_records_id_seq")

    op.drop_index("ix_users_reset_token", table_name="users", if_exists=True)
    op.drop_column("users", "reset_token_expires_at")
    op.drop_column("users", "reset_token")
