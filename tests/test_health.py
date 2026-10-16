from app.api.v1.endpoints.health import health_check
from app.main import app


def test_health_check_returns_ok() -> None:
    assert health_check() == {"status": "ok"}


def test_health_endpoint_is_mounted_under_api_v1() -> None:
    paths = [route.path for route in app.routes]
    assert "/api/v1/health" in paths
