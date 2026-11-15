from collections.abc import Iterator

from sqlalchemy import Engine
from sqlmodel import Session, create_engine

from app.core import supabase
from app.core.config import get_settings

_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(
            get_settings().database_url,
            pool_pre_ping=True,
            # Server-side prepared statements break behind a transaction pooler (Supabase :6543, PgBouncer).
            connect_args={"prepare_threshold": None},
        )
    return _engine


def get_session() -> Iterator[Session]:
    """One session per request. Realtime signals queued in `session.info["signals"]` go out once the work is done."""
    with Session(get_engine()) as session:
        try:
            yield session
        finally:
            supabase.broadcast(session.info.pop("signals", []))
