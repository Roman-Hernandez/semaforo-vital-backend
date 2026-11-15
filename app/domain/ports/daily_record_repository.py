"""Puerto del repositorio de registros diarios. Solo entidades de dominio."""
from datetime import datetime
from typing import Protocol

from app.domain.daily_records import DailyRecord, DailyRecordCreate


class DailyRecordRepository(Protocol):
    def add(
        self, shelter_id: str, user_id: str, command: DailyRecordCreate, now: datetime,
    ) -> DailyRecord:
        """Inserta el registro. Lanza DuplicateDailyRecord si ya existe uno para ese albergue y día."""
        ...

    def find_by_day(self, shelter_id: str, day: datetime) -> DailyRecord | None: ...

    def history(self, shelter_id: str, limit: int, offset: int) -> list[DailyRecord]:
        """Registros del albergue, del más reciente al más antiguo."""
        ...
