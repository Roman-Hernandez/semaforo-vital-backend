"""Registro diario consolidado por albergue y fecha (RF-16 a RF-19)."""
import math
from dataclasses import dataclass
from datetime import datetime

from app.domain.errors import InvalidDailyRecord
from app.domain.shelters import Trace

MAX_INT32 = 2_147_483_647
# Límite provisional: el contrato no define un máximo para litros_agua.
MAX_WATER_LITERS = 1_000_000_000


def _count(value) -> None:
    if type(value) is not int or not 0 <= value <= MAX_INT32:
        raise InvalidDailyRecord()


def _liters(value) -> None:
    if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= MAX_WATER_LITERS:
        raise InvalidDailyRecord()


@dataclass(frozen=True, kw_only=True)
class DailyRecordCreate:
    fecha: datetime
    poblacion: int
    litros_agua: float
    letrinas: int
    casos_eda: int
    casos_ira: int

    def __post_init__(self):
        for value in (self.poblacion, self.letrinas, self.casos_eda, self.casos_ira):
            _count(value)
        _liters(self.litros_agua)


@dataclass(frozen=True, kw_only=True)
class DailyRecord(Trace):
    albergue_id: str
    fecha: datetime
    poblacion: int
    litros_agua: float
    letrinas: int
    casos_eda: int
    casos_ira: int
