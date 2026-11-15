from typing import Any

from bson import ObjectId
from bson.decimal128 import Decimal128
from pymongo.database import Database
from redis import Redis

from app.infrastructure.cache.redis import (
    build_semaforo_estado_key,
    cache_delete,
    cache_get_json,
    cache_set_json,
)
from app.infrastructure.cache.semaforo_snapshot import (
    SemaforoEstadoCache,
    UltimaMedicionInput,
    build_semaforo_snapshot,
)


def _number(
    value: Any,
) -> float | int | None:
    if value is None:
        return None

    if isinstance(value, Decimal128):
        return float(value.to_decimal())

    return value


def get_semaforo_snapshot(
    database: Database,
    redis_client: Redis | None,
    albergue_id: str,
) -> SemaforoEstadoCache | dict[str, Any] | None:
    """
    Obtiene el snapshot actual del Semáforo Vital.

    Flujo:
        1. Redis HIT -> retorna caché.
        2. Redis MISS -> consulta MongoDB.
        3. Construye snapshot.
        4. Guarda snapshot en Redis.
        5. Retorna snapshot.

    MongoDB permanece como fuente de verdad.
    """

    key = build_semaforo_estado_key(
        albergue_id
    )

    # ========================================================
    # 1. CONSULTAR REDIS
    # ========================================================

    cached = cache_get_json(
        redis_client,
        key,
    )

    if cached is not None:
        return cached

    # ========================================================
    # 2. VALIDAR ID DEL ALBERGUE
    # ========================================================

    if not ObjectId.is_valid(
        albergue_id
    ):
        return None

    object_id = ObjectId(
        albergue_id
    )

    # ========================================================
    # 3. CONSULTAR ALBERGUE
    # ========================================================

    albergue = database.albergues.find_one(
        {
            "_id": object_id,
        },
        {
            "nombre": 1,
        },
    )

    if albergue is None:
        return None

    # ========================================================
    # 4. CONSULTAR ÚLTIMO BUCKET DE MÉTRICAS
    # ========================================================

    metricas = database.metricas_albergue.find_one(
        {
            "albergue_id": object_id,
        },
        {
            "calculados": 1,
            "ultima_medicion": 1,
            "estado_actual": 1,
            "fecha_bucket": 1,
            "created_at": 1,
            "updated_at": 1,
        },
        sort=[
            (
                "fecha_bucket",
                -1,
            ),
            (
                "_id",
                -1,
            ),
        ],
    )

    # ========================================================
    # 5. VALORES POR DEFECTO
    # ========================================================

    nivel_semaforo = None
    codigo_semaforo = None
    estado_semaforo_id = None
    fecha_calculo = None

    porcentaje_ocupacion = None
    alertas_activas = None

    ultima_medicion_cache: UltimaMedicionInput | None = None

    ultima_actualizacion = None

    # ========================================================
    # 6. EXTRAER SNAPSHOT PERSISTENTE
    # ========================================================

    if metricas is not None:

        calculados = metricas.get(
            "calculados",
            {},
        )

        porcentaje_ocupacion = _number(
            calculados.get(
                "porcentaje_ocupacion"
            )
        )

        estado_actual = metricas.get(
            "estado_actual",
            {},
        )

        semaforo = estado_actual.get(
            "semaforo_vital",
            {},
        )

        if semaforo:

            nivel_semaforo = semaforo.get(
                "nivel"
            )

            codigo_semaforo = semaforo.get(
                "codigo"
            )

            valor_estado_id = semaforo.get(
                "estado_semaforo_id"
            )

            if valor_estado_id is not None:
                estado_semaforo_id = str(
                    valor_estado_id
                )

            fecha_calculo = semaforo.get(
                "fecha_calculo"
            )

        alertas = estado_actual.get(
            "alertas_activas",
            {},
        )

        alertas_activas = alertas.get(
            "cantidad"
        )

        ultima_medicion = metricas.get(
            "ultima_medicion",
            {},
        )

        if ultima_medicion:

            ultima_medicion_cache = {
                "fecha_hora": (
                    ultima_medicion.get(
                        "fecha_hora"
                    )
                ),
                "ph": _number(
                    ultima_medicion.get(
                        "ph"
                    )
                ),
                "cloro_residual": _number(
                    ultima_medicion.get(
                        "cloro_residual"
                    )
                ),
                "personas_alojadas": (
                    ultima_medicion.get(
                        "personas_alojadas"
                    )
                ),
                "porcentaje_ocupacion": _number(
                    ultima_medicion.get(
                        "porcentaje_ocupacion"
                    )
                ),
            }

        ultima_actualizacion = (
            metricas.get(
                "updated_at"
            )
            or metricas.get(
                "created_at"
            )
        )

    # ========================================================
    # 7. CONSTRUIR CONTRATO REDIS
    # ========================================================

    snapshot = build_semaforo_snapshot(
        albergue_id=albergue_id,
        nombre=albergue["nombre"],
        nivel_semaforo=nivel_semaforo,
        codigo_semaforo=codigo_semaforo,
        estado_semaforo_id=estado_semaforo_id,
        fecha_calculo=fecha_calculo,
        porcentaje_ocupacion=porcentaje_ocupacion,
        alertas_activas=alertas_activas,
        ultima_medicion=ultima_medicion_cache,
        ultima_actualizacion=ultima_actualizacion,
    )

    # ========================================================
    # 8. POBLAR REDIS
    # ========================================================

    cache_set_json(
        redis_client,
        key,
        snapshot,
    )

    return snapshot


def invalidate_semaforo_snapshot(
    redis_client: Redis | None,
    albergue_id: str,
) -> bool:
    """
    Invalida el snapshot Redis.

    La próxima lectura reconstruirá el dato
    directamente desde MongoDB.
    """

    key = build_semaforo_estado_key(
        albergue_id
    )

    return cache_delete(
        redis_client,
        key,
    )