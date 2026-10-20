from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from bson import ObjectId
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

from app.api.deps import (
    get_auth_use_case,
    get_current_user,
    get_user_repository,
    require_role,
)
from app.application.auth import (
    AuthenticateUserUseCase,
    InvalidCredentials,
    InvalidTokenError,
    TokenExpiredError,
    authenticate,
    decode_access_token,
)
from app.core.config import settings
from app.domain.users import User, UserRole
from app.infrastructure.repositories.mongo_user_repository import MongoUserRepository
from app.main import _request_hits, app
from database.mongodb.seeds.seed_admin import seed_superadmin

TEST_SECRET = "test-secret-key-that-has-at-least-32-characters"


class StubUserRepository:
    def __init__(self, user: User | None = None):
        self.user = user

    def find_by_email(self, email: str) -> User | None:
        if self.user and self.user.email.lower() == email.lower().strip():
            return self.user
        return None

    def find_by_id(self, user_id: str) -> User | None:
        if self.user and self.user.id == user_id:
            return self.user
        return None


@pytest.fixture
def user() -> User:
    return User(
        id="507f1f77bcf86cd799439011",
        email="admin@example.com",
        password_hash=PasswordHash.recommended().hash("correct-horse-battery"),
        role=UserRole.SHELTER_ADMIN,
        active=True,
    )


# --- 1. Pruebas unitarias de autenticación (Dominio / Aplicación) ---


