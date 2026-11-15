import json
from datetime import UTC, datetime
from unittest.mock import MagicMock

from bson import ObjectId
from redis.exceptions import RedisError

from app.infrastructure.cache.semaforo_cache import (
    get_semaforo_snapshot,
    invalidate_semaforo_snapshot,
)


def _mongodb_with_snapshot(
    albergue_id: ObjectId,
) -> MagicMock:

    database = MagicMock()

    estado_semaforo_id = ObjectId()

    database.albergues.find_one.return_value = {
        "_id": albergue_id,
        "nombre": "Albergue Central",
    }

    database.metricas_albergue.find_one.return_value = {
        "_id": ObjectId(),
        "albergue_id": albergue_id,
        "fecha_bucket": datetime(
            2026,
            11,
            15,
            tzinfo=UTC,
        ),
        "calculados": {
            "porcentaje_ocupacion": 82.5,
        },
        "ultima_medicion": {
            "fecha_hora": datetime(
                2026,
                11,
                15,
                19,
                25,
                tzinfo=UTC,
            ),
            "ph": 7.1,
            "cloro_residual": 0.5,
            "personas_alojadas": 165,
            "porcentaje_ocupacion": 82.5,
        },
        "estado_actual": {
            "semaforo_vital": {
                "nivel": "amarillo",
                "codigo": 2,
                "estado_semaforo_id": (
                    estado_semaforo_id
                ),
                "fecha_calculo": datetime(
                    2026,
                    11,
                    15,
                    19,
                    30,
                    tzinfo=UTC,
                ),
            },
            "alertas_activas": {
                "cantidad": 2,
                "ids": [],
            },
        },
        "created_at": datetime(
            2026,
            11,
            15,
            19,
            20,
            tzinfo=UTC,
        ),
        "updated_at": datetime(
            2026,
            11,
            15,
            19,
            35,
            tzinfo=UTC,
        ),
    }

    return database


def test_cache_hit_does_not_query_mongodb() -> None:

    albergue_id = str(
        ObjectId()
    )

    redis_client = MagicMock()

    redis_client.get.return_value = (
        json.dumps(
            {
                "albergue_id": albergue_id,
                "nombre": "Desde Redis",
                "nivel_semaforo": "verde",
                "codigo_semaforo": 1,
                "estado_semaforo_id": (
                    "estado-cache"
                ),
                "fecha_calculo": None,
                "porcentaje_ocupacion": 50.0,
                "alertas_activas": 0,
                "ultima_medicion": None,
                "ultima_actualizacion": None,
            }
        )
    )

    database = MagicMock()

    result = get_semaforo_snapshot(
        database,
        redis_client,
        albergue_id,
    )

    assert result is not None

    assert (
        result["nombre"]
        == "Desde Redis"
    )

    assert (
        result["estado_semaforo_id"]
        == "estado-cache"
    )

    database.albergues.find_one.assert_not_called()

    database.metricas_albergue.find_one.assert_not_called()


def test_cache_miss_loads_mongodb_and_populates_redis() -> None:

    object_id = ObjectId()
    albergue_id = str(
        object_id
    )

    redis_client = MagicMock()

    redis_client.get.return_value = None

    database = _mongodb_with_snapshot(
        object_id
    )

    result = get_semaforo_snapshot(
        database,
        redis_client,
        albergue_id,
    )

    assert result is not None

    assert (
        result["albergue_id"]
        == albergue_id
    )

    assert (
        result["nombre"]
        == "Albergue Central"
    )

    assert (
        result["nivel_semaforo"]
        == "amarillo"
    )

    assert (
        result["codigo_semaforo"]
        == 2
    )

    assert (
        result["estado_semaforo_id"]
        is not None
    )

    assert (
        result["porcentaje_ocupacion"]
        == 82.5
    )

    assert (
        result["alertas_activas"]
        == 2
    )

    assert (
        result["ultima_medicion"]["ph"]
        == 7.1
    )

    assert (
        result["ultima_actualizacion"]
        == "2026-11-15T19:35:00+00:00"
    )

    redis_client.setex.assert_called_once()


def test_missing_metrics_returns_empty_snapshot() -> None:

    object_id = ObjectId()

    albergue_id = str(
        object_id
    )

    redis_client = MagicMock()

    redis_client.get.return_value = None

    database = MagicMock()

    database.albergues.find_one.return_value = {
        "_id": object_id,
        "nombre": "Albergue Sin Métricas",
    }

    database.metricas_albergue.find_one.return_value = None

    result = get_semaforo_snapshot(
        database,
        redis_client,
        albergue_id,
    )

    assert result is not None

    assert (
        result["nivel_semaforo"]
        is None
    )

    assert (
        result["codigo_semaforo"]
        is None
    )

    assert (
        result["estado_semaforo_id"]
        is None
    )

    assert (
        result["porcentaje_ocupacion"]
        is None
    )

    assert (
        result["ultima_medicion"]
        is None
    )

    assert (
        result["ultima_actualizacion"]
        is None
    )

    redis_client.setex.assert_called_once()


def test_missing_shelter_returns_none() -> None:

    object_id = ObjectId()

    albergue_id = str(
        object_id
    )

    redis_client = MagicMock()

    redis_client.get.return_value = None

    database = MagicMock()

    database.albergues.find_one.return_value = None

    result = get_semaforo_snapshot(
        database,
        redis_client,
        albergue_id,
    )

    assert result is None

    database.metricas_albergue.find_one.assert_not_called()

    redis_client.setex.assert_not_called()


def test_invalid_object_id_returns_none() -> None:

    redis_client = MagicMock()

    redis_client.get.return_value = None

    database = MagicMock()

    result = get_semaforo_snapshot(
        database,
        redis_client,
        "id-no-valido",
    )

    assert result is None

    database.albergues.find_one.assert_not_called()


def test_redis_failure_falls_back_to_mongodb() -> None:

    object_id = ObjectId()

    albergue_id = str(
        object_id
    )

    redis_client = MagicMock()

    redis_client.get.side_effect = RedisError(
        "Redis no disponible"
    )

    redis_client.setex.side_effect = RedisError(
        "Redis no disponible"
    )

    database = _mongodb_with_snapshot(
        object_id
    )

    result = get_semaforo_snapshot(
        database,
        redis_client,
        albergue_id,
    )

    assert result is not None

    assert (
        result["nivel_semaforo"]
        == "amarillo"
    )

    assert (
        result["nombre"]
        == "Albergue Central"
    )


def test_invalidate_snapshot_deletes_cache_key() -> None:

    albergue_id = str(
        ObjectId()
    )

    redis_client = MagicMock()

    result = invalidate_semaforo_snapshot(
        redis_client,
        albergue_id,
    )

    assert result is True

    redis_client.delete.assert_called_once_with(
        f"semaforo:estado:{albergue_id}"
    )


def test_invalidate_without_redis_is_safe() -> None:

    result = invalidate_semaforo_snapshot(
        None,
        str(
            ObjectId()
        ),
    )

    assert result is False