from collections.abc import Callable
from dataclasses import replace
from datetime import datetime

from app.domain.errors import (
    InsufficientPermissions,
    ShelterInactive,
    ShelterNotFound,
    UserNotFound,
)
from app.domain.pagination import ListFilters, PaginatedResult, Pagination
from app.domain.ports.albergue_repository import AlbergueRepository
from app.domain.ports.user_repository import UserRepository
from app.domain.users import AdministratorChanges, AdministratorDetails, User, UserRole


class AdministratorService:
    def __init__(self, users: UserRepository, shelters: AlbergueRepository, hash_password: Callable[[str], str]):
        self.users = users
        self.shelters = shelters
        self.hash_password = hash_password

    @staticmethod
    def _authorize(actor: User):
        if not actor.active or actor.role != UserRole.SUPER_ADMIN:
            raise InsufficientPermissions()

    def _target(self, user_id: str) -> User:
        user = self.users.find_by_id(user_id)
        if user is None or user.role != UserRole.SHELTER_ADMIN:
            raise UserNotFound()
        return user

    def _shelter(self, shelter_id: str | None):
        if shelter_id is None:
            return
        shelter = self.shelters.find(shelter_id)
        if shelter is None:
            raise ShelterNotFound()
        if not shelter.activo:
            raise ShelterInactive()

    def page(self, actor: User, paging: Pagination, filters: ListFilters, active: bool | None = None) -> PaginatedResult[User]:
        self._authorize(actor)
        return self.users.page_admins(paging, filters, active)

    def list(self, actor: User, limit: int, offset: int) -> list[User]:
        self._authorize(actor)
        return self.users.list_admins(limit, offset)

    def get(self, actor: User, user_id: str) -> User:
        self._authorize(actor)
        return self._target(user_id)

    def create(self, actor: User, details: AdministratorDetails, password: str, now: datetime) -> User:
        self._authorize(actor)
        self._shelter(details.albergue_id)
        return self.users.add_admin(details, self.hash_password(password), actor.id, now)

    def update(self, actor: User, user_id: str, changes: AdministratorChanges, now: datetime,
               password: str | None = None) -> User:
        self._authorize(actor)
        self._target(user_id)
        if password is not None:
            changes = replace(changes, password_hash=self.hash_password(password))
        result = self.users.update_admin(user_id, changes, actor.id, now)
        if result is None:
            raise UserNotFound()
        return result

    def assign(self, actor: User, user_id: str, shelter_id: str | None, now: datetime) -> User:
        self._authorize(actor)
        self._target(user_id)
        self._shelter(shelter_id)
        result = self.users.assign_admin(user_id, shelter_id, actor.id, now)
        if result is None:
            raise UserNotFound()
        return result
