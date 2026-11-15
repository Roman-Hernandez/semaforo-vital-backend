from collections.abc import Callable
from dataclasses import dataclass

from app.domain.errors import InactiveUser, InvalidCredentials
from app.domain.ports.user_repository import UserRepository
from app.domain.users import User


@dataclass(frozen=True)
class AuthToken:
    access_token: str
    token_type: str = "bearer"


class AuthenticateUserUseCase:
    def __init__(
        self,
        user_repository: UserRepository,
        verify_password: Callable[[str, str | None], bool],
        issue_token: Callable[[User], AuthToken],
    ):
        self.user_repository = user_repository
        self.verify_password = verify_password
        self.issue_token = issue_token

    def execute(self, email: str, password: str) -> AuthToken:
        user = self.user_repository.find_by_email(email.strip().lower())
        matches = self.verify_password(password, user.password_hash if user else None)
        if not user or not matches or not user.active:
            raise InvalidCredentials()
        return self.issue_token(user)


class ResolveUserUseCase:
    def __init__(self, repository: UserRepository, decode_token: Callable[[str], str]):
        self.repository = repository
        self.decode_token = decode_token

    def execute(self, token: str) -> User:
        user = self.repository.find_by_id(self.decode_token(token))
        if not user or not user.active:
            raise InactiveUser()
        return user
