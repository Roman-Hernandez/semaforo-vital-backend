"""Entradas de registros reales; el servidor asigna albergue, autor y trazabilidad."""
from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.api.shelter_schemas import NonNegativeInt, Text
from app.core.timezone import start_of_day_colombia
from app.domain.shelters import (
    DiseaseInput,
    InterventionInput,
    SanitaryInput,
    SanitaryResource,
)


class RecordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    fuente_datos: Text = "registro_manual"
    observaciones: Annotated[str, Field(max_length=2000)] | None = None


class ResourceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nombre: Text
    cantidad: NonNegativeInt
    observacion: Annotated[str, Field(max_length=2000)] | None = None


class SanitaryRequest(RecordRequest):
    fecha: date
    agua_potable_disponible: Annotated[bool, Field(strict=True)]
    banos_disponibles: NonNegativeInt
    estado_higiene: Text
    estado_saneamiento: Text
    otros_recursos_sanitarios: list[ResourceRequest] = Field(default_factory=list, max_length=100)

    def to_command(self) -> SanitaryInput:
        values = self.model_dump()
        values["fecha"] = start_of_day_colombia(self.fecha)
        values["otros_recursos_sanitarios"] = [SanitaryResource(**item.model_dump()) for item in self.otros_recursos_sanitarios]
        return SanitaryInput(**values)


class DiseaseRequest(RecordRequest):
    cantidad_recuperados: NonNegativeInt | None = Field(default=None, description="Personas recuperadas de esta enfermedad dentro de la población actual; no solo las altas del día")
    fecha: date
    enfermedad: Text
    cantidad_casos_activos: NonNegativeInt

    def to_command(self) -> DiseaseInput:
        return DiseaseInput(**{**self.model_dump(), "fecha": start_of_day_colombia(self.fecha)})


class InterventionRequest(RecordRequest):
    fecha_intervencion: date
    tipo_intervencion: Text
    descripcion: Annotated[str, Field(min_length=1, max_length=2000)]

    def to_command(self) -> InterventionInput:
        return InterventionInput(**{**self.model_dump(), "fecha_intervencion": start_of_day_colombia(self.fecha_intervencion)})
