"""Puerto del repositorio administrativo de albergues. Solo entidades de dominio."""
from datetime import datetime
from typing import Protocol

from app.domain.albergues import ShelterCreate
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
