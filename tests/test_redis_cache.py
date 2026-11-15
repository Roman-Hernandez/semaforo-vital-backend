import json
from unittest.mock import MagicMock

from redis.exceptions import RedisError

from app.core.config import settings
from app.infrastructure.cache.redis import (
    build_semaforo_estado_key,
    cache_delete,
    cache_get_json,
    cache_set_json,
)


def test_build_semaforo_estado_key(monkeypatch) -> None:
    monkeypatch.setattr(
        settings,
        "redis_key_prefix",
        "semaforo:estado",
    )

    key = build_semaforo_estado_key("ABC123")

    assert key == "semaforo:estado:ABC123"


def test_cache_get_json_returns_none_without_client() -> None:
    assert cache_get_json(None, "semaforo:estado:1") is None


def test_cache_get_json_returns_none_on_cache_miss() -> None:
    client = MagicMock()
    client.get.return_value = None

    result = cache_get_json(
        client,
        "semaforo:estado:1",
    )

    assert result is None

    client.get.assert_called_once_with(
        "semaforo:estado:1"
    )


def test_cache_get_json_returns_cached_dictionary() -> None:
    client = MagicMock()

    cached_value = {
        "albergue_id": "1",
        "nivel_semaforo": "verde",
        "codigo_semaforo": 1,
    }

    client.get.return_value = json.dumps(
        cached_value
    )

    result = cache_get_json(
        client,
        "semaforo:estado:1",
    )

    assert result == cached_value


def test_cache_get_json_rejects_invalid_json() -> None:
    client = MagicMock()

    client.get.return_value = (
        "{json-invalido"
    )

    result = cache_get_json(
        client,
        "semaforo:estado:1",
    )

    assert result is None


def test_cache_get_json_rejects_non_dictionary_json() -> None:
    client = MagicMock()

    client.get.return_value = json.dumps(
        ["dato", "invalido"]
    )

    result = cache_get_json(
        client,
        "semaforo:estado:1",
    )

    assert result is None


def test_cache_get_json_handles_redis_failure() -> None:
    client = MagicMock()

    client.get.side_effect = RedisError(
        "Redis no disponible"
    )

    result = cache_get_json(
        client,
        "semaforo:estado:1",
    )

    assert result is None


def test_cache_set_json_returns_false_without_client() -> None:
    result = cache_set_json(
        None,
        "semaforo:estado:1",
        {
            "nivel_semaforo": "verde",
        },
    )

    assert result is False


def test_cache_set_json_uses_configured_ttl(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        settings,
        "redis_ttl_seconds",
        900,
    )

    client = MagicMock()

    value = {
        "albergue_id": "1",
        "nombre": "Albergue Central",
        "nivel_semaforo": "amarillo",
        "codigo_semaforo": 2,
    }

    result = cache_set_json(
        client,
        "semaforo:estado:1",
        value,
    )

    assert result is True

    client.setex.assert_called_once()

    args = client.setex.call_args.args

    assert args[0] == "semaforo:estado:1"
    assert args[1] == 900
    assert json.loads(args[2]) == value


def test_cache_set_json_handles_redis_failure() -> None:
    client = MagicMock()

    client.setex.side_effect = RedisError(
        "Redis no disponible"
    )

    result = cache_set_json(
        client,
        "semaforo:estado:1",
        {
            "nivel_semaforo": "rojo",
        },
    )

    assert result is False


def test_cache_delete_returns_false_without_client() -> None:
    result = cache_delete(
        None,
        "semaforo:estado:1",
    )

    assert result is False


def test_cache_delete_removes_key() -> None:
    client = MagicMock()

    result = cache_delete(
        client,
        "semaforo:estado:1",
    )

    assert result is True

    client.delete.assert_called_once_with(
        "semaforo:estado:1"
    )


def test_cache_delete_handles_redis_failure() -> None:
    client = MagicMock()

    client.delete.side_effect = RedisError(
        "Redis no disponible"
    )

    result = cache_delete(
        client,
        "semaforo:estado:1",
    )

    assert result is False