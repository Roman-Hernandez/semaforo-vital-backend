"""Composición de adaptadores y dependencias HTTP."""
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.database import Database

from app.application.auth import AuthenticateUserUseCase, AuthToken, ResolveUserUseCase
from app.application.shelters import ShelterService
from app.core.config import settings
from app.domain.errors import InsufficientPermissions, NotAuthenticated
from app.domain.ports.user_repository import UserRepository
from app.domain.users import User, UserRole
from app.infrastructure.database.mongodb import get_database_from_request
from app.infrastructure.repositories.mongo_shelter_repository import (
    MongoShelterRepository,
)
from app.infrastructure.repositories.mongo_user_repository import MongoUserRepository
from app.infrastructure.security.tokens import JwtTokens, verify_password

http_bearer = HTTPBearer(auto_error=False)


def get_database(request: Request) -> Database:
    return get_database_from_request(request)


def get_user_repository(database: Annotated[Database, Depends(get_database)]) -> UserRepository:
    return MongoUserRepository(database)


def issue_access_token(user: User) -> AuthToken:
    return JwtTokens(settings.jwt_secret_key, settings.jwt_access_token_minutes).issue(user)


def decode_access_token(token: str) -> str:
    return JwtTokens(settings.jwt_secret_key, settings.jwt_access_token_minutes).decode(token)


def get_token_decoder() -> Callable[[str], str]:
    return decode_access_token


def get_auth_use_case(
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> AuthenticateUserUseCase:
    return AuthenticateUserUseCase(user_repository, verify_password, issue_access_token)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
    decode_token: Annotated[Callable[[str], str], Depends(get_token_decoder)],
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise NotAuthenticated()
    return ResolveUserUseCase(user_repository, decode_token).execute(credentials.credentials)


def require_role(required_role: UserRole) -> Callable[[User], User]:
    def role_checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in (required_role, UserRole.SUPER_ADMIN):
            raise InsufficientPermissions()
        return current_user
    return role_checker


def get_shelter_service(
    database: Annotated[Database, Depends(get_database)],
) -> ShelterService:
    return ShelterService(MongoShelterRepository(database))
