from bson import ObjectId
from bson.errors import InvalidId
from pymongo.database import Database
from pymongo.errors import PyMongoError

from app.domain.errors import PersistenceError
from app.domain.users import User, UserRole


class MongoUserRepository:
    def __init__(self, database: Database):
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
