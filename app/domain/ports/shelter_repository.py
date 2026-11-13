from datetime import datetime
from typing import Protocol

from app.domain.shelters import (
    DashboardSources, PopulationRecord, Shelter, ShelterIndicators, ShelterUpdate,
)


class ShelterRepository(Protocol):
    def find(self, shelter_id: str) -> Shelter | None: ...

    def update(
        self, shelter_id: str, changes: ShelterUpdate, user_id: str, now: datetime,
    ) -> Shelter | None: ...

    def population_history(
        self, shelter_id: str, limit: int, offset: int,
    ) -> list[PopulationRecord]: ...

    def save_population(
        self, shelter_id: str, user_id: str, day: datetime, population: int, now: datetime,
    ) -> PopulationRecord: ...

    def latest_metrics(self, shelter_id: str) -> ShelterIndicators: ...

    def dashboard_sources(self, shelter_id: str, limit: int) -> DashboardSources: ...