def test_valid_credentials_return_expiring_jwt(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    use_case = AuthenticateUserUseCase(StubUserRepository(user))
    token = use_case.execute(" Admin@Example.com ", "correct-horse-battery")
    claims = jwt.decode(token.access_token, TEST_SECRET, algorithms=["HS256"])
    assert claims["sub"] == user.id
    assert claims["role"] == "administrador_albergue"
    assert claims["exp"] > claims["iat"]


def test_authenticate_helper_function(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    token = authenticate(
        StubUserRepository(user), "admin@example.com", "correct-horse-battery"
    )
    assert token.access_token is not None


def test_incorrect_password(user):
    use_case = AuthenticateUserUseCase(StubUserRepository(user))
    with pytest.raises(InvalidCredentials):
        use_case.execute("admin@example.com", "wrong")


def test_inactive_account(user):
    inactive = User(**{**vars(user), "active": False})
    use_case = AuthenticateUserUseCase(StubUserRepository(inactive))
    with pytest.raises(InvalidCredentials):
        use_case.execute("admin@example.com", "correct-horse-battery")


def test_unknown_account():
    use_case = AuthenticateUserUseCase(StubUserRepository(None))
    with pytest.raises(InvalidCredentials):
        use_case.execute("admin@example.com", "invalid")


def test_short_jwt_secret_rejected(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", "short-secret")
    use_case = AuthenticateUserUseCase(StubUserRepository(user))
    with pytest.raises(RuntimeError, match="at least 32 characters"):
        use_case.execute("admin@example.com", "correct-horse-battery")


# --- 2. Pruebas de tokens (Validación, expiración y manipulación) ---


def test_decode_valid_token(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    token = authenticate(
        StubUserRepository(user), "admin@example.com", "correct-horse-battery"
    )
    payload = decode_access_token(token.access_token)
    assert payload["sub"] == user.id
    assert payload["role"] == "administrador_albergue"


def test_decode_expired_token(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    expired_payload = {
        "sub": "user123",
        "role": "administrador_albergue",
        "iat": datetime.now(UTC) - timedelta(hours=2),
        "exp": datetime.now(UTC) - timedelta(hours=1),
    }
    expired_token = jwt.encode(expired_payload, TEST_SECRET, algorithm="HS256")
    with pytest.raises(TokenExpiredError):
        decode_access_token(expired_token)


def test_decode_tampered_token(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    token = authenticate(
        StubUserRepository(user), "admin@example.com", "correct-horse-battery"
    )
    tampered_token = token.access_token[:-4] + "xxxx"
    with pytest.raises(InvalidTokenError):
        decode_access_token(tampered_token)


def test_decode_token_with_short_secret_rejected(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "short")
    with pytest.raises(RuntimeError, match="at least 32 characters"):
        decode_access_token("some.fake.token")


# --- 3. Pruebas unitarias del adaptador de persistencia (MongoUserRepository) ---


class FakeCollection:
    def __init__(self, doc):
        self.doc = doc

    def find_one(self, filter_query):
        if "_id" in filter_query:
            if self.doc and filter_query["_id"] == self.doc.get("_id"):
                return self.doc
            return None
        if filter_query.get("email") == "admin@example.com":
            return self.doc
        return None


def test_mongo_user_repository_find_by_email():
    valid_id = ObjectId()
    doc = {
        "_id": valid_id,
        "email": "admin@example.com",
        "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$fakehash",
        "role": "administrador_albergue",
        "active": True,
        "nombre": "Carlos",
        "apellido": "Pérez",
        "albergue_id": ObjectId(),
    }
    repo = MongoUserRepository(database={"usuarios": FakeCollection(doc)})
    user = repo.find_by_email(" Admin@example.com ")
    assert user is not None
    assert user.id == str(valid_id)
    assert user.email == "admin@example.com"
    assert user.role == UserRole.SHELTER_ADMIN
    assert user.active is True
    assert user.nombre == "Carlos"


def test_mongo_user_repository_find_by_id():
    valid_id = ObjectId()
    doc = {
        "_id": valid_id,
        "email": "admin@example.com",
        "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$fakehash",
        "role": "administrador_albergue",
        "active": True,
    }
    repo = MongoUserRepository(database={"usuarios": FakeCollection(doc)})
    user = repo.find_by_id(str(valid_id))
    assert user is not None
    assert user.id == str(valid_id)

    # ID inválido
    assert repo.find_by_id("invalid-object-id") is None


def test_mongo_user_repository_not_found():
    repo = MongoUserRepository(database={"usuarios": FakeCollection(None)})
    assert repo.find_by_email("unknown@example.com") is None
    assert repo.find_by_id(str(ObjectId())) is None


# --- 4. Pruebas HTTP del endpoint /api/v1/auth/login ---


def test_login_api_success_200(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    app.dependency_overrides[get_auth_use_case] = lambda: AuthenticateUserUseCase(
        StubUserRepository(user)
    )
    try:
        client = TestClient(app)
        response = client.post("/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "correct-horse-battery",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        claims = jwt.decode(data["access_token"], TEST_SECRET, algorithms=["HS256"])
        assert claims["sub"] == user.id
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "email,password",
    [
        ("admin@example.com", "wrong-password"),
        ("nonexistent@example.com", "correct-horse-battery"),
    ],
)
def test_login_api_invalid_credentials_returns_401(monkeypatch, user, email, password):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    app.dependency_overrides[get_auth_use_case] = lambda: AuthenticateUserUseCase(
        StubUserRepository(user)
    )
    try:
        client = TestClient(app)
        response = client.post("/api/v1/auth/login", json={
            "email": email,
            "password": password,
        })
        assert response.status_code == 401
        assert response.json() == {"detail": "Credenciales inválidas"}
        assert response.headers.get("WWW-Authenticate") == "Bearer"
    finally:
        app.dependency_overrides.clear()


def test_login_api_inactive_account_returns_401(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    inactive_user = User(**{**vars(user), "active": False})
    app.dependency_overrides[get_auth_use_case] = lambda: AuthenticateUserUseCase(
        StubUserRepository(inactive_user)
    )
    try:
        client = TestClient(app)
        response = client.post("/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "correct-horse-battery",
        })
        assert response.status_code == 401
        assert response.json() == {"detail": "Credenciales inválidas"}
    finally:
        app.dependency_overrides.clear()


def test_login_api_validation_error_422():
    app.dependency_overrides[get_auth_use_case] = lambda: AuthenticateUserUseCase(
        StubUserRepository()
    )
    try:
        client = TestClient(app)
        # Formato de correo inválido
        response = client.post("/api/v1/auth/login", json={
            "email": "not-an-email",
            "password": "password",
        })
        assert response.status_code == 422

        # Contraseña vacía
        response = client.post("/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "",
        })
        assert response.status_code == 422

        # Contraseña excede max_length=128
        response = client.post("/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "a" * 129,
        })
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_rate_limit_middleware_blocks_excess_requests(monkeypatch):
    _request_hits.clear()
    monkeypatch.setattr(settings, "rate_limit_requests", 2)
    monkeypatch.setattr(settings, "rate_limit_window_seconds", 60)
    try:
        client = TestClient(app)
        assert client.get("/api/v1/health").status_code == 200
        assert client.get("/api/v1/health").status_code == 200
        res = client.get("/api/v1/health")
        assert res.status_code == 429
        assert res.json() == {"detail": "Demasiadas solicitudes"}
    finally:
        _request_hits.clear()


# --- 5. Pruebas de rutas protegidas (mecanismo reutilizable público vs privado) ---


demo_router = APIRouter(prefix="/demo-auth")


@demo_router.get("/public")
def public_route():
    return {"status": "public"}


@demo_router.get("/private")
def private_route(current_user: Annotated[User, Depends(get_current_user)]):
    return {"user_id": current_user.id, "email": current_user.email}


@demo_router.get("/super-admin-only")
def super_admin_route(
    current_user: Annotated[User, Depends(require_role(UserRole.SUPER_ADMIN))],
):
    return {"admin": True}


app.include_router(demo_router)


def test_public_route_accessible_without_token():
    client = TestClient(app)
    response = client.get("/demo-auth/public")
    assert response.status_code == 200
    assert response.json() == {"status": "public"}


def test_private_route_without_token_returns_401():
    app.dependency_overrides[get_user_repository] = lambda: StubUserRepository()
    try:
        client = TestClient(app)
        response = client.get("/demo-auth/private")
        assert response.status_code == 401
        assert response.json() == {"detail": "No autenticado"}
    finally:
        app.dependency_overrides.clear()


def test_private_route_with_valid_token_returns_user(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    app.dependency_overrides[get_user_repository] = lambda: StubUserRepository(user)
    try:
        client = TestClient(app)
        token = authenticate(
            StubUserRepository(user), "admin@example.com", "correct-horse-battery"
        )
        response = client.get(
            "/demo-auth/private",
            headers={"Authorization": f"Bearer {token.access_token}"},
        )
        assert response.status_code == 200
        assert response.json() == {"user_id": user.id, "email": user.email}
    finally:
        app.dependency_overrides.clear()


def test_private_route_with_inactive_user_returns_401(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    inactive_user = User(**{**vars(user), "active": False})
    app.dependency_overrides[get_user_repository] = lambda: StubUserRepository(
        inactive_user
    )
    try:
        client = TestClient(app)
        token = authenticate(
            StubUserRepository(user), "admin@example.com", "correct-horse-battery"
        )
        response = client.get(
            "/demo-auth/private",
            headers={"Authorization": f"Bearer {token.access_token}"},
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "Usuario inactivo o no encontrado"}
    finally:
        app.dependency_overrides.clear()


def test_role_restricted_route(monkeypatch, user):
    monkeypatch.setattr(settings, "jwt_secret_key", TEST_SECRET)
    # user has SHELTER_ADMIN, but route requires SUPER_ADMIN
    app.dependency_overrides[get_user_repository] = lambda: StubUserRepository(user)
    try:
        client = TestClient(app)
        token = authenticate(
            StubUserRepository(user), "admin@example.com", "correct-horse-battery"
        )
        response = client.get(
            "/demo-auth/super-admin-only",
            headers={"Authorization": f"Bearer {token.access_token}"},
        )
        assert response.status_code == 403
        assert response.json() == {"detail": "Permisos insuficientes"}
    finally:
        app.dependency_overrides.clear()


# --- 6. Pruebas del seeder de superadministrador ---


def test_seed_superadmin_invalid_inputs():
    with pytest.raises(ValueError, match="Email inválido"):
        seed_superadmin(email="bad-email", password="valid-password-123")

    with pytest.raises(ValueError, match="al menos 8 caracteres"):
        seed_superadmin(email="admin@example.com", password="123")

