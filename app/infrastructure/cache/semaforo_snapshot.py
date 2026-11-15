from datetime import datetime
from typing import TypedDict


class UltimaMedicionInput(TypedDict):
    fecha_hora: datetime | None
    ph: float | None
    cloro_residual: float | None
    personas_alojadas: int | None
    porcentaje_ocupacion: float | None


class UltimaMedicionCache(TypedDict):
    fecha_hora: str | None
    ph: float | None
    cloro_residual: float | None
    personas_alojadas: int | None
    porcentaje_ocupacion: float | None


class SemaforoEstadoCache(TypedDict):
    albergue_id: str
    nombre: str
    nivel_semaforo: str | None
    codigo_semaforo: int | None
    estado_semaforo_id: str | None
    fecha_calculo: str | None
    porcentaje_ocupacion: float | None
    alertas_activas: int | None
    ultima_medicion: UltimaMedicionCache | None
    ultima_actualizacion: str | None


def _datetime_iso(
    value: datetime | None,
) -> str | None:
    if value is None:
        return None

    return value.isoformat()


def build_semaforo_snapshot(
    *,
    albergue_id: str,
    nombre: str,
    nivel_semaforo: str | None,
    codigo_semaforo: int | None,
    estado_semaforo_id: str | None,
    fecha_calculo: datetime | None,
    porcentaje_ocupacion: float | None,
    alertas_activas: int | None,
    ultima_medicion: UltimaMedicionInput | None,
    ultima_actualizacion: datetime | None,
) -> SemaforoEstadoCache:

    medicion_cache: UltimaMedicionCache | None = None

    if (
        ultima_medicion is not None
        and any(
            value is not None
            for value in ultima_medicion.values()
        )
    ):
        medicion_cache = {
            "fecha_hora": _datetime_iso(
                ultima_medicion["fecha_hora"]
            ),
            "ph": ultima_medicion["ph"],
            "cloro_residual": (
                ultima_medicion["cloro_residual"]
            ),
            "personas_alojadas": (
                ultima_medicion["personas_alojadas"]
            ),
            "porcentaje_ocupacion": (
                ultima_medicion["porcentaje_ocupacion"]
            ),
        }

    return {
        "albergue_id": albergue_id,
        "nombre": nombre,
        "nivel_semaforo": nivel_semaforo,
        "codigo_semaforo": codigo_semaforo,
        "estado_semaforo_id": estado_semaforo_id,
        "fecha_calculo": _datetime_iso(
            fecha_calculo
        ),
        "porcentaje_ocupacion": porcentaje_ocupacion,
        "alertas_activas": alertas_activas,
        "ultima_medicion": medicion_cache,
        "ultima_actualizacion": _datetime_iso(
            ultima_actualizacion
        ),
    }