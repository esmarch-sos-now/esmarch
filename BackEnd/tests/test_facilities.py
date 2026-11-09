import pytest

from tests.helpers import save_facility


def test_contract_and_metric_distance(client, session):
    save_facility(session, "test-hospital", 10.80)
    d = client.get("/api/facilities/nearby", params={"lat": 10.80, "lng": 106.70}).json()[0]
    assert d["id"] == "test-hospital" and d["type"] == "HOSPITAL" and d["district"] == "Bình Thạnh"
    assert d["distanceMeters"] == 0 and d["hasEmergency"] is True
    assert d["phones"] == [{"label": "Test only", "number": "02800000000", "is24h": True}]
    assert d["verifiedAt"] == "2026-01-01T00:00:00Z"
    assert "verificationSource" not in d
    far = client.get("/api/facilities/nearby", params={"lat": 10.81, "lng": 106.70}).json()[0]
    assert far["distanceMeters"] >= 1100 and far["distanceMethod"] in ("ROAD", "STRAIGHT_LINE")


def test_expands_radius_and_honors_limit(client, session):
    for fid, lat in [("first", 10.81), ("second", 10.86), ("third", 10.94), ("outside", 11.1)]:
        save_facility(session, fid, lat)
    p = {"lat": 10.80, "lng": 106.70, "radius": 500}
    assert [f["id"] for f in client.get("/api/facilities/nearby", params=p).json()] == ["first", "second", "third"]
    assert [f["id"] for f in client.get("/api/facilities/nearby", params={**p, "limit": 1}).json()] == ["first"]


def test_nearby_orders_distance_then_emergency_priority(client, session):
    # Legacy FacilityApiTests expected priority-first, but the implementation (and README) sort distance-first.
    save_facility(session, "clinic", 10.80, emergency=False)
    save_facility(session, "day", 10.81, full_time=False)
    save_facility(session, "night-far", 10.83)
    save_facility(session, "night-near", 10.82)
    ids = [f["id"] for f in client.get("/api/facilities/nearby", params={"lat": 10.80, "lng": 106.70}).json()]
    assert ids == ["clinic", "day", "night-near", "night-far"]


def test_district_lookup_unaccented_and_no_distance(client, session):
    save_facility(session, "t", 10.8, full_time=False)
    r = client.get("/api/facilities", params={"district": "  quan binh thanh  "}).json()
    assert len(r) == 1 and "distanceMeters" not in r[0]
    assert client.get("/api/facilities", params={"district": "Quận 1"}).json() == []


def test_districts_without_data(client):
    d = client.get("/api/districts").json()
    assert len(d) == 23 and "Bình Thạnh" in d
    assert client.get("/api/facilities", params={"district": "Hà Nội"}).status_code == 400
    assert client.get("/api/facilities").status_code == 400


def test_unverified_and_future_never_published(client, session):
    from datetime import timedelta

    from app.core import clock

    save_facility(session, "unverified", 10.80, verified=None)
    save_facility(session, "future", 10.80, verified=clock.now() + timedelta(days=1))
    assert client.get("/api/facilities/nearby", params={"lat": 10.8, "lng": 106.7}).json() == []
    assert client.get("/api/facilities", params={"district": "Bình Thạnh"}).json() == []


@pytest.mark.parametrize(
    "name,value",
    [
        ("lat", "91"),
        ("lat", "-91"),
        ("lat", "NaN"),
        ("lat", "Infinity"),
        ("lng", "181"),
        ("lng", "-181"),
        ("lng", "-Infinity"),
        ("radius", "0"),
        ("radius", "50001"),
        ("radius", "1.5"),
        ("limit", "0"),
        ("limit", "51"),
        ("limit", "abc"),
    ],
)
def test_invalid_params_400(client, name, value):
    params = {"lat": "10.80", "lng": "106.70", name: value}
    assert client.get("/api/facilities/nearby", params=params).status_code == 400


def test_missing_coordinates(client):
    assert client.get("/api/facilities/nearby", params={"lat": 10.8}).status_code == 400
    assert client.get("/api/facilities/nearby", params={"lng": 106.7}).status_code == 400


def test_no_echo_or_logging_of_coordinates(client, session, caplog):
    save_facility(session, "test", 10.80)
    ok = client.get("/api/facilities/nearby", params={"lat": "10.789123456", "lng": "106.789123456"})
    assert ok.status_code == 200 and ok.headers["cache-control"] == "no-store"
    bad = client.get("/api/facilities/nearby", params={"lat": "10.789123456-secret", "lng": "106.70"})
    assert bad.status_code == 400 and bad.headers["content-type"].startswith("application/problem+json")
    assert "10.789123456" not in bad.text and "secret" not in bad.text
    assert "10.789123456" not in caplog.text
    assert client.get("/api/alerts").json() == []


def test_road_distance_is_not_shorter_than_straight_line(client):
    from app.common.checks import meters
    from app.modules.facilities.road_distance import get_road_service

    road = get_road_service()
    assert road is not None
    out = road.distances(10.78, 106.70, [(10.80, 106.72), (10.76, 106.68)])
    assert out[0] is not None and out[1] is not None
    assert out[0] >= meters(10.78, 106.70, 10.80, 106.72) - 1
    assert road.distances(20.0, 100.0, [(10.8, 106.7)]) == [None]  # outside the graph bbox


def test_cors(client):
    ok = client.get("/api/districts", headers={"Origin": "https://esmarch.example"})
    assert ok.headers["access-control-allow-origin"] == "https://esmarch.example"
    other = client.get("/api/districts", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in other.headers
    pre = client.options(
        "/api/facilities/nearby", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"}
    )
    assert pre.status_code == 200 and pre.headers["access-control-allow-origin"] == "http://localhost:3000"
