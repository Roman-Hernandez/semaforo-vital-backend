from __future__ import annotations

from app.domain.errors import ShelterNotFound
from app.domain.pagination import ListFilters, Page, Pagination
from app.domain.ports.albergue_repository import AlbergueRepository
from app.domain.public_shelters import PublicAlert, PublicShelter


class PublicShelterService:
    def __init__(self, repository: AlbergueRepository):
        self.repository = repository

    def page(self, paging: Pagination, filters: ListFilters) -> Page[PublicShelter]:
        return self.repository.page_public_shelters(paging, filters)

    def alerts_page(self, paging: Pagination, filters: ListFilters,
                    shelter_id: str | None = None, active: bool | None = None) -> Page[PublicAlert]:
        if shelter_id is not None:
            self.get(shelter_id)
        return self.repository.page_public_alerts(paging, filters, shelter_id, active)

    def list(self, limit: int, offset: int) -> list[PublicShelter]:
        return self.repository.list_public(limit, offset)

    def get(self, shelter_id: str) -> PublicShelter:
        shelters = self.repository.list_public(1, 0, shelter_id)
        if not shelters:
            raise ShelterNotFound()
        return shelters[0]

    def alerts(self, limit: int, offset: int, shelter_id: str | None = None) -> list[PublicAlert]:
        if shelter_id is not None:
            self.get(shelter_id)
        return self.repository.public_alerts(limit, offset, shelter_id)
