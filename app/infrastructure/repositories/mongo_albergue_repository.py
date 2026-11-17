"""Repositorio administrativo de albergues sobre pymongo (reutiliza el mapeo de Shelter)."""
from __future__ import annotations

from dataclasses import asdict, replace
from datetime import datetime

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, WriteError

from app.domain.albergues import ShelterCreate, ShelterSummary
from app.domain.errors import DuplicateShelterCode, InvalidShelterData
from app.domain.pagination import ListFilters, Page, Pagination
from app.domain.public_shelters import (
    PublicAlert,
    PublicSanitaryConditions,
    PublicShelter,
)
from app.domain.shelters import Shelter, ShelterUpdate, occupancy
from app.infrastructure.database.errors import persistence_guard as _persistence
from app.infrastructure.database.pagination import (
    filtered_query,
    paginate_aggregate,
    paginate_find,
)
from app.infrastructure.repositories.mongo_shelter_repository import (
    _location as _domain_location,
)
from app.infrastructure.repositories.mongo_shelter_repository import (
    _plain,
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
        self.database = database
        self._col = database["albergues"]

    def _with_administrators(self, shelters: list[Shelter]) -> list[Shelter]:
        if not shelters:
            return []
        # La relación vive en usuarios.albergue_id; una sola consulta para todo el listado.
        users = self.database.usuarios.find(
            {"albergue_id": {"$in": [ObjectId(shelter.id) for shelter in shelters]},
             "role": "administrador_albergue"},
            {"albergue_id": 1, "nombre": 1, "apellido": 1, "email": 1},
        ).sort([("nombre", 1), ("apellido", 1), ("_id", 1)])
        names: dict[str, list[str]] = {}
        for user in users:
            name = " ".join(str(user.get(key) or "").strip() for key in ("nombre", "apellido")).strip()
            names.setdefault(str(user["albergue_id"]), []).append(name or user.get("email") or "Administrador")
        return [replace(shelter, administrador=", ".join(names.get(shelter.id, [])) or None) for shelter in shelters]

    def _enrich_shelters(self, shelters: list[Shelter]) -> list[Shelter]:
        if not shelters:
            return []
        shelters = self._with_administrators(shelters)
        ids = [ObjectId(shelter.id) for shelter in shelters]
        values = {}
        for collection, date_field, field, name in (
            ("historial_poblacion", "fecha", "poblacion", "population"),
            ("estados_semaforo", "fecha_calculo", "nivel", "risk"),
        ):
            documents = self.database[collection].aggregate([
                {"$match": {"albergue_id": {"$in": ids}}},
                {"$sort": {"albergue_id": 1, date_field: -1, "_id": -1}},
                {"$group": {"_id": "$albergue_id", "value": {"$first": "$" + field}}},
            ])
            values[name] = {str(row["_id"]): row["value"] for row in documents}
        return [replace(shelter, poblacion_actual=values["population"].get(shelter.id),
                        nivel_riesgo=values["risk"].get(shelter.id)) for shelter in shelters]

    @_persistence
    def add(self, command: ShelterCreate, user_id: str, now: datetime, day: datetime) -> Shelter:
        oid = ObjectId()
        document = {
            "_id": oid,
            "codigo_albergue": f"ALB-{str(oid).upper()}",
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
        shelter = _shelter(self._col.find_one({"_id": oid})) if oid else None
        return self._enrich_shelters([shelter])[0] if shelter else None

    @_persistence
    def list(self, active: bool | None = None) -> list[Shelter]:
        query = {} if active is None else {"activo": active}
        return self._with_administrators([_shelter(doc) for doc in self._col.find(query).sort("codigo_albergue", 1)])

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
        return self._enrich_shelters([_shelter(document)])[0] if document else None

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


    @_persistence
    def list_public(self, limit: int, offset: int, shelter_id: str | None = None) -> list[PublicShelter]:
        query = {"activo": True}
        if shelter_id is not None:
            oid = _oid(shelter_id)
            if oid is None:
                return []
            query["_id"] = oid
        pipeline = [{"$match": query}, {"$sort": {"codigo_albergue": 1, "_id": 1}},
                    {"$skip": offset}, {"$limit": limit},
                    {"$project": {"codigo_albergue": 1, "nombre": 1, "ubicacion": 1, "capacidad_instalada": 1}}]
        # Each lookup is scoped to one shelter and reads only its latest public summary.
        for collection, date_field, fields, alias in (
            ("historial_poblacion", "fecha", {"poblacion": 1}, "population"),
            ("estados_semaforo", "fecha_calculo", {"nivel": 1, "fecha_calculo": 1}, "risk"),
            ("condiciones_sanitarias", "fecha", {"fecha": 1, "agua_potable_disponible": 1,
                "banos_disponibles": 1, "estado_higiene": 1, "estado_saneamiento": 1}, "sanitary"),
        ):
            pipeline.append({"$lookup": {
                "from": collection, "localField": "_id", "foreignField": "albergue_id",
                "pipeline": [{"$sort": {date_field: -1, "_id": -1}}, {"$limit": 1},
                             {"$project": {"_id": 0, **fields}}], "as": alias,
            }})
        return [self._public_shelter(raw) for raw in self._col.aggregate(pipeline)]

    @staticmethod
    def _public_shelter(raw) -> PublicShelter:
        doc = _plain(raw)
        population = doc["population"][0]["poblacion"] if doc["population"] else None
        risk = doc["risk"][0] if doc["risk"] else None
        sanitary = doc["sanitary"][0] if doc["sanitary"] else None
        return PublicShelter(
            id=doc["id"], codigo_albergue=doc["codigo_albergue"], nombre=doc["nombre"],
            ubicacion=_domain_location(doc["ubicacion"]), capacidad_instalada=doc["capacidad_instalada"],
            **asdict(occupancy(doc["capacidad_instalada"], population)),
            nivel_riesgo=risk["nivel"] if risk else None,
            fecha_calculo_riesgo=risk["fecha_calculo"] if risk else None,
            condiciones_sanitarias=PublicSanitaryConditions(**sanitary) if sanitary else None,
        )

    @_persistence
    def public_alerts(self, limit: int, offset: int, shelter_id: str | None = None) -> list[PublicAlert]:
        query = {"publica": True}
        if shelter_id is not None:
            oid = _oid(shelter_id)
            if oid is None:
                return []
            query["albergue_id"] = oid
        pipeline = [
            {"$match": query},
            {"$lookup": {"from": "albergues", "localField": "albergue_id", "foreignField": "_id",
                "pipeline": [{"$match": {"activo": True}}, {"$project": {"_id": 1}}], "as": "shelter"}},
            {"$match": {"shelter.0": {"$exists": True}}},
            {"$sort": {"fecha_alerta": -1, "_id": -1}}, {"$skip": offset}, {"$limit": limit},
            {"$project": {"albergue_id": 1, "fecha_alerta": 1, "nivel_riesgo": 1,
                          "tipo_alerta": 1, "mensaje": 1, "activa": 1}},
        ]
        return [PublicAlert(**_plain(doc)) for doc in self.database.alertas.aggregate(pipeline)]


    @_persistence
    def page_shelters(self, paging: Pagination, filters: ListFilters, active: bool | None = None,
                      shelter_id: str | None = None) -> Page[Shelter]:
        query = {} if active is None else {"activo": active}
        if shelter_id is not None:
            query["_id"] = _oid(shelter_id)
        query = filtered_query(query, filters, ("nombre", "codigo_albergue", "ubicacion.municipio", "ubicacion.departamento"), "created_at")
        page = paginate_find(self._col, query, paging, [("codigo_albergue", 1), ("_id", 1)], _shelter)
        return replace(page, items=self._enrich_shelters(page.items))

    @_persistence
    def page_public_shelters(self, paging: Pagination, filters: ListFilters) -> Page[PublicShelter]:
        query = filtered_query({"activo": True}, filters,
            ("nombre", "codigo_albergue", "ubicacion.municipio", "ubicacion.departamento"), "created_at")
        lookups = []
        for collection, date_field, fields, alias in (
            ("historial_poblacion", "fecha", {"poblacion": 1}, "population"),
            ("estados_semaforo", "fecha_calculo", {"nivel": 1, "fecha_calculo": 1}, "risk"),
            ("condiciones_sanitarias", "fecha", {"fecha": 1, "agua_potable_disponible": 1,
                "banos_disponibles": 1, "estado_higiene": 1, "estado_saneamiento": 1}, "sanitary"),
        ):
            lookups.append({"$lookup": {"from": collection, "localField": "_id", "foreignField": "albergue_id",
                "pipeline": [{"$sort": {date_field: -1, "_id": -1}}, {"$limit": 1}, {"$project": {"_id": 0, **fields}}], "as": alias}})
        return paginate_aggregate(self._col, [{"$match": query}, {"$sort": {"codigo_albergue": 1, "_id": 1}}],
            paging, self._public_shelter, item_pipeline=lookups)

    @_persistence
    def page_public_alerts(self, paging: Pagination, filters: ListFilters,
                           shelter_id: str | None = None, active: bool | None = None) -> Page[PublicAlert]:
        query = {"publica": True}
        if shelter_id is not None:
            query["albergue_id"] = _oid(shelter_id)
        if active is not None:
            query["activa"] = active
        query = filtered_query(query, filters, ("tipo_alerta", "mensaje"), "fecha_alerta")
        pipeline = [{"$match": query},
            {"$lookup": {"from": "albergues", "localField": "albergue_id", "foreignField": "_id",
                "pipeline": [{"$match": {"activo": True}}, {"$project": {"_id": 1}}], "as": "shelter"}},
            {"$match": {"shelter.0": {"$exists": True}}}, {"$sort": {"fecha_alerta": -1, "_id": -1}}]
        projection = {"$project": {"albergue_id": 1, "fecha_alerta": 1, "nivel_riesgo": 1,
                                   "tipo_alerta": 1, "mensaje": 1, "activa": 1}}
        return paginate_aggregate(self.database.alertas, pipeline, paging,
            lambda row: PublicAlert(**_plain(row)), item_pipeline=[projection])


    @_persistence
    def summary(self) -> ShelterSummary:
        pipeline = []
        for collection, date_field, projection, alias in (
            ("historial_poblacion", "fecha", {"poblacion": 1}, "population"),
            ("estados_semaforo", "fecha_calculo", {"nivel": 1}, "risk"),
        ):
            pipeline.append({"$lookup": {"from": collection, "localField": "_id", "foreignField": "albergue_id",
                "pipeline": [{"$sort": {date_field: -1, "_id": -1}}, {"$limit": 1}, {"$project": projection}], "as": alias}})
        pipeline.extend([
            {"$lookup": {"from": "usuarios", "localField": "_id", "foreignField": "albergue_id",
                "pipeline": [{"$match": {"role": "administrador_albergue"}}, {"$limit": 1}, {"$project": {"_id": 1}}], "as": "admins"}},
            {"$group": {"_id": None,
                "total": {"$sum": 1}, "active": {"$sum": {"$cond": ["$activo", 1, 0]}},
                "assigned": {"$sum": {"$cond": [{"$gt": [{"$size": "$admins"}, 0]}, 1, 0]}},
                "critical": {"$sum": {"$cond": [{"$and": ["$activo", {"$eq": [{"$arrayElemAt": ["$risk.nivel", 0]}, "rojo"]}]}, 1, 0]}},
                "unknown_risk": {"$sum": {"$cond": [{"$eq": [{"$size": "$risk"}, 0]}, 1, 0]}},
                "unknown_population": {"$sum": {"$cond": [{"$eq": [{"$size": "$population"}, 0]}, 1, 0]}},
                "population": {"$sum": {"$ifNull": [{"$arrayElemAt": ["$population.poblacion", 0]}, 0]}},
                "capacity": {"$sum": {"$cond": [{"$gt": [{"$size": "$population"}, 0]}, "$capacidad_instalada", 0]}},
            }},
        ])
        row = next(iter(self._col.aggregate(pipeline)), None)
        if row is None:
            return ShelterSummary(0, 0, 0, 0, 0, None, 0, None)
        return ShelterSummary(row["total"], row["active"], row["assigned"], row["critical"], row["unknown_risk"],
            row["population"] if row["unknown_population"] < row["total"] else None, row["unknown_population"],
            row["population"] / row["capacity"] * 100 if row["capacity"] else None)
