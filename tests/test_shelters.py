from dataclasses import asdict, replace
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError, OperationFailure

from app.api.deps import get_current_user, get_shelter_service, get_user_repository
from app.application.shelters import ShelterService
from app.core.timezone import start_of_day_colombia
from app.domain.errors import PersistenceError, PopulationConflict
from app.domain.shelters import (
    DailyCases,
    DashboardSources,
    GeoPoint,
    IntradayOccupancy,
    Location,
    PopulationRecord,
    Shelter,
    ShelterIndicators,
    TrafficLight,
    occupancy,
)
from app.domain.users import User, UserRole
from app.infrastructure.repositories.mongo_shelter_repository import (
    MongoShelterRepository,
)
from app.main import _request_hits, app

SHELTER = "507f1f77bcf86cd799439012"
USER = User("507f1f77bcf86cd799439011", "admin@example.com", "secret", UserRole.SHELTER_ADMIN, True, albergue_id=SHELTER)
NOW = datetime(2026, 11, 12, 12, tzinfo=UTC)


class MemoryShelterRepository:
    def __init__(self):
        self.shelter = Shelter(
            id=SHELTER, nombre="Albergue", capacidad_instalada=10, created_at=NOW,
            registrado_por=USER.id, codigo_albergue="ALB-1", activo=True, fecha=NOW,
            ubicacion=Location(
                departamento="Risaralda", municipio="Pereira", direccion="Calle 1",
                coordenadas=GeoPoint(type="Point", coordinates=(-75.7, 4.8)),
            ),
        )
        self.records = {}
        self.calls = []

    def find(self, shelter_id):
        self.calls.append(shelter_id)
        return self.shelter if shelter_id == SHELTER else None

    def update(self, shelter_id, changes, user_id, now):
        if not self.find(shelter_id):
            return None
        values = {key: value for key, value in asdict(changes).items() if value is not None}
        if changes.ubicacion is not None:
            values["ubicacion"] = changes.ubicacion
        self.shelter = replace(self.shelter, **values, updated_by=user_id, updated_at=now)
        return self.shelter

    def population_history(self, shelter_id, limit, offset):
        assert shelter_id == SHELTER
        return sorted(self.records.values(), key=lambda row: row.fecha, reverse=True)[offset:offset + limit]

    def save_population(self, shelter_id, user_id, day, population, now):
        assert shelter_id == SHELTER
        previous = self.records.get(day)
        row = PopulationRecord(
            id=str(ObjectId()), albergue_id=shelter_id, fecha=day, poblacion=population,
            created_at=previous.created_at if previous else now,
            registrado_por=previous.registrado_por if previous else user_id,
            updated_by=user_id, updated_at=now,
        )
        self.records[day] = row
        return row

    def latest_metrics(self, shelter_id):
        return ShelterIndicators()

    def dashboard_sources(self, shelter_id, limit):
        assert shelter_id == SHELTER
        return DashboardSources()


@pytest.fixture
def api():
    repository = MemoryShelterRepository()
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[get_user_repository] = lambda: MagicMock()
    app.dependency_overrides[get_shelter_service] = lambda: ShelterService(repository)
    _request_hits.clear()
    client = TestClient(app)
    yield client, repository
    client.close()
    app.dependency_overrides.clear()
    _request_hits.clear()


def test_dashboard_without_data_is_explicit_and_private(api):
    client, repository = api
    response = client.get("/api/v1/mi-albergue/dashboard?albergue_id=another")
    assert response.status_code == 200
    data = response.json()
    assert data["albergue"]["id"] == SHELTER
    assert data["poblacion_actual"] is None
    assert data["semaforo_vital"] is None
    assert data["alertas"]["cantidad"] is None
    assert data["predicciones"] == []
    assert "password_hash" not in str(data)
    assert set(repository.calls) == {SHELTER}


@pytest.mark.parametrize("user", [replace(USER, role=UserRole.SUPER_ADMIN), replace(USER, albergue_id=None), replace(USER, active=False)])
def test_role_assignment_and_active_status_are_checked(api, user):
    client, repository = api
    app.dependency_overrides[get_current_user] = lambda: user
    assert client.get("/api/v1/mi-albergue").status_code == 403
    assert repository.calls == []


def test_authentication_required(api):
    client, _ = api
    del app.dependency_overrides[get_current_user]
    assert client.get("/api/v1/mi-albergue").status_code == 401


@pytest.mark.parametrize("value", [-1, 1.5, True, "10", 2147483648, None])
def test_invalid_population_is_rejected(api, value):
    client, repository = api
    response = client.put("/api/v1/mi-albergue/poblacion", json={"fecha": "2026-11-12", "poblacion": value})
    assert response.status_code == 422
    assert not repository.records


