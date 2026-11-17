from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.domain.shelters import Location

RiskLevel = Literal["verde", "amarillo", "rojo"]


class PublicSanitaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    fecha: datetime
    agua_potable_disponible: bool
    banos_disponibles: int
    estado_higiene: str
    estado_saneamiento: str


class PublicShelterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    codigo_albergue: str
    nombre: str
    ubicacion: Location
    capacidad_instalada: int
    poblacion_actual: int | None
    porcentaje_ocupacion: float | None
    cupos_disponibles: int | None
    nivel_riesgo: RiskLevel | None
    fecha_calculo_riesgo: datetime | None
    condiciones_sanitarias: PublicSanitaryResponse | None


class PublicAlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    albergue_id: str
    fecha_alerta: datetime
    nivel_riesgo: RiskLevel
    tipo_alerta: str
    mensaje: str
    activa: bool
