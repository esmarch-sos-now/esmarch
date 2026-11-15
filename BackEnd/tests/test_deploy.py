from app import deploy
from app.core.config import normalize_database_url


def test_supabase_style_urls_use_psycopg():
    assert normalize_database_url("postgres://u:p@h:5432/d") == "postgresql+psycopg://u:p@h:5432/d"
    assert normalize_database_url("postgresql://u:p@h:6543/d") == "postgresql+psycopg://u:p@h:6543/d"
    assert normalize_database_url("postgresql+psycopg://u:p@h/d") == "postgresql+psycopg://u:p@h/d"


def test_migrations_run_on_production_builds_only(monkeypatch):
    monkeypatch.delenv("MIGRATE_ON_PREVIEW", raising=False)
    monkeypatch.setenv("VERCEL_ENV", "production")
    assert deploy._should_run()
    monkeypatch.setenv("VERCEL_ENV", "preview")
    assert not deploy._should_run()
    monkeypatch.setenv("MIGRATE_ON_PREVIEW", "true")
    assert deploy._should_run()


def test_no_database_url_skips_without_failing_the_build(monkeypatch):
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)
    assert deploy.main() == 0
