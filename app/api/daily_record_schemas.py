"""Contratos HTTP de los registros diarios, independientes del almacenamiento."""
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.api.shelter_schemas import NonNegativeInt, TraceResponse
from app.domain.daily_records import MAX_WATER_LITERS, DailyRecordCreate

Liters = Annotated[float, Field(ge=0, le=MAX_WATER_LITERS, allow_inf_nan=False)]


class DailyRecordRequest(BaseModel):
    """`albergue_id` y `registrado_por` no se aceptan: salen del usuario autenticado."""

    model_config = ConfigDict(extra="forbid")
    fecha: date
    poblacion: NonNegativeInt
    litros_agua: Liters
    letrinas: NonNegativeInt
    casos_eda: NonNegativeInt
    casos_ira: NonNegativeInt

    def to_command(self, day: datetime) -> DailyRecordCreate:
        return DailyRecordCreate(
            fecha=day, poblacion=self.poblacion, litros_agua=self.litros_agua,
            letrinas=self.letrinas, casos_eda=self.casos_eda, casos_ira=self.casos_ira,
        )


class DailyRecordResponse(TraceResponse):
    albergue_id: str
    fecha: datetime
    poblacion: int
    litros_agua: float
    letrinas: int
    casos_eda: int
    casos_ira: int
