from datetime import datetime
from typing import TypedDict


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
    ultima_medicion_fecha: datetime | None,
    ultima_medicion_ph: float | None,
    ultima_medicion_cloro_residual: float | None,
    ultima_medicion_personas_alojadas: int | None,
    ultima_medicion_porcentaje_ocupacion: float | None,
    ultima_actualizacion: datetime | None,
) -> SemaforoEstadoCache:

    ultima_medicion: UltimaMedicionCache | None = None

    if any(
        value is not None
        for value in (
            ultima_medicion_fecha,
            ultima_medicion_ph,
            ultima_medicion_cloro_residual,
            ultima_medicion_personas_alojadas,
            ultima_medicion_porcentaje_ocupacion,
        )
    ):
        ultima_medicion = {
            "fecha_hora": _datetime_iso(
                ultima_medicion_fecha
            ),
            "ph": ultima_medicion_ph,
            "cloro_residual": ultima_medicion_cloro_residual,
            "personas_alojadas": (
                ultima_medicion_personas_alojadas
            ),
            "porcentaje_ocupacion": (
                ultima_medicion_porcentaje_ocupacion
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
        "ultima_medicion": ultima_medicion,
        "ultima_actualizacion": _datetime_iso(
            ultima_actualizacion
        ),
    }