def test_population_upsert_preserves_other_days_and_zero(api):
    client, repository = api
    for day, count in [("2026-11-11", 3), ("2026-11-12", 12), ("2026-11-12", 0)]:
        response = client.put("/api/v1/mi-albergue/poblacion", json={"fecha": day, "poblacion": count})
        assert response.status_code == 200
    records = client.get("/api/v1/mi-albergue/poblacion/historial").json()
    assert [row["poblacion"] for row in records] == [0, 3]
    assert records[0]["fecha"].startswith("2026-11-12T00:00:00-05:00")
    assert records[0]["registrado_por"] == USER.id
    data = client.get("/api/v1/mi-albergue/poblacion").json()
    assert data["porcentaje_ocupacion"] == 0
    assert data["cupos_disponibles"] == 10
    assert len(repository.records) == 2


@pytest.mark.parametrize("payload", [{}, {"activo": False}, {"registrado_por": "another"}, {"nombre": None}, {"nombre": "  "}, {"capacidad_instalada": -1}])
def test_shelter_update_allowlist(api, payload):
    client, _ = api
    assert client.patch("/api/v1/mi-albergue", json=payload).status_code == 422


def test_update_traces_author_and_missing_shelter(api):
    client, _ = api
    response = client.patch("/api/v1/mi-albergue", json={"nombre": "Nuevo", "capacidad_instalada": 0})
    assert response.status_code == 200
    assert response.json()["updated_by"] == USER.id
    app.dependency_overrides[get_current_user] = lambda: replace(USER, albergue_id="another")
    assert client.get("/api/v1/mi-albergue").status_code == 404


def test_occupancy_edge_cases():
    assert occupancy(0, 5).porcentaje_ocupacion is None
    assert occupancy(10, 12).porcentaje_ocupacion == 120
    assert occupancy(10, 12).cupos_disponibles == 0
    assert occupancy(10, None).cupos_disponibles is None


def test_intraday_measurement_never_overwrites_daily_population():
    repository = MemoryShelterRepository()
    service = ShelterService(repository)
    service.save_population(USER, start_of_day_colombia(NOW), 5, NOW)
    sources = repository.dashboard_sources(SHELTER, 30)
    metrics = ShelterIndicators(
        ocupacion=IntradayOccupancy(porcentaje_ocupacion=80, personas_alojadas=8, fecha_hora=NOW),
        semaforo=TrafficLight(nivel="rojo"), ultima_actualizacion=NOW,
    )
    repository.latest_metrics = lambda *args: metrics
    repository.dashboard_sources = lambda *args: sources
    result = service.dashboard(USER, 30)
    assert result.porcentaje_ocupacion == 50
    assert result.ocupacion_intradia.porcentaje_ocupacion == 80
    assert result.semaforo_vital.descripcion == "Riesgo crítico"


def test_mongo_population_upsert_uses_independent_history():
    database = MagicMock()
    database.historial_poblacion.find_one_and_update.return_value = {
        "_id": ObjectId(), "poblacion": 5, "albergue_id": ObjectId(SHELTER),
        "fecha": NOW, "created_at": NOW, "registrado_por": ObjectId(USER.id),
    }
    repository = MongoShelterRepository(database)
    day = start_of_day_colombia(NOW)
    result = repository.save_population(SHELTER, USER.id, day, 5, NOW)
    query, update = database.historial_poblacion.find_one_and_update.call_args.args
    assert query == {"albergue_id": ObjectId(SHELTER), "fecha": day}
    assert set(update["$set"]) == {"poblacion", "updated_at", "updated_by"}
    assert update["$setOnInsert"]["registrado_por"] == ObjectId(USER.id)
    assert isinstance(result.id, str)
    assert not database.registros_diarios.mock_calls
    assert not database.albergues.mock_calls


@pytest.mark.parametrize("error, expected", [(DuplicateKeyError("duplicate"), PopulationConflict), (OperationFailure("secret database info"), PersistenceError)])
def test_persistence_errors_are_translated(error, expected):
    database = MagicMock()
    database.historial_poblacion.find_one_and_update.side_effect = error
    repository = MongoShelterRepository(database)
    with pytest.raises(expected):
        repository.save_population(SHELTER, USER.id, NOW, 1, NOW)


@pytest.mark.parametrize("error, code", [(PersistenceError(), 503), (PopulationConflict(), 409)])
def test_api_persistence_errors_are_controlled(api, error, code):
    client, repository = api
    def fail(*args):
        raise error
    repository.save_population = fail
    response = client.put("/api/v1/mi-albergue/poblacion", json={"fecha": "2026-11-12", "poblacion": 1})
    assert response.status_code == code


