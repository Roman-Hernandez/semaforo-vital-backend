from dataclasses import asdict, replace
from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.domain.errors import DuplicateUserEmail, PersistenceError
from app.domain.pagination import ListFilters, PaginatedResult, Pagination
from app.domain.users import AdministratorChanges, AdministratorDetails, User, UserRole
from app.infrastructure.database.errors import persistence_guard as _persistence
from app.infrastructure.database.pagination import filtered_query, paginate_find


class MongoUserRepository:
    def __init__(self, database: Database):
        self.database = database
        self.collection = database["usuarios"]

    def _to_user(self, document: dict) -> User:
        return User(
            id=str(document["_id"]),
            email=document["email"],
            password_hash=document["password_hash"],
            role=UserRole(document["role"]),
            active=bool(document["active"]),
            nombre=document.get("nombre"),
            apellido=document.get("apellido"),
            albergue_id=(
                str(document["albergue_id"]) if document.get("albergue_id") else None
            ),
        )

    def find_by_email(self, email: str) -> User | None:
        try:
            document = self.collection.find_one({"email": email.strip().lower()})
        except PyMongoError as exc:
            raise PersistenceError() from exc
        return self._to_user(document) if document else None

    def find_by_id(self, user_id: str) -> User | None:
        try:
            oid = ObjectId(user_id)
        except (InvalidId, TypeError):
            return None
        try:
            document = self.collection.find_one({"_id": oid})
        except PyMongoError as exc:
            raise PersistenceError() from exc
        return self._to_user(document) if document else None

    @_persistence
    def list_admins(self, limit: int, offset: int) -> list[User]:
        cursor = self.collection.find({"role": UserRole.SHELTER_ADMIN.value}).sort([("email", 1), ("_id", 1)])
        return [self._to_user(doc) for doc in cursor.skip(offset).limit(limit)]

    @_persistence
    def add_admin(self, details: AdministratorDetails, password_hash: str, actor_id: str, now: datetime) -> User:
        document = {
            "email": details.email.strip().lower(), "nombre": details.nombre, "apellido": details.apellido,
            "albergue_id": ObjectId(details.albergue_id) if details.albergue_id else None,
            "password_hash": password_hash, "role": UserRole.SHELTER_ADMIN.value, "active": True,
            "created_at": now, "updated_at": now, "registrado_por": ObjectId(actor_id),
        }
        try:
            self.collection.insert_one(document)
        except DuplicateKeyError as exc:
            raise DuplicateUserEmail() from exc
        return self._to_user(document)

    @_persistence
    def _update_admin(self, user_id: str, values: dict, actor_id: str, now: datetime) -> User | None:
        if not ObjectId.is_valid(user_id):
            return None
        try:
            document = self.collection.find_one_and_update(
                {"_id": ObjectId(user_id), "role": UserRole.SHELTER_ADMIN.value},
                {"$set": {**values, "updated_at": now, "updated_by": ObjectId(actor_id)}},
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError as exc:
            raise DuplicateUserEmail() from exc
        return self._to_user(document) if document else None

    def update_admin(self, user_id: str, changes: AdministratorChanges, actor_id: str, now: datetime) -> User | None:
        values = {key: value for key, value in asdict(changes).items() if value is not None}
        if "email" in values:
            values["email"] = values["email"].strip().lower()
        return self._update_admin(user_id, values, actor_id, now)

    def assign_admin(self, user_id: str, shelter_id: str | None, actor_id: str, now: datetime) -> User | None:
        return self._update_admin(user_id, {"albergue_id": ObjectId(shelter_id) if shelter_id else None}, actor_id, now)


    @_persistence
    def page_admins(self, paging: Pagination, filters: ListFilters, active: bool | None = None) -> PaginatedResult[User]:
        query = {"role": UserRole.SHELTER_ADMIN.value}
        if active is not None:
            query["active"] = active
        query = filtered_query(query, filters, ("nombre", "apellido", "email"), "created_at")
        page = paginate_find(self.collection, query, paging, [("email", 1), ("_id", 1)], self._to_user)
        ids = {ObjectId(user.albergue_id) for user in page.items if user.albergue_id and ObjectId.is_valid(user.albergue_id)}
        shelters = {str(row["_id"]): row for row in self.database.albergues.find(
            {"_id": {"$in": list(ids)}}, {"nombre": 1, "codigo_albergue": 1})} if ids else {}
        return PaginatedResult[User].create([replace(user,
            albergue_nombre=shelters.get(user.albergue_id, {}).get("nombre"),
            codigo_albergue=shelters.get(user.albergue_id, {}).get("codigo_albergue")) for user in page.items], paging, page.total)
