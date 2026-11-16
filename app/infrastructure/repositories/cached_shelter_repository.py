from datetime import datetime

from pymongo.database import Database
from redis import Redis

from app.domain.ports.shelter_repository import ShelterRepository
from app.domain.shelters import (
    DashboardSources,
    IntradayOccupancy,
    PopulationRecord,
    Shelter,
    ShelterIndicators,
    ShelterUpdate,
    TrafficLight,
)
from app.infrastructure.cache.semaforo_cache import (
    get_semaforo_snapshot,
    invalidate_semaforo_snapshot,
)


def _datetime_from_cache(
    value: str | None,
) -> datetime | None:
    if value is None:
        return None

    try:
        return datetime.fromisoformat(
            value
        )
    except (TypeError, ValueError):
        return None


class CachedShelterRepository:
    """
    Decorador del repositorio de albergues.

    MongoDB continúa siendo la fuente de verdad.

    Redis solamente acelera la lectura de:

        latest_metrics()
    """

    def __init__(
        self,
        repository: ShelterRepository,
        database: Database,
        redis_client: Redis | None,
    ):
        self.repository = repository
        self.database = database
        self.redis_client = redis_client

    def find(
        self,
        shelter_id: str,
    ) -> Shelter | None:
        return self.repository.find(
            shelter_id
        )

    def update(
        self,
        shelter_id: str,
        changes: ShelterUpdate,
        user_id: str,
        now: datetime,
    ) -> Shelter | None:

        result = self.repository.update(
            shelter_id,
            changes,
            user_id,
            now,
        )

        if result is not None:
            invalidate_semaforo_snapshot(
                self.redis_client,
                shelter_id,
            )

        return result

    def population_history(
        self,
        shelter_id: str,
        limit: int,
        offset: int,
    ) -> list[PopulationRecord]:
        return self.repository.population_history(
            shelter_id,
            limit,
            offset,
        )

    def save_population(
        self,
        shelter_id: str,
        user_id: str,
        day: datetime,
        population: int,
        now: datetime,
    ) -> PopulationRecord:
        return self.repository.save_population(
            shelter_id,
            user_id,
            day,
            population,
            now,
        )

    def latest_metrics(
        self,
        shelter_id: str,
    ) -> ShelterIndicators:

        snapshot = get_semaforo_snapshot(
            self.database,
            self.redis_client,
            shelter_id,
        )

        if snapshot is None:
            return ShelterIndicators()

        ultima_medicion = snapshot.get(
            "ultima_medicion"
        )

        ocupacion = None

        if ultima_medicion is not None:

            ocupacion = IntradayOccupancy(
                porcentaje_ocupacion=(
                    snapshot.get(
                        "porcentaje_ocupacion"
                    )
                ),
                personas_alojadas=(
                    ultima_medicion.get(
                        "personas_alojadas"
                    )
                ),
                fecha_hora=_datetime_from_cache(
                    ultima_medicion.get(
                        "fecha_hora"
                    )
                ),
            )

        nivel = snapshot.get(
            "nivel_semaforo"
        )

        semaforo = None

        if nivel is not None:

            semaforo = TrafficLight(
                nivel=nivel,
                codigo=snapshot.get(
                    "codigo_semaforo"
                ),
                estado_semaforo_id=snapshot.get(
                    "estado_semaforo_id"
                ),
                fecha_calculo=_datetime_from_cache(
                    snapshot.get(
                        "fecha_calculo"
                    )
                ),
            )

        return ShelterIndicators(
            ocupacion=ocupacion,
            semaforo=semaforo,
            alertas_activas=snapshot.get(
                "alertas_activas"
            ),
            ultima_actualizacion=_datetime_from_cache(
                snapshot.get(
                    "ultima_actualizacion"
                )
            ),
        )

    def dashboard_sources(
        self,
        shelter_id: str,
        limit: int,
    ) -> DashboardSources:
        return self.repository.dashboard_sources(
            shelter_id,
            limit,
        )