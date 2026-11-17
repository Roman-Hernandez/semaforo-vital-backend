from dataclasses import asdict
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_albergue_repository, get_database
from app.api.errors import register_error_handlers
from app.api.v1.endpoints.albergues import router as admin_router
from app.api.v1.endpoints.public_shelters import router
from app.domain.pagination import Page
from app.domain.public_shelters import (
    PublicAlert,
    PublicSanitaryConditions,
    PublicShelter,
)
from app.domain.shelters import GeoPoint, Location
from app.infrastructure.repositories.mongo_albergue_repository import (
    MongoAlbergueRepository,
)

ID = "507f1f77bcf86cd799439012"
NOW = datetime(2026, 11, 17, 12, tzinfo=UTC)
PUBLIC = PublicShelter(
    id=ID, codigo_albergue="ALB-01", nombre="Albergue",
    ubicacion=Location(departamento="Risaralda", municipio="Pereira", direccion="Calle 1",
                       coordenadas=GeoPoint(type="Point", coordinates=(-75.7, 4.8))),
    capacidad_instalada=100, poblacion_actual=30, porcentaje_ocupacion=30, cupos_disponibles=70,
    nivel_riesgo=None, fecha_calculo_riesgo=None,
    condiciones_sanitarias=PublicSanitaryConditions(fecha=NOW, agua_potable_disponible=True,
        banos_disponibles=4, estado_higiene="adecuada", estado_saneamiento="adecuado"),
)


@pytest.fixture
def api():
    repository = MagicMock()
    repository.list_public.side_effect = lambda limit, offset, shelter_id=None: (
        [PUBLIC][offset:offset + limit] if shelter_id in (None, ID) else [])
    repository.public_alerts.return_value = [PublicAlert(id=str(ObjectId()), albergue_id=ID,
        fecha_alerta=NOW, nivel_riesgo="amarillo", tipo_alerta="agua", mensaje="Revisar agua", activa=True)]
    repository.page_public_shelters.side_effect = lambda paging, filters: Page.create(
        [PUBLIC][paging.offset:paging.offset + paging.page_size], paging, 1)
    repository.page_public_alerts.side_effect = lambda paging, filters, shelter_id=None, active=None: Page.create(
        repository.public_alerts.return_value[paging.offset:paging.offset + paging.page_size], paging, 1)
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.dependency_overrides[get_albergue_repository] = lambda: repository
    app.dependency_overrides[get_database] = lambda: MagicMock()
    return TestClient(app), repository, app


@pytest.mark.parametrize("path", ["/albergues", f"/albergues/{ID}",
    f"/albergues/{ID}/condiciones-sanitarias", "/alertas", f"/albergues/{ID}/alertas"])
def test_public_reads_need_no_token(api, path):
    client, _, _ = api
    response = client.get(f"/api/v1/publico{path}")
    assert response.status_code == 200, response.text
    for private in ("password", "email", "registrado_por", "datos_origen", "fuente_datos", "observaciones"):
        assert private not in response.text


def test_public_contract_filters_unexpected_private_fields(api):
    client, repository, _ = api
    repository.page_public_shelters.side_effect = None
    repository.page_public_shelters.return_value = Page([{**asdict(PUBLIC), "email": "private@example.com", "registrado_por": "private"}], 1, 20, 1, 1, False, False)
    data = client.get("/api/v1/publico/albergues").json()["items"][0]
    assert "email" not in data
    assert "registrado_por" not in data
    assert data["ubicacion"]["coordenadas"]["coordinates"] == [-75.7, 4.8]
    assert data["nivel_riesgo"] is None


def test_public_routes_are_read_only_and_admin_routes_keep_auth(api):
    client, _, _ = api
    assert client.post("/api/v1/publico/albergues", json={}).status_code == 405
    assert client.patch(f"/api/v1/publico/albergues/{ID}", json={}).status_code == 405
    assert client.get("/api/v1/albergues").status_code == 401


def test_pagination_and_unknown_shelters(api):
    client, _, _ = api
    assert client.get("/api/v1/publico/albergues?page=2&page_size=1").json()["items"] == []
    assert client.get("/api/v1/publico/albergues?page_size=101").status_code == 422
    assert client.get("/api/v1/publico/albergues?page=-1").status_code == 422
    assert client.get("/api/v1/publico/albergues/invalido").status_code == 404
    assert client.get("/api/v1/publico/albergues/invalido/alertas").status_code == 404


def test_openapi_does_not_require_auth_for_public_endpoints(api):
    _, _, app = api
    for path, operations in app.openapi()["paths"].items():
        if path.startswith("/api/v1/publico/"):
            assert not operations["get"].get("security")


def test_storage_filters_active_shelters_and_limits_public_fields():
    database = MagicMock()
    database.__getitem__.return_value.aggregate.return_value = []
    repository = MongoAlbergueRepository(database)
    assert repository.list_public(10, 5) == []
    pipeline = database.__getitem__.return_value.aggregate.call_args.args[0]
    assert pipeline[0] == {"$match": {"activo": True}}
    assert {"$skip": 5} in pipeline
    assert {"$limit": 10} in pipeline
    assert pipeline[4]["$project"] == {"codigo_albergue": 1, "nombre": 1, "ubicacion": 1, "capacidad_instalada": 1}
    database.__getitem__.return_value.aggregate.reset_mock()
    assert repository.list_public(10, 0, "invalido") == []
    database.__getitem__.return_value.aggregate.assert_not_called()


def test_alerts_preserve_existing_public_marker_and_hide_inactive_shelters():
    database = MagicMock()
    database.alertas.aggregate.return_value = []
    repository = MongoAlbergueRepository(database)
    assert repository.public_alerts(10, 0, ID) == []
    pipeline = database.alertas.aggregate.call_args.args[0]
    assert pipeline[0] == {"$match": {"publica": True, "albergue_id": ObjectId(ID)}}
    assert pipeline[1]["$lookup"]["pipeline"][0] == {"$match": {"activo": True}}
    assert pipeline[2] == {"$match": {"shelter.0": {"$exists": True}}}
    assert "datos_origen" not in pipeline[-1]["$project"]
