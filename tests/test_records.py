from dataclasses import asdict, replace
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pagination_helpers import memory_page
from test_shelters import SHELTER, USER, MemoryShelterRepository

from app.api.deps import get_current_user, get_shelter_service
from app.api.errors import register_error_handlers
from app.api.v1.endpoints.records import router
from app.application.shelters import ShelterService
from app.domain.errors import PersistenceError
from app.domain.shelters import (
    DiseaseRecord,
    Intervention,
    RecordKind,
    SanitaryConditions,
)
from app.domain.users import UserRole
from app.infrastructure.repositories.mongo_shelter_repository import (
    MongoShelterRepository,
)

NOW = datetime(2026, 11, 17, 12, tzinfo=UTC)
CASES = [
    ("condiciones-sanitarias", RecordKind.SANITARY, {
        "fecha": "2026-11-17", "agua_potable_disponible": True, "banos_disponibles": 4,
        "estado_higiene": "adecuada", "estado_saneamiento": "adecuado",
        "otros_recursos_sanitarios": [{"nombre": "letrinas", "cantidad": 2}],
    }, SanitaryConditions),
    ("enfermedades", RecordKind.DISEASE, {"fecha": "2026-11-17", "enfermedad": "EDA", "cantidad_casos_activos": 3}, DiseaseRecord),
    ("intervenciones", RecordKind.INTERVENTION, {
        "fecha_intervencion": "2026-11-17", "tipo_intervencion": "agua", "descripcion": "Suministro de agua potable",
    }, Intervention),
]


class RecordsRepository(MemoryShelterRepository):
    def __init__(self):
        super().__init__()
        self.rows = {}

    def list_records(self, shelter_id, kind, limit, offset):
        return [row for (row_kind, _), row in self.rows.items()
                if row_kind == kind and row.albergue_id == shelter_id][offset:offset + limit]

    def page_records(self, shelter_id, kind, paging, filters):
        rows = [row for (row_kind, _), row in self.rows.items() if row_kind == kind and row.albergue_id == shelter_id]
        field = "fecha_intervencion" if kind == RecordKind.INTERVENTION else "fecha"
        return memory_page(rows, paging, filters, field)

    def save_record(self, shelter_id, kind, command, user_id, now, record_id=None):
        previous = self.rows.get((kind, record_id))
        if record_id and (not previous or previous.albergue_id != shelter_id):
            return None
        record_id = record_id or str(ObjectId())
        cls = {RecordKind.SANITARY: SanitaryConditions, RecordKind.DISEASE: DiseaseRecord, RecordKind.INTERVENTION: Intervention}[kind]
        values = asdict(command)
        if kind == RecordKind.SANITARY:
            values["otros_recursos_sanitarios"] = command.otros_recursos_sanitarios
        row = cls(**values, id=record_id, albergue_id=shelter_id,
                  created_at=previous.created_at if previous else now,
                  registrado_por=previous.registrado_por if previous else user_id,
                  updated_at=now if previous else None, updated_by=user_id if previous else None)
        self.rows[(kind, record_id)] = row
        return row


@pytest.fixture
def api():
    repository = RecordsRepository()
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[get_shelter_service] = lambda: ShelterService(repository)
    return TestClient(app), repository, app


@pytest.mark.parametrize("path,kind,payload,cls", CASES)
def test_create_list_correct_and_keep_trace(api, path, kind, payload, cls):
    client, repository, _ = api
    url = f"/api/v1/mi-albergue/{path}"
    created = client.post(url, json=payload)
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["albergue_id"] == SHELTER and row["registrado_por"] == USER.id
    assert row["fuente_datos"] == "registro_manual"
    assert client.get(url).json()["items"] == [row]
    updated = client.put(f"{url}/{row['id']}", json={**payload, "observaciones": "Verificado"})
    assert updated.status_code == 200, updated.text
    assert updated.json()["created_at"] == row["created_at"]
    assert updated.json()["updated_by"] == USER.id
    assert updated.json()["observaciones"] == "Verificado"
    assert client.get(f"{url}?page=2&page_size=1").json()["items"] == []
    assert len(repository.rows) == 1


@pytest.mark.parametrize("path,kind,payload,cls", CASES)
def test_prevent_spoofing_and_cross_shelter_edits(api, path, kind, payload, cls):
    client, repository, _ = api
    url = f"/api/v1/mi-albergue/{path}"
    assert client.post(url, json={**payload, "albergue_id": str(ObjectId())}).status_code == 422
    row = client.post(url, json=payload).json()
    repository.rows[(kind, row["id"])] = replace(repository.rows[(kind, row["id"])], albergue_id=str(ObjectId()))
    assert client.get(url).json()["items"] == []
    assert client.put(f"{url}/{row['id']}", json=payload).status_code == 404
    assert client.put(f"{url}/invalido", json=payload).status_code == 404


