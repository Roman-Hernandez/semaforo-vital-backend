"""Implementación del repositorio de albergues sobre pymongo."""
from typing import Optional

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, WriteError

from app.domain.albergues import AlbergueDuplicado, AlbergueInvalido

_CODIGO_VALIDACION_ESQUEMA = 121


class MongoAlbergueRepository:
    def __init__(self, database: Database):
        self._col = database["albergues"]

    @staticmethod
    def _oid(valor: str) -> Optional[ObjectId]:
        return ObjectId(valor) if ObjectId.is_valid(valor) else None

    @staticmethod
    def _a_entidad(doc: dict) -> dict:
        entidad = dict(doc)
        entidad["id"] = str(entidad.pop("_id"))
        for campo in ("registrado_por", "updated_by"):
            if entidad.get(campo) is not None:
                entidad[campo] = str(entidad[campo])
        return entidad

    def crear(self, datos: dict) -> dict:
        doc = dict(datos)
        if doc.get("registrado_por") is not None:
            doc["registrado_por"] = ObjectId(doc["registrado_por"])
        try:
            self._col.insert_one(doc)  # agrega _id a doc
        except DuplicateKeyError as exc:
            raise AlbergueDuplicado(
                f"Ya existe un albergue con el código {datos.get('codigo_albergue')}"
            ) from exc
        except WriteError as exc:
            if exc.code == _CODIGO_VALIDACION_ESQUEMA:
                raise AlbergueInvalido("El albergue no cumple el esquema de la base de datos") from exc
            raise
        return self._a_entidad(doc)

    def obtener(self, albergue_id: str) -> Optional[dict]:
        oid = self._oid(albergue_id)
        if oid is None:
            return None
        doc = self._col.find_one({"_id": oid})
        return self._a_entidad(doc) if doc else None

    def listar(self, activo: Optional[bool] = None) -> list[dict]:
        filtro = {} if activo is None else {"activo": activo}
        return [self._a_entidad(d) for d in self._col.find(filtro).sort("codigo_albergue", 1)]

    def actualizar(self, albergue_id: str, cambios: dict) -> Optional[dict]:
        oid = self._oid(albergue_id)
        if oid is None:
            return None
        cambios = dict(cambios)
        if cambios.get("updated_by") is not None:
            cambios["updated_by"] = ObjectId(cambios["updated_by"])
        try:
            doc = self._col.find_one_and_update(
                {"_id": oid}, {"$set": cambios}, return_document=ReturnDocument.AFTER
            )
        except WriteError as exc:
            if exc.code == _CODIGO_VALIDACION_ESQUEMA:
                raise AlbergueInvalido("El albergue no cumple el esquema de la base de datos") from exc
            raise
        return self._a_entidad(doc) if doc else None