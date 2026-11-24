"""Initial migration – create transcriptions table with pg_trgm index.

Revision ID: 0001_initial
Revises:
Create Date: 2026-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pg_trgm for fuzzy text search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "transcriptions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=False, server_default=""),
        sa.Column("language", sa.String(50), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index("ix_transcriptions_title", "transcriptions", ["title"])
    op.create_index("ix_transcriptions_created_at", "transcriptions", ["created_at"])
    op.execute(
        "CREATE INDEX ix_transcriptions_title_trgm ON transcriptions "
        "USING gin (title gin_trgm_ops)"
    )


def downgrade() -> None:
    op.drop_index("ix_transcriptions_title_trgm", "transcriptions")
    op.drop_index("ix_transcriptions_created_at", "transcriptions")
    op.drop_index("ix_transcriptions_title", "transcriptions")
    op.drop_table("transcriptions")
