from dataclasses import dataclass, field
from datetime import datetime

from app.domain.errors import (
    InvalidPopulation,
    InvalidShelterData,
    ShelterAccessDenied,
)
from app.domain.users import User, UserRole


@dataclass(frozen=True, kw_only=True)
class Coordinates:
    type: str
    coordinates: tuple[float, float]

    def __post_init__(self):
        if len(self.coordinates) != 2:
            raise InvalidShelterData()
        longitude, latitude = self.coordinates
        if self.type != "Point" or not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
            raise InvalidShelterData()


@dataclass(frozen=True, kw_only=True)
class Location:
    departamento: str
    municipio: str
    direccion: str
    coordenadas: Coordinates

    def __post_init__(self):
        if any(not text.strip() for text in (self.departamento, self.municipio, self.direccion)):
            raise InvalidShelterData()


@dataclass(frozen=True, kw_only=True)
class Trace:
    id: str
    created_at: datetime
    registrado_por: str
    updated_at: datetime | None = None
    updated_by: str | None = None

    @property
    def last_updated(self) -> datetime:
        return self.updated_at or self.created_at


@dataclass(frozen=True, kw_only=True)
class Shelter(Trace):
    codigo_albergue: str
    nombre: str
    ubicacion: Location
    capacidad_instalada: int
    activo: bool
    fecha: datetime


@dataclass(frozen=True, kw_only=True)
class ShelterUpdate:
    nombre: str | None = None
    capacidad_instalada: int | None = None
    ubicacion: Location | None = None

    def __post_init__(self):
        if self.nombre is self.capacidad_instalada is self.ubicacion is None:
            raise InvalidShelterData()
        if self.nombre is not None and not self.nombre.strip():
            raise InvalidShelterData()
        if self.capacidad_instalada is not None and (
            type(self.capacidad_instalada) is not int or self.capacidad_instalada < 0
        ):
            raise InvalidShelterData()


@dataclass(frozen=True, kw_only=True)
class PopulationRecord(Trace):
    albergue_id: str
    fecha: datetime
    poblacion: int


@dataclass(frozen=True, kw_only=True)
class Occupancy:
    poblacion_actual: int | None
    porcentaje_ocupacion: float | None
    cupos_disponibles: int | None


@dataclass(frozen=True, kw_only=True)
class IntradayOccupancy:
    porcentaje_ocupacion: float | None
    personas_alojadas: int | None
    fecha_hora: datetime | None


@dataclass(frozen=True, kw_only=True)
class TrafficLight:
    nivel: str
    codigo: int | None = None
    estado_semaforo_id: str | None = None
    fecha_calculo: datetime | None = None
    descripcion: str | None = None


@dataclass(frozen=True, kw_only=True)
class ShelterIndicators:
    ocupacion: IntradayOccupancy | None = None
    semaforo: TrafficLight | None = None
    alertas_activas: int | None = None
    ultima_actualizacion: datetime | None = None


@dataclass(frozen=True, kw_only=True)
class SanitaryResource:
    nombre: str
    cantidad: int
    observacion: str | None = None


@dataclass(frozen=True, kw_only=True)
class SanitaryConditions(Trace):
    albergue_id: str
    fecha: datetime
    agua_potable_disponible: bool
    banos_disponibles: int
    estado_higiene: str
    estado_saneamiento: str
    fuente_datos: str
    otros_recursos_sanitarios: list[SanitaryResource] = field(default_factory=list)
    observaciones: str | None = None


@dataclass(frozen=True, kw_only=True)
class DiseaseSummary:
    enfermedad: str
    cantidad_casos_activos: int
    fecha: datetime


@dataclass(frozen=True, kw_only=True)
class DiseaseRecord(Trace, DiseaseSummary):
    albergue_id: str
    fuente_datos: str
    observaciones: str | None = None


@dataclass(frozen=True, kw_only=True)
class Intervention(Trace):
    albergue_id: str
    fecha_intervencion: datetime
    tipo_intervencion: str
    descripcion: str
    fuente_datos: str
    observaciones: str | None = None
    estado: str | None = None


@dataclass(frozen=True, kw_only=True)
class AnalysisPeriod:
    fecha_inicio: datetime
    fecha_fin: datetime


@dataclass(frozen=True, kw_only=True)
class ModelVersion:
    nombre: str
    version: str


@dataclass(frozen=True, kw_only=True)
class RiskResult:
    probabilidad_riesgo: float


@dataclass(frozen=True, kw_only=True)
class AnalysisInputs:
    registros_diarios_ids: list[str]
    condiciones_sanitarias_ids: list[str]
    casos_enfermedades_ids: list[str]
    intervenciones_ids: list[str]
    metricas_albergue_ids: list[str]


@dataclass(frozen=True, kw_only=True)
class MissingData:
    campo: str
    cantidad: int
    tratamiento: str


@dataclass(frozen=True, kw_only=True)
class Preprocessing:
    registros_considerados: int
    registros_descartados: int
    datos_faltantes: list[MissingData]


@dataclass(frozen=True, kw_only=True)
class RiskAnalysis(Trace):
    albergue_id: str
    fecha_ejecucion: datetime
    periodo_analizado: AnalysisPeriod
    modelo: ModelVersion
    resultado: RiskResult
    datos_entrada: AnalysisInputs
    preprocesamiento: Preprocessing
    escenario_id: str | None = None


@dataclass(frozen=True, kw_only=True)
class DailyCases:
    casos_eda: int | None = None
    casos_ira: int | None = None
    ultima_actualizacion: datetime | None = None


@dataclass(frozen=True, kw_only=True)
class DashboardSources:
    casos_diarios: DailyCases | None = None
    condiciones_sanitarias: SanitaryConditions | None = None
    analisis_ia: RiskAnalysis | None = None
    resumen_casos: list[DiseaseSummary] = field(default_factory=list)
    evolucion_epidemiologica: list[DiseaseRecord] = field(default_factory=list)
    intervenciones: list[Intervention] = field(default_factory=list)


def assigned_shelter(user: User) -> str:
    if not user.active or user.role != UserRole.SHELTER_ADMIN or not user.albergue_id:
        raise ShelterAccessDenied()
    return user.albergue_id


def validate_population(value: int) -> None:
    if type(value) is not int or value < 0:
        raise InvalidPopulation()


def occupancy(capacity: int, population: int | None) -> Occupancy:
    return Occupancy(
        poblacion_actual=population,
        porcentaje_ocupacion=(
            round(population * 100 / capacity, 2)
            if population is not None and capacity > 0 else None
        ),
        cupos_disponibles=max(capacity - population, 0) if population is not None else None,
    )
