import os
import urllib.parse

import psycopg
import pytest

BASE = os.environ.get("DATABASE_URL", "postgresql+psycopg://esmarch:esmarch@localhost:5432/esmarch")
TEST_DB = "esmarch_test"
ADMIN = "phase-api-test-administrator-token-32chars"

parsed = urllib.parse.urlparse(BASE.replace("+psycopg", ""))
os.environ.update(
    DATABASE_URL=BASE.rsplit("/", 1)[0] + f"/{TEST_DB}",
    FACILITIES_DATA_FILE="",
    GUIDES_DATA_FILE="",
    AEDS_DATA_FILE="",
    SUPPORT_ADMIN_TOKEN=ADMIN,
    CORS_ORIGINS="https://esmarch.example,http://localhost:3000",
    PUBLIC_API_RATE_LIMIT_REQUESTS="100000",
    OPENAI_API_KEY="",  # tests must not depend on the developer's .env
    SUPABASE_URL="https://test-project.supabase.co",
)


def _admin_dsn() -> str:
    return f"postgresql://{parsed.username}:{parsed.password}@{parsed.hostname}:{parsed.port or 5432}/postgres"


@pytest.fixture(scope="session", autouse=True)
def database():
    with psycopg.connect(_admin_dsn(), autocommit=True) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
        conn.execute(f"CREATE DATABASE {TEST_DB}")
    from sqlmodel import SQLModel

    from app.core import registry  # noqa: F401
    from app.core.db import get_engine

    SQLModel.metadata.create_all(get_engine())
    yield
    get_engine().dispose()


@pytest.fixture
def session():
    from sqlmodel import Session

    from app.core.db import get_engine

    with Session(get_engine()) as s:
        yield s


@pytest.fixture(autouse=True)
def reset_state(database):
    from sqlalchemy import text

    from app.core import clock
    from app.core.db import get_engine
    from app.modules.facilities import catalog
    from app.modules.guides.service import catalog as guides

    clock.reset()
    with get_engine().begin() as c:
        c.execute(
            text(
                "TRUNCATE facility_phones, facilities, aeds, verified_responders, sos_alert, "
                "support_presence, support_requests, voice_calls, accounts CASCADE"
            )
        )
    catalog.invalidate()
    guides._guides = {}


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(autouse=True)
def supabase_keys(monkeypatch):
    """Tests sign their own ES256 tokens; the backend checks them against this key instead of the project JWKS."""
    from app.modules.auth import security
    from tests.auth_tokens import PUBLIC_KEY

    monkeypatch.setattr(security, "signing_key", lambda token: PUBLIC_KEY)
