from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.database import Database

from app.application.auth import (
    AuthenticateUserUseCase,
    InvalidTokenError,
    TokenExpiredError,
    decode_access_token,
)
from app.domain.ports.user_repository import UserRepository
from app.domain.users import User, UserRole
from app.infrastructure.database.mongodb import get_database_from_request
from app.infrastructure.repositories.mongo_user_repository import MongoUserRepository

http_bearer = HTTPBearer(auto_error=False)


def get_database(request: Request) -> Database:
    return get_database_from_request(request)


def get_user_repository(
    database: Annotated[Database, Depends(get_database)],
) -> UserRepository:
    return MongoUserRepository(database)


def get_auth_use_case(
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> AuthenticateUserUseCase:
    return AuthenticateUserUseCase(user_repository)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(credentials.credentials)
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = user_repository.find_by_id(user_id)
    if not user or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo o no encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(required_role: UserRole) -> Callable[[User], User]:
    def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in (required_role, UserRole.SUPER_ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes",
            )
        return current_user

    return role_checker

