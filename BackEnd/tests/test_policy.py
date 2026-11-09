import pytest
from fastapi.testclient import TestClient

from app.core.ratelimit import IpRateLimiter


def _app(monkeypatch, **env):
    from app.core.config import get_settings
    from app.main import create_app

    for k, v in env.items():
        monkeypatch.setenv(k, v)
    get_settings.cache_clear()
    return create_app()


@pytest.fixture(autouse=True)
def _restore_settings():
    yield
    from app.core.config import get_settings

    get_settings.cache_clear()


def test_https_required(monkeypatch):
    app = _app(monkeypatch, REQUIRE_HTTPS="true")
    c = TestClient(app, base_url="http://testserver")
    r = c.get("/api/districts", headers={"X-Forwarded-Proto": "https"})  # raw header must not be trusted
    assert r.status_code == 426 and r.json()["detail"] == "HTTPS is required."
    s = TestClient(app, base_url="https://testserver").get("/api/districts")
    assert s.status_code == 200 and s.headers["strict-transport-security"] == "max-age=31536000"


def test_rate_limit_429_with_cors_and_retry_after(monkeypatch):
    app = _app(monkeypatch, PUBLIC_API_RATE_LIMIT_REQUESTS="2")
    c = TestClient(app)
    for _ in range(2):
        assert c.get("/api/districts").status_code == 200
    r = c.get("/api/districts", headers={"Origin": "https://esmarch.example", "X-Forwarded-For": "192.0.2.99"})
    assert r.status_code == 429 and "retry-after" in r.headers
    assert r.headers["access-control-allow-origin"] == "https://esmarch.example"
    assert r.headers["cache-control"] == "no-store"
    pre = c.options(
        "/api/districts", headers={"Origin": "https://esmarch.example", "Access-Control-Request-Method": "GET"}
    )
    assert pre.status_code == 200
    assert c.get("/api/health").status_code == 200  # health is exempt


def test_rate_limiter_unit_and_bounds():
    t = [0.0]
    lim = IpRateLimiter(2, 10, 2, ticker=lambda: t[0])
    assert lim.allow("a") and lim.allow("a") and not lim.allow("a")
    assert lim.allow("b") and not lim.allow("c")  # max clients bound
    t[0] = 11
    assert lim.allow("a") and lim.allow("c")
    with pytest.raises(ValueError):
        IpRateLimiter(0, 1, 1)
