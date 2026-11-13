from dataclasses import asdict, dataclass, field, fields, replace
from datetime import datetime

from app.domain.errors import ShelterNotFound
from app.domain.ports.shelter_repository import ShelterRepository
from app.domain.shelters import (
    DashboardSources, IntradayOccupancy, Occupancy, PopulationRecord, Shelter,
    ShelterIndicators, ShelterUpdate, TrafficLight, assigned_shelter, occupancy,
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
    cantidad: int | None
    por_prioridad: None = None


@dataclass(frozen=True, kw_only=True)
class DashboardView(ShelterDetail, DashboardSources):
    semaforo_vital: TrafficLight | None
    alertas: AlertSummary
    ultima_actualizacion: datetime | None
    # No module currently produces these results; only empty lists are supported.
    predicciones: list[None] = field(default_factory=list)
    simulaciones_sir: list[None] = field(default_factory=list)
    datos_no_disponibles: list[str] = field(default_factory=lambda: [
        "alertas_por_prioridad", "predicciones", "simulaciones_sir", "estado_intervenciones",
    ])


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
        risk = indicators.semaforo
        descriptions = {"verde": "Riesgo bajo", "amarillo": "Riesgo medio", "rojo": "Riesgo crítico"}
        if risk:
            risk = replace(risk, descripcion=descriptions.get(risk.nivel.lower()))
        records = [
            detail.albergue, detail.ultimo_registro, sources.condiciones_sanitarias,
            sources.analisis_ia, *sources.intervenciones, *sources.evolucion_epidemiologica,
        ]
        dates = [record.last_updated for record in records if record]
        if indicators.ultima_actualizacion:
            dates.append(indicators.ultima_actualizacion)
        if sources.casos_diarios and sources.casos_diarios.ultima_actualizacion:
            dates.append(sources.casos_diarios.ultima_actualizacion)
        return DashboardView(
            **{item.name: getattr(detail, item.name) for item in fields(detail)},
            **{item.name: getattr(sources, item.name) for item in fields(sources)},
            semaforo_vital=risk,
            alertas=AlertSummary(cantidad=indicators.alertas_activas),
            ultima_actualizacion=max(dates, default=None),
        )
