import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.core import errors, registry  # noqa: F401
from app.core.config import get_settings
from app.core.db import get_engine
from app.core.middleware import PublicApiMiddleware
from app.modules.admin import router as admin_router
from app.modules.aeds import router as aeds_router
from app.modules.alerts import router as alerts_router
from app.modules.auth import router as auth_router
from app.modules.auth import service as auth_service
from app.modules.capabilities import router as capabilities_router
from app.modules.districts import router as districts_router
from app.modules.facilities import catalog, road_distance
from app.modules.facilities import router as facilities_router
from app.modules.guides import router as guides_router
from app.modules.guides.service import catalog as guides_catalog
from app.modules.health import router as health_router
from app.modules.support import realtime as support_realtime
from app.modules.support import router as support_router
from app.modules.support.service import support
from app.voice import router as voice_router

# Request URLs carry user coordinates; keep them out of logs.
logging.getLogger("uvicorn.access").disabled = True
log = logging.getLogger("app")


def _warm() -> None:
    """Data is seeded by `python -m app.seeds`; at startup only load DB content into the in-memory caches."""
    with Session(get_engine()) as session:
        guides_catalog.load_from_db(session)
        catalog.all_facilities(session)  # warm public catalogue; no location-dependent work


def _purge_auth() -> None:
    if get_settings().auth_configured:
        with Session(get_engine()) as session:
            auth_service.purge(session)


async def _purge_loop() -> None:
    ticks = 0
    while True:
        await asyncio.sleep(30)
        support.purge()
        ticks += 1
        if ticks % 120 == 0:  # hourly: expired refresh tokens and email codes
            try:
                await asyncio.to_thread(_purge_auth)
            except Exception:
                log.exception("Auth purge failed.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    road_distance.load_road_service()
    await asyncio.to_thread(_warm)
    task = asyncio.create_task(_purge_loop())
    yield
    task.cancel()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Esmarch API", version="0.2.0", lifespan=lifespan)
    errors.install(app)
    # Added first = inner. CORS is added last so it is outermost and also decorates 426/429 responses.
    app.add_middleware(
        PublicApiMiddleware,
        require_https=s.require_https,
        requests=s.public_api_rate_limit_requests,
        window_seconds=s.public_api_rate_limit_window_seconds,
        max_clients=s.public_api_max_clients,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept", "Authorization", "X-Admin-Token"],
        expose_headers=["Retry-After"],
        max_age=3600,
    )
    for module in (
        health_router,
        auth_router,
        facilities_router,
        districts_router,
        guides_router,
        aeds_router,
        support_router,
        admin_router,
        capabilities_router,
        alerts_router,
        voice_router,
    ):
        app.include_router(module.router)
    app.include_router(support_router.me)  # /api/support/me*, ws-ticket: signed-in responders
    app.include_router(support_realtime.router)  # /api/support/ws
    return app


app = create_app()
