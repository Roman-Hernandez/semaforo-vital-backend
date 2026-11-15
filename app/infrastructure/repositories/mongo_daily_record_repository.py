"""Repositorio de registros diarios sobre pymongo. Solo inserta y consulta: nunca borra histórico."""
from datetime import datetime

from bson import ObjectId
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, WriteError

from app.domain.daily_records import DailyRecord, DailyRecordCreate
from app.domain.errors import DuplicateDailyRecord, InvalidDailyRecord
from app.infrastructure.repositories.mongo_shelter_repository import (
    _persistence,
    _plain,
    _trace,
)

_SCHEMA_VALIDATION_ERROR = 121


def _daily_record(document: dict | None) -> DailyRecord | None:
    if document is None:
        return None
    document = _plain(document)
    return DailyRecord(
        **_trace(document), albergue_id=document["albergue_id"], fecha=document["fecha"],
        poblacion=document["poblacion"], litros_agua=float(document["litros_agua"]),
        letrinas=document["letrinas"], casos_eda=document["casos_eda"],
        casos_ira=document["casos_ira"],
    )


class MongoDailyRecordRepository:
    def __init__(self, database: Database):
        self._col = database["registros_diarios"]

    @_persistence
    def add(
        self, shelter_id: str, user_id: str, command: DailyRecordCreate, now: datetime,
    ) -> DailyRecord:
        document = {
            "albergue_id": ObjectId(shelter_id),
            "fecha": command.fecha,
            "poblacion": command.poblacion,
            "litros_agua": float(command.litros_agua),
            "letrinas": command.letrinas,
            "casos_eda": command.casos_eda,
            "casos_ira": command.casos_ira,
            "registrado_por": ObjectId(user_id),
            "created_at": now,
        }
        try:
            self._col.insert_one(document)  # agrega _id
        except DuplicateKeyError as exc:
            raise DuplicateDailyRecord() from exc
        except WriteError as exc:
            if exc.code == _SCHEMA_VALIDATION_ERROR:
                raise InvalidDailyRecord() from exc
            raise
        return _daily_record(document)

    @_persistence
    def find_by_day(self, shelter_id: str, day: datetime) -> DailyRecord | None:
        return _daily_record(
            self._col.find_one({"albergue_id": ObjectId(shelter_id), "fecha": day})
        )

    @_persistence
    def history(self, shelter_id: str, limit: int, offset: int) -> list[DailyRecord]:
        cursor = self._col.find({"albergue_id": ObjectId(shelter_id)})
        cursor = cursor.sort([("fecha", -1), ("_id", -1)]).skip(offset).limit(limit)
        return [_daily_record(document) for document in cursor]