@pytest.mark.parametrize("path,kind,payload,cls", CASES)
def test_deny_writes_to_inactive_shelter_and_unassigned_roles(api, path, kind, payload, cls):
    client, repository, app = api
    url = f"/api/v1/mi-albergue/{path}"
    repository.shelter = replace(repository.shelter, activo=False)
    assert client.post(url, json=payload).status_code == 409
    assert client.get(url).status_code == 200
    app.dependency_overrides[get_current_user] = lambda: replace(USER, role=UserRole.SUPER_ADMIN)
    assert client.get(url).status_code == 403
    assert client.post(url, json=payload).status_code == 403


@pytest.mark.parametrize("field,value", [("cantidad_casos_activos", -1), ("cantidad_casos_activos", True),
                                         ("cantidad_casos_activos", "2"), ("fecha", "invalida"), ("enfermedad", " ")])
def test_validate_boundary(api, field, value):
    client, _, _ = api
    assert client.post("/api/v1/mi-albergue/enfermedades", json={**CASES[1][2], field: value}).status_code == 422
    assert client.get("/api/v1/mi-albergue/enfermedades?page_size=0").status_code == 422


def test_mongo_scopes_update_and_preserves_author():
    from app.api.record_schemas import InterventionRequest
    db = MagicMock()
    collection = db.__getitem__.return_value
    collection.find_one_and_update.return_value = None
    repository = MongoShelterRepository(db)
    row_id = str(ObjectId())
    command = InterventionRequest(**CASES[2][2]).to_command()
    assert repository.save_record(SHELTER, RecordKind.INTERVENTION, command, USER.id, NOW, row_id) is None
    query, update = collection.find_one_and_update.call_args.args
    assert query == {"_id": ObjectId(row_id), "albergue_id": ObjectId(SHELTER)}
    assert "registrado_por" not in update["$set"] and "created_at" not in update["$set"]
    assert update["$set"]["updated_by"] == ObjectId(USER.id)
    assert "observaciones" not in update["$set"]
    assert update["$unset"] == {"observaciones": ""}


def test_storage_failures_use_existing_public_error(api):
    client, repository, _ = api
    repository.save_record = MagicMock(side_effect=PersistenceError())
    response = client.post("/api/v1/mi-albergue/intervenciones", json=CASES[2][2])
    assert response.status_code == 503
    assert response.json()["code"] == "PERSISTENCE_UNAVAILABLE"


@pytest.mark.parametrize("path,kind,payload,cls", CASES)
def test_global_reads_require_super_admin(api, path, kind, payload, cls):
    from test_albergues import SUPER

    from app.api.v1.endpoints.albergues import router as albergues_router
    client, _, app = api
    app.include_router(albergues_router, prefix="/api/v1")
    # Override the unrelated administrative repository so no real DB is contacted.
    from app.api.deps import get_albergue_repository
    app.dependency_overrides[get_albergue_repository] = lambda: MagicMock()
    created = client.post(f"/api/v1/mi-albergue/{path}", json=payload).json()
    url = f"/api/v1/albergues/{SHELTER}/{path}"
    assert client.get(url).status_code == 403
    app.dependency_overrides[get_current_user] = lambda: SUPER
    assert client.get(url).json()["items"][0]["id"] == created["id"]
    assert client.get(f"/api/v1/albergues/{ObjectId()}/{path}").status_code == 404


def test_mongo_insert_keeps_bson_types_and_omits_optional_nulls():
    from app.api.record_schemas import SanitaryRequest
    db = MagicMock()
    collection = db.__getitem__.return_value
    collection.insert_one.side_effect = lambda document: document.update({"_id": ObjectId()})
    repository = MongoShelterRepository(db)
    result = repository.save_record(SHELTER, RecordKind.SANITARY,
                                    SanitaryRequest(**CASES[0][2]).to_command(), USER.id, NOW)
    document = collection.insert_one.call_args.args[0]
    assert document["albergue_id"] == ObjectId(SHELTER)
    assert document["registrado_por"] == ObjectId(USER.id)
    assert document["fecha"].hour == 0 and document["fecha"].utcoffset().total_seconds() == -18000
    assert "observaciones" not in document
    assert "observacion" not in document["otros_recursos_sanitarios"][0]
    assert result.otros_recursos_sanitarios[0].cantidad == 2
