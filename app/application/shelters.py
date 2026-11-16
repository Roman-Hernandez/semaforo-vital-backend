from dataclasses import asdict, dataclass, fields, replace
from datetime import datetime

from app.domain.errors import ShelterNotFound
from app.domain.ports.shelter_repository import ShelterRepository
from app.domain.shelters import (
    DailyCases,
    DiseaseRecord,
    DiseaseSummary,
    Intervention,
    IntradayOccupancy,
    Occupancy,
    PopulationRecord,
    PredictionSummary,
    RiskAnalysis,
    RiskDistribution,
    SanitaryConditions,
    Shelter,
    ShelterIndicators,
    ShelterUpdate,
    SIRSimulation,
    TrafficLight,
    assigned_shelter,
    occupancy,
    summarize_simulation,
    validate_population,
)
from app.domain.users import User


@dataclass(frozen=True, kw_only=True)
class AdministratorContact:
    id: str
    nombre: str | None
    apellido: str | None
    email: str


@dataclass(frozen=True, kw_only=True)
class PopulationView(Occupancy):
    ultimo_registro: PopulationRecord | None
    ocupacion_intradia: IntradayOccupancy | None


@dataclass(frozen=True, kw_only=True)
class ShelterDetail(PopulationView):
    albergue: Shelter
    administrador: AdministratorContact


@dataclass(frozen=True, kw_only=True)
class AlertSummary:
    cantidad: int
    por_nivel_riesgo: RiskDistribution
    por_prioridad: None = None


@dataclass(frozen=True, kw_only=True)
class DashboardView(ShelterDetail):
    semaforo_vital: TrafficLight | None
    alertas: AlertSummary
    ultima_actualizacion: datetime | None
    casos_diarios: DailyCases | None
    condiciones_sanitarias: SanitaryConditions | None
    analisis_ia: RiskAnalysis | None
    resumen_casos: list[DiseaseSummary]
    evolucion_epidemiologica: list[DiseaseRecord]
    intervenciones: list[Intervention]
    predicciones: list[PredictionSummary]
    simulaciones_sir: list[SIRSimulation]
    datos_no_disponibles: list[str]


class ShelterService:
    def __init__(self, repository: ShelterRepository):
        self.repository = repository

    def detail(self, user: User) -> ShelterDetail:
        shelter_id = assigned_shelter(user)
        return self._detail(user, shelter_id, self.repository.latest_metrics(shelter_id))

    def _detail(
        self, user: User, shelter_id: str, indicators: ShelterIndicators,
    ) -> ShelterDetail:
        shelter = self.repository.find(shelter_id)
        if shelter is None:
            raise ShelterNotFound()
        history = self.repository.population_history(shelter_id, 1, 0)
        latest = history[0] if history else None
        return ShelterDetail(
            albergue=shelter,
            administrador=AdministratorContact(
                id=user.id, nombre=user.nombre, apellido=user.apellido, email=user.email,
            ),
            ultimo_registro=latest,
            ocupacion_intradia=indicators.ocupacion,
            **asdict(occupancy(
                shelter.capacidad_instalada, latest.poblacion if latest else None,
            )),
        )

    def population(self, user: User) -> PopulationView:
        detail = self.detail(user)
        return PopulationView(**{item.name: getattr(detail, item.name) for item in fields(PopulationView)})

    def update(self, user: User, changes: ShelterUpdate, now: datetime) -> Shelter:
        result = self.repository.update(assigned_shelter(user), changes, user.id, now)
        if result is None:
            raise ShelterNotFound()
        return result

    def history(self, user: User, limit: int, offset: int) -> list[PopulationRecord]:
        shelter_id = assigned_shelter(user)
        if self.repository.find(shelter_id) is None:
            raise ShelterNotFound()
        return self.repository.population_history(shelter_id, limit, offset)

    def save_population(
        self, user: User, day: datetime, population: int, now: datetime,
    ) -> PopulationRecord:
        shelter_id = assigned_shelter(user)
        validate_population(population)
        if self.repository.find(shelter_id) is None:
            raise ShelterNotFound()
        return self.repository.save_population(shelter_id, user.id, day, population, now)

    def dashboard(self, user: User, limit: int) -> DashboardView:
        shelter_id = assigned_shelter(user)
        indicators = self.repository.latest_metrics(shelter_id)
        detail = self._detail(user, shelter_id, indicators)
        sources = self.repository.dashboard_sources(shelter_id, limit)
        risk = sources.semaforo_oficial or indicators.semaforo
        descriptions = {"verde": "Riesgo bajo", "amarillo": "Riesgo medio", "rojo": "Riesgo crítico"}
        if risk:
            risk = replace(risk, descripcion=descriptions.get(risk.nivel.lower()))
        records = [
            detail.albergue, detail.ultimo_registro, sources.condiciones_sanitarias,
            sources.analisis_ia, *sources.intervenciones, *sources.evolucion_epidemiologica,
            *sources.simulaciones_sir,
        ]
        dates = [record.last_updated for record in records if record]
        for timestamp in (
            indicators.ultima_actualizacion, sources.fecha_actualizacion_semaforo,
            sources.alertas.ultima_actualizacion,
        ):
            if timestamp:
                dates.append(timestamp)
        if sources.casos_diarios and sources.casos_diarios.ultima_actualizacion:
            dates.append(sources.casos_diarios.ultima_actualizacion)
        return DashboardView(
            **{item.name: getattr(detail, item.name) for item in fields(detail)},
            semaforo_vital=risk,
            alertas=AlertSummary(
                cantidad=sources.alertas.cantidad,
                por_nivel_riesgo=sources.alertas.por_nivel_riesgo,
            ),
            casos_diarios=sources.casos_diarios,
            condiciones_sanitarias=sources.condiciones_sanitarias,
            analisis_ia=sources.analisis_ia,
            resumen_casos=sources.resumen_casos,
            evolucion_epidemiologica=sources.evolucion_epidemiologica,
            intervenciones=sources.intervenciones,
            simulaciones_sir=sources.simulaciones_sir,
            predicciones=[summarize_simulation(item) for item in sources.simulaciones_sir],
            datos_no_disponibles=["alertas_por_prioridad", "estado_intervenciones"] + (
                [] if sources.simulaciones_sir else ["predicciones", "simulaciones_sir"]
            ),
            ultima_actualizacion=max(dates, default=None),
        )
