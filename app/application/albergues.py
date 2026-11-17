"""Casos de uso de albergues (RF-41, RF-14, RF-15). Sin FastAPI, pydantic ni Mongo."""
from datetime import datetime

from app.domain.albergues import ShelterCreate, ShelterSummary
from app.domain.errors import InsufficientPermissions, ShelterInactive, ShelterNotFound
from app.domain.pagination import ListFilters, Page, Pagination
from app.domain.ports.albergue_repository import AlbergueRepository
from app.domain.shelters import Shelter, ShelterUpdate
from app.domain.users import User, UserRole


class AlbergueService:
    def __init__(self, repository: AlbergueRepository):
        self.repository = repository

    @staticmethod
    def _is_super(actor: User) -> bool:
        return actor.role == UserRole.SUPER_ADMIN

    @staticmethod
    def _is_admin_of(actor: User, shelter_id: str) -> bool:
        return (
            actor.role == UserRole.SHELTER_ADMIN
            and actor.albergue_id is not None
            and str(actor.albergue_id) == str(shelter_id)
        )

    def _require_super(self, actor: User) -> None:
        if not self._is_super(actor):
            raise InsufficientPermissions()

    def _find(self, shelter_id: str) -> Shelter:
        shelter = self.repository.find(shelter_id)
        if shelter is None:
            raise ShelterNotFound()
        return shelter

    def create(self, actor: User, command: ShelterCreate, now: datetime, day: datetime) -> Shelter:
        self._require_super(actor)
        return self.repository.add(command, actor.id, now, day)

    def summary(self, actor: User) -> ShelterSummary:
        self._require_super(actor)
        return self.repository.summary()

    def page(self, actor: User, paging: Pagination, filters: ListFilters, active: bool | None = None) -> Page[Shelter]:
        if self._is_super(actor):
            return self.repository.page_shelters(paging, filters, active)
        if actor.role == UserRole.SHELTER_ADMIN and actor.albergue_id is not None:
            return self.repository.page_shelters(paging, filters, active, str(actor.albergue_id))
        raise InsufficientPermissions()

    def list(self, actor: User, active: bool | None = None) -> list[Shelter]:
        if self._is_super(actor):
            return self.repository.list(active)
        if actor.role == UserRole.SHELTER_ADMIN and actor.albergue_id is not None:
            shelter = self.repository.find(str(actor.albergue_id))
            return [shelter] if shelter else []
        raise InsufficientPermissions()

    def get(self, actor: User, shelter_id: str) -> Shelter:
        if not (self._is_super(actor) or self._is_admin_of(actor, shelter_id)):
            raise InsufficientPermissions()
        return self._find(shelter_id)

    def update(self, actor: User, shelter_id: str, changes: ShelterUpdate, now: datetime) -> Shelter:
        is_super = self._is_super(actor)
        if not (is_super or self._is_admin_of(actor, shelter_id)):
            raise InsufficientPermissions()
        # RF-15: el administrador solo actualiza información básica (capacidad y ubicación).
        if not is_super and changes.nombre is not None:
            raise InsufficientPermissions()
        if not self._find(shelter_id).activo:
            raise ShelterInactive()
        updated = self.repository.update(shelter_id, changes, actor.id, now)
        if updated is None:
            raise ShelterNotFound()
        return updated

    def deactivate(self, actor: User, shelter_id: str, now: datetime) -> Shelter:
        """Desactivación lógica: no borra el albergue ni su historial (RNF-12). Idempotente."""
        self._require_super(actor)
        shelter = self._find(shelter_id)
        if not shelter.activo:
            return shelter
        updated = self.repository.deactivate(shelter_id, actor.id, now)
        if updated is None:
            raise ShelterNotFound()
        return updated
