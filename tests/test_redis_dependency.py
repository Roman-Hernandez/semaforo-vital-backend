from types import SimpleNamespace
from unittest.mock import MagicMock

from app.api.deps import get_redis
from app.infrastructure.cache.redis import (
    get_redis_from_request,
)


def _request_with_redis(
    redis_client,
):
    return SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(
                redis=redis_client
            )
        )
    )


def test_get_redis_from_request_returns_client() -> None:
    client = MagicMock()

    request = _request_with_redis(
        client
    )

    result = get_redis_from_request(
        request
    )

    assert result is client


def test_get_redis_dependency_returns_client() -> None:
    client = MagicMock()

    request = _request_with_redis(
        client
    )

    result = get_redis(
        request
    )

    assert result is client


def test_get_redis_returns_none_when_unavailable() -> None:
    request = SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace()
        )
    )

    result = get_redis(
        request
    )

    assert result is None