def test_mongo_dashboard_reads_are_scoped_to_the_assigned_shelter():
    database = MagicMock()
    repository = MongoShelterRepository(database)
    for collection in ("condiciones_sanitarias", "analisis_ia", "registros_diarios"):
        database[collection].find_one.return_value = None
    repository.dashboard_sources(SHELTER, 30)
    for collection in ("condiciones_sanitarias", "analisis_ia", "registros_diarios"):
        query = database[collection].find_one.call_args.args[0]
        assert query == {"albergue_id": ObjectId(SHELTER)}
    for collection in ("casos_enfermedades", "intervenciones"):
        query = database[collection].find.call_args.args[0]
        assert query == {"albergue_id": ObjectId(SHELTER)}
    pipeline = database.casos_enfermedades.aggregate.call_args.args[0]
    assert pipeline[0] == {"$match": {"albergue_id": ObjectId(SHELTER)}}


@pytest.mark.parametrize("coordinates", [[181, 0], [0, 91], [0], [0, 0, 0]])
def test_location_coordinates_are_validated(api, coordinates):
    client, _ = api
    response = client.patch("/api/v1/mi-albergue", json={"ubicacion": {
        "departamento": "Risaralda", "municipio": "Pereira", "direccion": "Calle 1",
        "coordenadas": {"type": "Point", "coordinates": coordinates},
    }})
    assert response.status_code == 422


def test_population_history_reads_only_its_own_collection():
    database = MagicMock()
    MongoShelterRepository(database).population_history(SHELTER, 10, 20)
    collection = database.historial_poblacion
    collection.find.assert_called_once_with({"albergue_id": ObjectId(SHELTER)})
    cursor = collection.find.return_value.sort.return_value
    cursor.skip.assert_called_once_with(20)
    cursor.skip.return_value.limit.assert_called_once_with(10)
    assert not database.registros_diarios.mock_calls


def test_daily_cases_remain_independent_of_population_history():
    repository = MemoryShelterRepository()
    service = ShelterService(repository)
    service.save_population(USER, start_of_day_colombia(NOW), 10, NOW)
    sources = repository.dashboard_sources(SHELTER, 30)
    sources = replace(sources, casos_diarios=DailyCases(casos_eda=3, casos_ira=2, ultima_actualizacion=NOW))
    repository.dashboard_sources = lambda *args: sources
    result = service.dashboard(USER, 30)
    assert result.poblacion_actual == 10
    assert result.casos_diarios.casos_eda == 3
    assert result.casos_diarios.casos_ira == 2


def test_mongo_adapter_maps_shelter_and_discards_unknown_fields():
    repository = MemoryShelterRepository()
    document = asdict(repository.shelter)
    document["_id"] = ObjectId(document.pop("id"))
    document["registrado_por"] = ObjectId(document["registrado_por"])
    document["private_notes"] = "never expose"
    database = MagicMock()
    database.albergues.find_one.return_value = document
    result = MongoShelterRepository(database).find(SHELTER)
    assert result == repository.shelter
    assert "private_notes" not in asdict(result)


def test_mongo_bucket_structure_is_hidden_from_application():
    from bson.decimal128 import Decimal128
    database = MagicMock()
    database.metricas_albergue.find_one.return_value = {
        "calculados": {"porcentaje_ocupacion": Decimal128("80.5")},
        "ultima_medicion": {"personas_alojadas": 8, "fecha_hora": NOW},
        "estado_actual": {"semaforo_vital": {"nivel": "rojo"}, "alertas_activas": {"cantidad": 2}},
        "created_at": NOW,
    }
    result = MongoShelterRepository(database).latest_metrics(SHELTER)
    assert isinstance(result, ShelterIndicators)
    assert result.ocupacion.porcentaje_ocupacion == 80.5
    assert result.semaforo.nivel == "rojo"
    assert result.alertas_activas == 2
    assert not hasattr(result, "calculados")
    database.metricas_albergue.find_one.return_value = None
    assert MongoShelterRepository(database).latest_metrics(SHELTER) == ShelterIndicators()


def test_duplicate_shelter_update_is_not_a_population_conflict():
    from app.domain.shelters import ShelterUpdate
    database = MagicMock()
    database.albergues.find_one_and_update.side_effect = DuplicateKeyError("duplicate")
    repository = MongoShelterRepository(database)
    changes = ShelterUpdate(nombre="Nuevo")
    with pytest.raises(PersistenceError):
        repository.update(SHELTER, changes, USER.id, NOW)


def test_shelter_response_cannot_expose_undeclared_fields(api):
    client, repository = api
    object.__setattr__(repository.shelter, "private_notes", "never expose")
    response = client.get("/api/v1/mi-albergue")
    assert response.status_code == 200
    assert "private_notes" not in response.text


