from datetime import UTC, datetime

from app.infrastructure.cache.semaforo_snapshot import (
    build_semaforo_snapshot,
)


def test_build_complete_semaforo_snapshot() -> None:

    fecha_calculo = datetime(
        2026,
        11,
        15,
        19,
        30,
        tzinfo=UTC,
    )

    fecha_medicion = datetime(
        2026,
        11,
        15,
        19,
        25,
        tzinfo=UTC,
    )

    ultima_actualizacion = datetime(
        2026,
        11,
        15,
        19,
        35,
        tzinfo=UTC,
    )

    snapshot = build_semaforo_snapshot(
        albergue_id="abc123",
        nombre="Albergue Central",
        nivel_semaforo="amarillo",
        codigo_semaforo=2,
        estado_semaforo_id="estado123",
        fecha_calculo=fecha_calculo,
        porcentaje_ocupacion=82.5,
        alertas_activas=2,
        ultima_medicion={
            "fecha_hora": fecha_medicion,
            "ph": 7.1,
            "cloro_residual": 0.5,
            "personas_alojadas": 165,
            "porcentaje_ocupacion": 82.5,
        },
        ultima_actualizacion=ultima_actualizacion,
    )

    assert snapshot == {
        "albergue_id": "abc123",
        "nombre": "Albergue Central",
        "nivel_semaforo": "amarillo",
        "codigo_semaforo": 2,
        "estado_semaforo_id": "estado123",
        "fecha_calculo": (
            "2026-11-15T19:30:00+00:00"
        ),
        "porcentaje_ocupacion": 82.5,
        "alertas_activas": 2,
        "ultima_medicion": {
            "fecha_hora": (
                "2026-11-15T19:25:00+00:00"
            ),
            "ph": 7.1,
            "cloro_residual": 0.5,
            "personas_alojadas": 165,
            "porcentaje_ocupacion": 82.5,
        },
        "ultima_actualizacion": (
            "2026-11-15T19:35:00+00:00"
        ),
    }


def test_snapshot_accepts_missing_semaforo() -> None:

    snapshot = build_semaforo_snapshot(
        albergue_id="abc123",
        nombre="Albergue Central",
        nivel_semaforo=None,
        codigo_semaforo=None,
        estado_semaforo_id=None,
        fecha_calculo=None,
        porcentaje_ocupacion=None,
        alertas_activas=None,
        ultima_medicion=None,
        ultima_actualizacion=None,
    )

    assert (
        snapshot["nivel_semaforo"]
        is None
    )

    assert (
        snapshot["codigo_semaforo"]
        is None
    )

    assert (
        snapshot["estado_semaforo_id"]
        is None
    )

    assert (
        snapshot["fecha_calculo"]
        is None
    )

    assert (
        snapshot["ultima_medicion"]
        is None
    )

    assert (
        snapshot["ultima_actualizacion"]
        is None
    )


def test_snapshot_preserves_zero_values() -> None:

    snapshot = build_semaforo_snapshot(
        albergue_id="abc123",
        nombre="Albergue Central",
        nivel_semaforo="verde",
        codigo_semaforo=0,
        estado_semaforo_id=None,
        fecha_calculo=None,
        porcentaje_ocupacion=0.0,
        alertas_activas=0,
        ultima_medicion={
            "fecha_hora": None,
            "ph": 0.0,
            "cloro_residual": 0.0,
            "personas_alojadas": 0,
            "porcentaje_ocupacion": 0.0,
        },
        ultima_actualizacion=None,
    )

    assert (
        snapshot["codigo_semaforo"]
        == 0
    )

    assert (
        snapshot["porcentaje_ocupacion"]
        == 0.0
    )

    assert (
        snapshot["alertas_activas"]
        == 0
    )

    assert snapshot["ultima_medicion"] == {
        "fecha_hora": None,
        "ph": 0.0,
        "cloro_residual": 0.0,
        "personas_alojadas": 0,
        "porcentaje_ocupacion": 0.0,
    }