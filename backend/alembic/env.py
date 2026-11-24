"""Alembic environment script – async-aware."""
import os
import pathlib
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config

# ── Auto-load .env from backend/ or project root ──────────────────────────────
def _load_dotenv(path: pathlib.Path) -> None:
    """Minimal .env loader – no external dependency required."""
    if not path.exists():
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:   # don't override shell env
                os.environ[key] = val

_here = pathlib.Path(__file__).parent.parent  # backend/
_load_dotenv(_here / ".env")            # backend/.env
_load_dotenv(_here.parent / ".env")     # project root .env

# Inject env vars into the connection URL
section = config.config_ini_section
config.set_section_option(section, "POSTGRES_USER", os.environ.get("POSTGRES_USER", "speech_user"))
config.set_section_option(section, "POSTGRES_PASSWORD", os.environ.get("POSTGRES_PASSWORD", "speech_password"))
config.set_section_option(section, "POSTGRES_HOST", os.environ.get("POSTGRES_HOST", "localhost"))
config.set_section_option(section, "POSTGRES_PORT", os.environ.get("POSTGRES_PORT", "5432"))
config.set_section_option(section, "POSTGRES_DB", os.environ.get("POSTGRES_DB", "speech_db"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import Base so Alembic discovers all models
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from app.db.database import Base
from app.models import transcription  # noqa: F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
