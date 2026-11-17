from datetime import datetime
from typing import Protocol

from app.domain.pagination import ListFilters, Page, Pagination
from app.domain.shelters import (
    DashboardSources,
    DiseaseRecord,
    PopulationRecord,
    RecordInput,
    RecordKind,
    Shelter,
    ShelterIndicators,
    ShelterRecord,
    ShelterUpdate,
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

    def list_records(self, shelter_id: str, kind: RecordKind, limit: int, offset: int) -> list[ShelterRecord]: ...

    def save_record(self, shelter_id: str, kind: RecordKind, command: RecordInput,
                    user_id: str, now: datetime, record_id: str | None = None) -> ShelterRecord | None: ...


    def sir_history(self, shelter_id: str, since: datetime, until: datetime, diseases: list[str] | None = None) -> list[DiseaseRecord]: ...

    def page_records(self, shelter_id: str, kind: RecordKind, paging: Pagination, filters: ListFilters) -> Page[ShelterRecord]: ...

    def page_population(self, shelter_id: str, paging: Pagination, filters: ListFilters) -> Page[PopulationRecord]: ...

    def page_sir_diseases(self, shelter_id: str, since: datetime, until: datetime,
                          paging: Pagination, disease: str | None = None) -> Page[str]: ...
