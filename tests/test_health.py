from app.api.v1.endpoints.health import health_check


def test_health_check_returns_ok() -> None:
    assert health_check() == {"status": "ok"}