def test_invalid_population_and_shelter_data_have_domain_errors():
    from app.domain.errors import InvalidPopulation, InvalidShelterData
    from app.domain.shelters import ShelterUpdate
    service = ShelterService(MemoryShelterRepository())
    with pytest.raises(InvalidPopulation):
        service.save_population(USER, NOW, -1, NOW)
    with pytest.raises(InvalidShelterData):
        ShelterUpdate()
    with pytest.raises(InvalidShelterData):
        ShelterUpdate(nombre=" ")
    with pytest.raises(InvalidShelterData):
        ShelterUpdate(capacidad_instalada=-1)


def test_storage_integer_limit_is_checked_by_the_mongo_adapter():
    from app.domain.errors import InvalidPopulation
    database = MagicMock()
    repository = MongoShelterRepository(database)
    with pytest.raises(InvalidPopulation):
        repository.save_population(SHELTER, USER.id, NOW, 2**31, NOW)
    database.historial_poblacion.find_one_and_update.assert_not_called()


def test_dashboard_maps_all_stored_sources_to_explicit_response_types(api):
    from bson.decimal128 import Decimal128
    client, repository = api
    database = MagicMock()
    database.__getitem__.side_effect = lambda name: getattr(database, name)
    shelter_doc = asdict(repository.shelter)
    shelter_doc["_id"] = ObjectId(shelter_doc.pop("id"))
    database.albergues.find_one.return_value = shelter_doc
    database.historial_poblacion.find.return_value.sort.return_value.skip.return_value.limit.return_value = []
    database.metricas_albergue.find_one.return_value = None
    trace = {"_id": ObjectId(), "albergue_id": ObjectId(SHELTER), "created_at": NOW, "registrado_por": ObjectId(USER.id)}
    database["registros_diarios"].find_one.return_value = {**trace, "casos_eda": 3, "casos_ira": 2}
    database["condiciones_sanitarias"].find_one.return_value = {
        **trace, "fecha": NOW, "agua_potable_disponible": True, "banos_disponibles": 4,
        "estado_higiene": "bueno", "estado_saneamiento": "bueno", "fuente_datos": "inspeccion",
        "otros_recursos_sanitarios": [{"nombre": "letrinas", "cantidad": 2, "observacion": "operativas"}],
        "private_notes": "never expose",
    }
    database["analisis_ia"].find_one.return_value = {
        **trace, "fecha_ejecucion": NOW,
        "periodo_analizado": {"fecha_inicio": NOW, "fecha_fin": NOW},
        "modelo": {"nombre": "riesgo", "version": "1"},
        "resultado": {"probabilidad_riesgo": Decimal128("0.25")},
        "datos_entrada": {
            "registros_diarios_ids": [ObjectId()], "condiciones_sanitarias_ids": [],
            "casos_enfermedades_ids": [], "intervenciones_ids": [], "metricas_albergue_ids": [],
        },
        "preprocesamiento": {"registros_considerados": 1, "registros_descartados": 0,
                              "datos_faltantes": [{"campo": "agua", "cantidad": 1, "tratamiento": "excluir"}]},
    }
    case = {**trace, "fecha": NOW, "enfermedad": "EDA", "cantidad_casos_activos": 3, "fuente_datos": "reporte"}
    database["casos_enfermedades"].find.return_value.sort.return_value.limit.return_value = [case]
    database.casos_enfermedades.aggregate.return_value = [{"enfermedad": "EDA", "cantidad_casos_activos": 3, "fecha": NOW}]
    database["intervenciones"].find.return_value.sort.return_value.limit.return_value = [{
        **trace, "fecha_intervencion": NOW, "tipo_intervencion": "agua",
        "descripcion": "Entrega de agua", "fuente_datos": "reporte",
    }]
    app.dependency_overrides[get_shelter_service] = lambda: ShelterService(MongoShelterRepository(database))
    response = client.get("/api/v1/mi-albergue/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["casos_diarios"]["casos_eda"] == 3
    assert data["condiciones_sanitarias"]["otros_recursos_sanitarios"][0]["cantidad"] == 2
    assert data["analisis_ia"]["resultado"]["probabilidad_riesgo"] == 0.25
    assert isinstance(data["analisis_ia"]["datos_entrada"]["registros_diarios_ids"][0], str)
    assert data["analisis_ia"]["preprocesamiento"]["datos_faltantes"][0]["campo"] == "agua"
    assert data["resumen_casos"][0]["cantidad_casos_activos"] == 3
    assert data["evolucion_epidemiologica"][0]["enfermedad"] == "EDA"
    assert data["intervenciones"][0]["estado"] is None
    assert "private_notes" not in response.text
    assert data["ultima_actualizacion"] == NOW.isoformat().replace("+00:00", "Z")
