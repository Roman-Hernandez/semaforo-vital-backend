from dataclasses import asdict, replace
from unittest.mock import MagicMock

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pagination_helpers import memory_page
from pymongo.errors import DuplicateKeyError
from test_albergues import SUPER, FakeAlbergueRepository, sembrar

from app.api.deps import get_administrator_service, get_current_user
from app.api.errors import register_error_handlers
from app.api.v1.endpoints.administrators import router
from app.application.administrators import AdministratorService
from app.domain.errors import DuplicateUserEmail
from app.domain.users import User, UserRole
from app.infrastructure.repositories.mongo_user_repository import MongoUserRepository
from app.infrastructure.security.tokens import hash_password, verify_password

BASE = "/api/v1/administradores"
PASSWORD = "ClaveDePrueba123"
PAYLOAD = {"email": "admin@example.com", "password": PASSWORD, "nombre": "Ana", "apellido": "Pérez"}


class MemoryUsers:
    def __init__(self):
        self.users = {SUPER.id: SUPER}

    def find_by_id(self, user_id):
        return self.users.get(user_id)

    def list_admins(self, limit, offset):
        return [user for user in self.users.values() if user.role == UserRole.SHELTER_ADMIN][offset:offset + limit]

    def page_admins(self, paging, filters, active=None):
        rows = self.list_admins(100000, 0)
        if active is not None:
            rows = [row for row in rows if row.active == active]
        return memory_page(rows, paging, filters)

    def add_admin(self, details, password_hash, actor_id, now):
        if any(user.email == details.email for user in self.users.values()):
            raise DuplicateUserEmail()
        user = User(id=str(ObjectId()), password_hash=password_hash, role=UserRole.SHELTER_ADMIN,
                    active=True, **asdict(details))
        self.users[user.id] = user
        return user

    def update_admin(self, user_id, changes, actor_id, now):
        user = self.users.get(user_id)
        if not user:
            return None
        values = {key: value for key, value in asdict(changes).items() if value is not None}
        self.users[user_id] = replace(user, **values)
        return self.users[user_id]

    def assign_admin(self, user_id, shelter_id, actor_id, now):
        self.users[user_id] = replace(self.users[user_id], albergue_id=shelter_id)
        return self.users[user_id]


@pytest.fixture
def api():
    users, shelters = MemoryUsers(), FakeAlbergueRepository()
    service = AdministratorService(users, shelters, hash_password)
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: SUPER
    app.dependency_overrides[get_administrator_service] = lambda: service
    return TestClient(app), users, shelters, app


def test_create_edit_disable_enable_and_assign(api):
    client, users, shelters, _ = api
    created = client.post(BASE, json=PAYLOAD)
    assert created.status_code == 201, created.text
    row = created.json()
    assert client.get(f"{BASE}/{row['id']}").json() == row
    stored = users.users[row["id"]]
    assert verify_password(PASSWORD, stored.password_hash)
    assert "password_hash" not in row
    assert "password" not in row
    assert PASSWORD not in created.text
    url = f"{BASE}/{row['id']}"
    updated = client.patch(url, json={"nombre": "Andrea", "active": False, "password": "NuevaClave123"})
    assert updated.status_code == 200
    assert not updated.json()["active"]
    assert users.users[row["id"]].nombre == "Andrea"
    assert verify_password("NuevaClave123", users.users[row["id"]].password_hash)
    assert client.patch(url, json={"active": True}).json()["active"]
    shelter = sembrar(shelters)
    assert client.put(f"{url}/albergue", json={"albergue_id": shelter.id}).json()["albergue_id"] == shelter.id
    assert client.put(f"{url}/albergue", json={"albergue_id": None}).json()["albergue_id"] is None
    assert len(client.get(BASE).json()["items"]) == 1
    assert client.get(f"{BASE}?page=2&page_size=1").json()["items"] == []


def test_duplicate_email_and_missing_target(api):
    client, _, _, _ = api
    assert client.post(BASE, json=PAYLOAD).status_code == 201
    assert client.post(BASE, json=PAYLOAD).status_code == 409
    assert client.patch(f"{BASE}/missing", json={"nombre": "Ana"}).status_code == 404
    assert client.patch(f"{BASE}/{SUPER.id}", json={"active": False}).status_code == 404


@pytest.mark.parametrize("payload", [{}, {"nombre": None}, {"active": "true"}, {"password": "short"},
                                      {"role": "super_administrador"}, {"albergue_id": str(ObjectId())}])
def test_reject_invalid_or_unauthorized_updates(api, payload):
    client, _, _, _ = api
    user = client.post(BASE, json=PAYLOAD).json()
    assert client.patch(f"{BASE}/{user['id']}", json=payload).status_code == 422


def test_shelter_must_exist_and_be_active(api):
    client, _, shelters, _ = api
    assert client.post(BASE, json={**PAYLOAD, "albergue_id": str(ObjectId())}).status_code == 404
    shelter = sembrar(shelters, activo=False)
    assert client.post(BASE, json={**PAYLOAD, "albergue_id": shelter.id}).status_code == 409


def test_only_super_admin_can_manage_accounts(api):
    client, _, _, app = api
    app.dependency_overrides[get_current_user] = lambda: replace(SUPER, role=UserRole.SHELTER_ADMIN)
    assert client.get(BASE).status_code == 403
    assert client.post(BASE, json=PAYLOAD).status_code == 403
    assert client.patch(f"{BASE}/{SUPER.id}", json={"active": False}).status_code == 403
    assert client.put(f"{BASE}/{SUPER.id}/albergue", json={"albergue_id": None}).status_code == 403


def test_storage_handles_race_on_unique_email():
    from test_albergues import NOW

    from app.domain.users import AdministratorDetails
    db = MagicMock()
    db.__getitem__.return_value.insert_one.side_effect = DuplicateKeyError("duplicate")
    repository = MongoUserRepository(db)
    details = AdministratorDetails(email="a@example.com", nombre="Ana", apellido="Pérez")
    password_hash = hash_password(PASSWORD)
    with pytest.raises(DuplicateUserEmail):
        repository.add_admin(details, password_hash, SUPER.id, NOW)
