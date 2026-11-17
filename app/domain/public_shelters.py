"""Información autorizada para consulta pública: sin autores, contactos ni notas internas."""
from dataclasses import dataclass
from datetime import datetime

from app.domain.shelters import Location


@dataclass(frozen=True, kw_only=True)
class PublicSanitaryConditions:
    fecha: datetime
    agua_potable_disponible: bool
    banos_disponibles: int
    estado_higiene: str
    estado_saneamiento: str


@dataclass(frozen=True, kw_only=True)
class PublicShelter:
    id: str
    codigo_albergue: str
    nombre: str
    ubicacion: Location
    capacidad_instalada: int
    poblacion_actual: int | None
    porcentaje_ocupacion: float | None
    cupos_disponibles: int | None
    nivel_riesgo: str | None
    fecha_calculo_riesgo: datetime | None
    condiciones_sanitarias: PublicSanitaryConditions | None


@dataclass(frozen=True, kw_only=True)
class PublicAlert:
    id: str
    albergue_id: str
    fecha_alerta: datetime
    nivel_riesgo: str
    tipo_alerta: str
    mensaje: str
    activa: bool
