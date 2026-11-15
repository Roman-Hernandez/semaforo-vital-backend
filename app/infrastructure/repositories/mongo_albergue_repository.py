"""Repositorio administrativo de albergues sobre pymongo (reutiliza el mapeo de Shelter)."""
from dataclasses import asdict
from datetime import datetime

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, WriteError

from app.domain.albergues import ShelterCreate
from app.domain.errors import DuplicateShelterCode, InvalidShelterData
from app.domain.shelters import Shelter, ShelterUpdate
from app.infrastructure.repositories.mongo_shelter_repository import (
    _persistence,
    _shelter,
)

_SCHEMA_VALIDATION_ERROR = 121


def _oid(value: str) -> ObjectId | None:
    return ObjectId(value) if ObjectId.is_valid(value) else None


def _location(value: dict) -> dict:
    value["coordenadas"]["coordinates"] = list(value["coordenadas"]["coordinates"])
    return value


class MongoAlbergueRepository:
    def __init__(self, database: Database):
        self._col = database["albergues"]

    @_persistence
    def add(self, command: ShelterCreate, user_id: str, now: datetime, day: datetime) -> Shelter:
        document = {
            "codigo_albergue": command.codigo_albergue,
            "nombre": command.nombre,
            "ubicacion": _location(asdict(command.ubicacion)),
            "capacidad_instalada": command.capacidad_instalada,
            "activo": True,
            "registrado_por": ObjectId(user_id),
            "fecha": day,
            "created_at": now,
        }
        try:
            self._col.insert_one(document)  # agrega _id
        except DuplicateKeyError as exc:
            raise DuplicateShelterCode() from exc
        except WriteError as exc:
            if exc.code == _SCHEMA_VALIDATION_ERROR:
                raise InvalidShelterData() from exc
            raise
        return _shelter(document)

    @_persistence
    def find(self, shelter_id: str) -> Shelter | None:
        oid = _oid(shelter_id)
        return _shelter(self._col.find_one({"_id": oid})) if oid else None

    @_persistence
    def list(self, active: bool | None = None) -> list[Shelter]:
        query = {} if active is None else {"activo": active}
        return [_shelter(doc) for doc in self._col.find(query).sort("codigo_albergue", 1)]

    def _set(self, shelter_id: str, values: dict, user_id: str, now: datetime) -> Shelter | None:
        oid = _oid(shelter_id)
        if oid is None:
            return None
        try:
            document = self._col.find_one_and_update(
                {"_id": oid},
                {"$set": {**values, "updated_by": ObjectId(user_id), "updated_at": now}},
                return_document=ReturnDocument.AFTER,
            )
        except WriteError as exc:
            if exc.code == _SCHEMA_VALIDATION_ERROR:
                raise InvalidShelterData() from exc
            raise
        return _shelter(document)

    @_persistence
    def update(
        self, shelter_id: str, changes: ShelterUpdate, user_id: str, now: datetime,
    ) -> Shelter | None:
        values = {key: value for key, value in asdict(changes).items() if value is not None}
        if "ubicacion" in values:
            _location(values["ubicacion"])
        return self._set(shelter_id, values, user_id, now)

    @_persistence
    def deactivate(self, shelter_id: str, user_id: str, now: datetime) -> Shelter | None:
        return self._set(shelter_id, {"activo": False}, user_id, now)
