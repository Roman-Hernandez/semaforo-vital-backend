"""Validación HTTP y contratos públicos independientes del almacenamiento."""
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.application.shelters import AdministratorContact, AlertSummary
from app.domain.shelters import (
    Coordinates as DomainCoordinates,
    DailyCases,
    DiseaseRecord,
    DiseaseSummary,
    Intervention,
    IntradayOccupancy,
    Location as DomainLocation,
    RiskAnalysis,
    SanitaryConditions,
    ShelterUpdate as ShelterChanges,
    TrafficLight,
)

NonNegativeInt = Annotated[int, Field(strict=True, ge=0, le=2147483647)]
Text = Annotated[str, Field(min_length=1, max_length=300)]


class Coordinates(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    type: Literal["Point"]
    coordinates: tuple[float, float]

    @model_validator(mode="after")
    def valid_coordinates(self):
        longitude, latitude = self.coordinates
        if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
            raise ValueError("Coordenadas fuera de rango")
        return self


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    departamento: Text
    municipio: Text
    direccion: Text
    coordenadas: Coordinates


class ShelterUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nombre: Text | None = None
    capacidad_instalada: NonNegativeInt | None = None
    ubicacion: Location | None = None

    @model_validator(mode="after")
    def supplied_values(self):
        if not self.model_fields_set or any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Envíe al menos un campo autorizado, sin valores nulos")
        return self

    def to_command(self) -> ShelterChanges:
        location = None
        if self.ubicacion is not None:
            value = self.ubicacion
            location = DomainLocation(
                departamento=value.departamento, municipio=value.municipio,
                direccion=value.direccion,
                coordenadas=DomainCoordinates(
                    type=value.coordenadas.type, coordinates=value.coordenadas.coordinates,
                ),
            )
        return ShelterChanges(
            nombre=self.nombre, capacidad_instalada=self.capacidad_instalada, ubicacion=location,
        )


class PopulationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fecha: date
    poblacion: NonNegativeInt


# Public response contracts are independent of MongoDB document fields.
class TraceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    registrado_por: str
    updated_at: datetime | None = None
    updated_by: str | None = None


class ShelterResponse(TraceResponse):
    codigo_albergue: str
    nombre: str
    ubicacion: DomainLocation
    capacidad_instalada: int
    activo: bool
    fecha: datetime


class PopulationRecordResponse(TraceResponse):
    albergue_id: str
    fecha: datetime
    poblacion: int


class PopulationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    poblacion_actual: int | None
    porcentaje_ocupacion: float | None
    cupos_disponibles: int | None
    ultimo_registro: PopulationRecordResponse | None
    ocupacion_intradia: IntradayOccupancy | None


class ShelterDetailResponse(PopulationResponse):
    albergue: ShelterResponse
    administrador: AdministratorContact


class DashboardResponse(ShelterDetailResponse):
    semaforo_vital: TrafficLight | None
    alertas: AlertSummary
    casos_diarios: DailyCases | None
    condiciones_sanitarias: SanitaryConditions | None
    analisis_ia: RiskAnalysis | None
    resumen_casos: list[DiseaseSummary]
    evolucion_epidemiologica: list[DiseaseRecord]
    intervenciones: list[Intervention]
    ultima_actualizacion: datetime | None
    predicciones: list[None]
    simulaciones_sir: list[None]
    datos_no_disponibles: list[str]
