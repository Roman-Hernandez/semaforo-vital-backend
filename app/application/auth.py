from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import settings
from app.domain.ports.user_repository import UserRepository

_passwords = PasswordHash.recommended()
# Generated once per process to reduce timing differences for unknown users.
_DUMMY_HASH = _passwords.hash("not-a-real-password")


class InvalidCredentials(Exception):
    pass


@dataclass(frozen=True)
class AuthToken:
    access_token: str
    token_type: str = "bearer"


def authenticate(repository: UserRepository, email: str, password: str) -> AuthToken:
    normalized_email = email.strip().lower()
    user = repository.find_by_email(normalized_email)
    password_hash = user.password_hash if user is not None else _DUMMY_HASH
    try:
        matches = _passwords.verify(password, password_hash)
    except (ValueError, TypeError):
        matches = False
    if not user or not matches or not user.active:
        raise InvalidCredentials()
    if len(settings.jwt_secret_key) < 32:
        raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters")

    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "role": user.role.value,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_token_minutes),
    }
    return AuthToken(access_token=jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256"))
