from pymongo.database import Database

from app.domain.users import User, UserRole


class MongoUserRepository:
    def __init__(self, database: Database):
        self.collection = database["usuarios"]

    def find_by_email(self, email: str) -> User | None:
        document = self.collection.find_one({"email": email})
        if document is None:
            return None
        return User(
            id=str(document["_id"]),
            email=document["email"],
            password_hash=document["password_hash"],
            role=UserRole(document["role"]),
            active=document["active"],
        )
