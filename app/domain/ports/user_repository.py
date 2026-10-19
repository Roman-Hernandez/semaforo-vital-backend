from typing import Protocol

from app.domain.users import User


class UserRepository(Protocol):
    def find_by_email(self, email: str) -> User | None: ...
