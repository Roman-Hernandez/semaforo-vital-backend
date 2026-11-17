"""Puerto del repositorio administrativo de albergues. Solo entidades de dominio."""
from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.domain.albergues import ShelterCreate, ShelterSummary
from app.domain.pagination import ListFilters, PaginatedResult, Pagination
from app.domain.public_shelters import PublicAlert, PublicShelter
from app.domain.shelters import Shelter, ShelterUpdate


class AlbergueRepository(Protocol):
    def add(self, command: ShelterCreate, user_id: str, now: datetime, day: datetime) -> Shelter:
        """Inserta el albergue. Lanza DuplicateShelterCode si el código ya existe."""
        ...

    def find(self, shelter_id: str) -> Shelter | None:
        """Devuelve el albergue o None (también si el id no es válido)."""
        ...

    def list(self, active: bool | None = None) -> list[Shelter]:
        """Lista albergues ordenados por código; `active` filtra si se indica."""
        ...

    def update(
        self, shelter_id: str, changes: ShelterUpdate, user_id: str, now: datetime,
    ) -> Shelter | None: ...

    def deactivate(self, shelter_id: str, user_id: str, now: datetime) -> Shelter | None:
        """Desactivación lógica: no borra el documento ni su historial."""
        ...


    def list_public(self, limit: int, offset: int, shelter_id: str | None = None) -> list[PublicShelter]: ...

    def public_alerts(self, limit: int, offset: int, shelter_id: str | None = None) -> list[PublicAlert]: ...

    def page_shelters(self, paging: Pagination, filters: ListFilters, active: bool | None = None,
                      shelter_id: str | None = None) -> PaginatedResult[Shelter]: ...

    def page_public_shelters(self, paging: Pagination, filters: ListFilters) -> PaginatedResult[PublicShelter]: ...

    def page_public_alerts(self, paging: Pagination, filters: ListFilters,
                           shelter_id: str | None = None, active: bool | None = None) -> PaginatedResult[PublicAlert]: ...

    def summary(self) -> ShelterSummary: ...
