"""Vercel build step: bring the database schema and seed data up to date before a deployment goes live.

Runs from `[tool.vercel.scripts] build` in pyproject.toml, after dependencies are installed.
Usage: python -m app.deploy

- Production builds only. Preview builds skip it so an unmerged migration can never touch the production database
  (set MIGRATE_ON_PREVIEW=true when previews have a database of their own).
- Prefers DATABASE_URL_UNPOOLED, a direct or session-pooler connection, because DDL should not go through a
  transaction pooler. Falls back to DATABASE_URL.
- A failed migration fails the build, so code that needs the new schema is never deployed without it.
- A Postgres advisory lock keeps two builds that finish together from migrating at the same time.
"""

import logging
import os
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from app.core.config import normalize_database_url

log = logging.getLogger("deploy")
ROOT = Path(__file__).resolve().parent.parent
LOCK_ID = 7_310_442_118  # any constant shared by every build of this project


def _should_run() -> bool:
    env = os.environ.get("VERCEL_ENV")
    if env is None or env == "production":
        return True  # outside Vercel (manual run) or a production build
    return os.environ.get("MIGRATE_ON_PREVIEW", "").lower() == "true"


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")
    if not _should_run():
        log.info("VERCEL_ENV=%s: skipping migrations (production builds only).", os.environ.get("VERCEL_ENV"))
        return 0

    url = os.environ.get("DATABASE_URL_UNPOOLED") or os.environ.get("DATABASE_URL")
    if not url:
        log.warning("DATABASE_URL is not set: skipping migrations. The API cannot serve requests until it is.")
        return 0
    url = normalize_database_url(url)
    os.environ["DATABASE_URL"] = url  # alembic env.py and the seeders read it through Settings

    engine = create_engine(url, poolclass=NullPool)
    with engine.connect() as lock:
        lock.execute(text("SELECT pg_advisory_lock(:id)"), {"id": LOCK_ID})
        try:
            cfg = Config(str(ROOT / "alembic.ini"))
            cfg.set_main_option("script_location", str(ROOT / "migrations"))
            log.info("alembic upgrade head")
            command.upgrade(cfg, "head")

            from sqlmodel import Session

            from app.seeds.run import run_all

            os.chdir(ROOT)  # seed file paths in Settings are relative to BackEnd/
            with Session(engine) as session:
                log.info("Seeded: %s", run_all(session) or "nothing (no seed files found)")
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})
            lock.commit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
