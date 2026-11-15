"""Casos de uso de registros diarios. Sin FastAPI, pydantic ni Mongo."""
from datetime import datetime

from app.domain.daily_records import DailyRecord, DailyRecordCreate
from app.domain.errors import (
    DailyRecordNotFound,
    InvalidDailyRecord,
    ShelterInactive,
    ShelterNotFound,
)
from app.domain.ports.daily_record_repository import DailyRecordRepository
from app.domain.ports.shelter_repository import ShelterRepository
from app.domain.shelters import Shelter, assigned_shelter
from app.domain.users import User


class DailyRecordService:
    """El albergue y el responsable salen del usuario autenticado, nunca del cuerpo."""

    def __init__(self, records: DailyRecordRepository, shelters: ShelterRepository):
        self.records = records
        self.shelters = shelters

    def _own_shelter(self, user: User) -> Shelter:
        shelter = self.shelters.find(assigned_shelter(user))
        if shelter is None:
            raise ShelterNotFound()
        return shelter

    def create(self, user: User, command: DailyRecordCreate, now: datetime) -> DailyRecord:
        shelter = self._own_shelter(user)
        if not shelter.activo:
            raise ShelterInactive()
        if command.fecha > now:  # la fecha es 00:00 del día en Bogotá: un día futuro queda después de `now`
            raise InvalidDailyRecord()
        return self.records.add(shelter.id, user.id, command, now)

    def history(self, user: User, limit: int, offset: int) -> list[DailyRecord]:
        shelter = self._own_shelter(user)
        return self.records.history(shelter.id, limit, offset)

    def get(self, user: User, day: datetime) -> DailyRecord:
        shelter = self._own_shelter(user)
        record = self.records.find_by_day(shelter.id, day)
        if record is None:
            raise DailyRecordNotFound()
        return record
