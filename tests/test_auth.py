from types import SimpleNamespace

import jwt
import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

from app.application.auth import InvalidCredentials, authenticate
from app.core.config import settings
from app.domain.users import User, UserRole
from app.main import app


class StubUserRepository:
    def __init__(self, user):
        self.user = user

    def find_by_email(self, email):
        assert email == "admin@example.com"
        return self.user


@pytest.fixture
def user():
    return User(
        id="507f1f77bcf86cd799439011",
        email="admin@example.com",
        password_hash=PasswordHash.recommended().hash("correct-horse-battery"),
        role=UserRole.SHELTER_ADMIN,
        active=True,
    )


def test_valid_credentials_return_expiring_jwt(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", "test-secret-for-automated-tests-32-chars")
    token = authenticate(StubUserRepository(user), " Admin@Example.com ", "correct-horse-battery")
    claims = jwt.decode(token.access_token, settings.jwt_secret_key, algorithms=["HS256"])
    assert claims["sub"] == user.id
    assert claims["role"] == "administrador_albergue"
    assert claims["exp"] > claims["iat"]


def test_incorrect_password(user):
    with pytest.raises(InvalidCredentials):
        authenticate(StubUserRepository(user), "admin@example.com", "wrong")


def test_inactive_account(user):
    inactive = User(**{**vars(user), "active": False})
    with pytest.raises(InvalidCredentials):
        authenticate(StubUserRepository(inactive), "admin@example.com", "correct-horse-battery")


def test_unknown_account():
    with pytest.raises(InvalidCredentials):
        authenticate(StubUserRepository(None), "admin@example.com", "invalid")


def test_login_api_returns_generic_401(monkeypatch):
    from app.infrastructure.database.mongodb import get_database_from_request
    from app.infrastructure.repositories.mongo_user_repository import MongoUserRepository

    monkeypatch.setattr(MongoUserRepository, "find_by_email", lambda self, email: None)
    app.dependency_overrides[get_database_from_request] = lambda: SimpleNamespace()
    try:
        client = TestClient(app)
        response = client.post("/api/v1/auth/login", json={
            "email": "admin@example.com", "password": "wrong"
        })
        assert response.status_code == 401
        assert response.json() == {"detail": "Credenciales inválidas"}
    finally:
        app.dependency_overrides.clear()
