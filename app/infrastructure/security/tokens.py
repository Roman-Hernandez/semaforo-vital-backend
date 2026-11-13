from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.application.auth import AuthToken
from app.domain.errors import InvalidTokenError, TokenExpiredError
from app.domain.users import User

_passwords = PasswordHash.recommended()
# Always verify a hash, including when the user does not exist.
_DUMMY_HASH = _passwords.hash("not-a-real-password")


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _passwords.verify(password, password_hash or _DUMMY_HASH)
    except (ValueError, TypeError, UnknownHashError):
        return False


class JwtTokens:
    def __init__(self, secret: str, lifetime_minutes: int):
        if len(secret) < 32:
            raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters")
        self.secret = secret
        self.lifetime_minutes = lifetime_minutes

    def issue(self, user: User) -> AuthToken:
        now = datetime.now(UTC)
        payload = {
            "sub": user.id, "role": user.role.value, "iat": now,
            "exp": now + timedelta(minutes=self.lifetime_minutes),
        }
        return AuthToken(jwt.encode(payload, self.secret, algorithm="HS256"))

    def decode(self, token: str) -> str:
        try:
            payload = jwt.decode(
                token, self.secret, algorithms=["HS256"],
                options={"require": ["sub", "role", "exp", "iat"]},
            )
            if not isinstance(payload["sub"], str) or not payload["sub"]:
                raise InvalidTokenError()
            return payload["sub"]
        except jwt.ExpiredSignatureError:
            raise TokenExpiredError() from None
        except jwt.PyJWTError:
            raise InvalidTokenError() from None
