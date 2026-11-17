"""Resultados SIR automáticos a partir de observaciones del albergue, sin parámetros del usuario."""
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from app.domain.errors import ShelterNotFound
from app.domain.pagination import PaginatedResult, Pagination
from app.domain.ports.shelter_repository import ShelterRepository
from app.domain.shelters import DiseaseRecord, PopulationRecord, assigned_shelter
from app.domain.sir import SIRSettings, solve_sir
from app.domain.sir_estimation import (
    EstimatedSIR,
    IncompatibleSIRHistory,
    InsufficientSIRHistory,
    SIRObservation,
    estimate_sir,
)
from app.domain.users import User

_BOGOTA = ZoneInfo("America/Bogota")


@dataclass(frozen=True)
class SIRProjectedDay:
    dia: int
    fecha: date
    susceptibles: float
    infectados: float
    recuperados: float


@dataclass(frozen=True)
class SIRForecastSummary:
    pico_infectados_en_horizonte: float
    fecha_pico_en_horizonte: date
    infectados_finales: float
    recuperados_finales: float
    r_efectivo_inicial: float | None
    error_maximo_poblacion: float


@dataclass(frozen=True)
class SIRDiseaseResult:
    enfermedad: str
    estado: Literal["estimacion_disponible", "datos_insuficientes", "datos_incompatibles", "sin_casos_activos"]
    motivos: list[str]
    datos_faltantes: list[str]
    observado: list[SIRObservation]
    proyeccion: list[SIRProjectedDay]
    parametros_estimados: EstimatedSIR | None
    resumen: SIRForecastSummary | None


@dataclass(frozen=True)
class SIRResult:
    albergue_id: str
    albergue_nombre: str
    poblacion_actual: int | None
    fecha_poblacion: datetime | None
    generado_en: datetime
    horizonte_dias: int
    ventana_datos_dias: int
    metodo_numerico: str
    datos_faltantes: list[str]
    resultados: PaginatedResult[SIRDiseaseResult]
    supuestos: tuple[str, ...]


def _day(value: datetime) -> date:
    return value.astimezone(_BOGOTA).date()


def _observations(cases: list[DiseaseRecord], populations: list[PopulationRecord]) -> list[SIRObservation]:
    # Última corrección de cada fecha, sin sumar snapshots del mismo día.
    days: dict[date, DiseaseRecord] = {}
    for row in sorted(cases, key=lambda r: (r.fecha, r.last_updated, r.id)):
        days[_day(row.fecha)] = row
    ordered_populations = sorted(populations, key=lambda r: (r.fecha, r.last_updated, r.id), reverse=True)
    observations = []
    for day, row in sorted(days.items()):
        population = next((p for p in ordered_populations if _day(p.fecha) <= day), None)
        observations.append(SIRObservation(day, population.poblacion if population else None,
            row.cantidad_casos_activos, row.cantidad_recuperados, row.id, population.id if population else None))
    return observations


class SIRService:
    def __init__(self, repository: ShelterRepository, *, horizon_days: int = 14,
                 history_days: int = 28, max_age_days: int = 7):
        self.repository = repository
        self.horizon_days = horizon_days
        self.history_days = history_days
        self.max_age_days = max_age_days

    def results(self, user: User, now: datetime, enfermedad: str | None = None, paging: Pagination | None = None) -> SIRResult:
        paging = paging or Pagination()
        shelter_id = assigned_shelter(user)
        shelter = self.repository.find(shelter_id)
        if shelter is None:
            raise ShelterNotFound()
        populations = [p for p in self.repository.population_history(shelter_id, 365, 0) if p.fecha <= now]
        latest = max(populations, key=lambda p: (p.fecha, p.last_updated, p.id)) if populations else None
        since = now - timedelta(days=self.history_days)
        diseases = self.repository.page_sir_diseases(shelter_id, since, now, paging, enfermedad)
        rows = self.repository.sir_history(shelter_id, since, now, diseases.items) if diseases.items else []
        groups: dict[str, list[DiseaseRecord]] = {}
        for row in rows:
            key = row.enfermedad.strip().casefold()
            if enfermedad is None or key == enfermedad.strip().casefold():
                groups.setdefault(key, []).append(row)
        results = [self._forecast(group[-1].enfermedad.strip(), _observations(group, populations), latest, now)
                   for _, group in sorted(groups.items())]
        missing = []
        if latest is None or latest.poblacion <= 0:
            missing.append("poblacion_actual")
        if not diseases.total:
            missing.append("casos_enfermedades")
        return SIRResult(shelter_id, shelter.nombre, latest.poblacion if latest else None,
            latest.fecha if latest else None, now, self.horizon_days, self.history_days, "RK4", missing, PaginatedResult.create(results, paging, diseases.total),
            ("Estimación determinista ajustada a observaciones; no es una predicción clínicamente validada",
             "Población cerrada, mezcla homogénea, tasas constantes y sin reinfecciones durante el horizonte",
             "No se transforma la ausencia de un registro en cero ni se usan parámetros de demostración"))

    def _forecast(self, disease: str, observations: list[SIRObservation],
                  latest_population: PopulationRecord | None, now: datetime) -> SIRDiseaseResult:
        def unavailable(state, message, missing=()):
            return SIRDiseaseResult(disease, state, [message], list(missing), observations, [], None, None)
        missing = []
        if any(row.recuperados is None for row in observations):
            missing.append("cantidad_recuperados")
        if any(row.poblacion is None for row in observations):
            missing.append("poblacion_historica")
        if len(observations) < 4:
            missing.append("historial_minimo_4_fechas")
        if missing:
            return unavailable("datos_insuficientes", "Complete los registros sanitarios indicados para estimar el modelo automáticamente", missing)
        last = observations[-1]
        if (_day(now) - last.fecha).days > self.max_age_days:
            return unavailable("datos_insuficientes", "Actualice los casos: el último registro tiene más de 7 días", ["casos_recientes"])
        if latest_population is None or latest_population.poblacion != last.poblacion:
            return unavailable("datos_insuficientes", "La población cambió después del último registro de casos", ["casos_con_poblacion_actual"])
        if (_day(now) - _day(latest_population.fecha)).days > self.max_age_days:
            return unavailable("datos_insuficientes", "Actualice el registro de población", ["poblacion_reciente"])
        try:
            estimated = estimate_sir(observations)
        except InsufficientSIRHistory as error:
            return unavailable("datos_insuficientes", str(error), ["serie_para_estimacion"])
        except IncompatibleSIRHistory as error:
            return unavailable("datos_incompatibles", str(error))
        if last.infectados == 0:
            return unavailable("sin_casos_activos", "El último registro no tiene casos activos; SIR no estima la introducción de nuevos contagios externos")
        run = solve_sir(SIRSettings(poblacion_total=last.poblacion,
            infectados_iniciales=last.infectados, recuperados_iniciales=last.recuperados,
            beta=estimated.beta, gamma=estimated.gamma, dias_simulacion=self.horizon_days,
            paso_tiempo=0.1, reduccion_beta=0))
        points = [SIRProjectedDay(point.dia, last.fecha + timedelta(days=point.dia),
            point.susceptibles, point.infectados, point.recuperados) for point in run.curva]
        r_effective = estimated.beta / estimated.gamma * last.susceptibles / last.poblacion if estimated.gamma else None
        summary = SIRForecastSummary(run.pico_infectados, last.fecha + timedelta(days=run.dia_pico),
            points[-1].infectados, points[-1].recuperados, r_effective, run.error_maximo_poblacion)
        return SIRDiseaseResult(disease, "estimacion_disponible", [], [], observations, points, estimated, summary)
