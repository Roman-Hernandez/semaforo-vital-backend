"""Pruebas de los registros diarios (RF-16 a RF-19). La API usa repositorios en memoria."""
import math
from datetime import UTC, datetime, time, timedelta
from unittest.mock import MagicMock

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError, OperationFailure, WriteError

from app.api import deps
from app.api.errors import register_error_handlers
from app.api.v1.endpoints.daily_records import router
from app.application.daily_records import DailyRecordService
from app.core.timezone import APP_TIMEZONE, now_colombia, start_of_day_colombia
from app.domain.daily_records import DailyRecord, DailyRecordCreate
from app.domain.errors import (
    DuplicateDailyRecord,
    InvalidDailyRecord,
    PersistenceError,
)
from app.domain.shelters import GeoPoint, Location, Shelter
from app.domain.users import User, UserRole
from app.infrastructure.repositories.mongo_daily_record_repository import (
    MongoDailyRecordRepository,
)

BASE = "/api/v1/mi-albergue/registros-diarios"
SHELTER = "507f1f77bcf86cd799439012"
OTHER_SHELTER = "507f1f77bcf86cd799439099"
NOW = datetime(2026, 11, 12, 12, tzinfo=UTC)
TODAY = now_colombia().date()
USER = User("507f1f77bcf86cd799439011", "admin@example.com", "x", UserRole.SHELTER_ADMIN, True,
            albergue_id=SHELTER)


def make_shelter(shelter_id=SHELTER, active=True):
    return Shelter(
        id=shelter_id, created_at=NOW, registrado_por=USER.id, codigo_albergue="ALB-1",
        nombre="Albergue", capacidad_instalada=100, activo=active, fecha=NOW,
        ubicacion=Location(
            departamento="Risaralda", municipio="Pereira", direccion="Calle 1",
            coordenadas=GeoPoint(type="Point", coordinates=(-75.7, 4.8)),
        ),
    )


class MemoryShelters:
    def __init__(self, *shelters):
        self.items = {s.id: s for s in shelters}

    def find(self, shelter_id):
        return self.items.get(shelter_id)


class MemoryRecords:
    def __init__(self):
        self.items: list[DailyRecord] = []

    def add(self, shelter_id, user_id, command, now):
        if any(r.albergue_id == shelter_id and r.fecha == command.fecha for r in self.items):
            raise DuplicateDailyRecord()
        record = DailyRecord(
            id=str(ObjectId()), created_at=now, registrado_por=user_id, albergue_id=shelter_id,
            fecha=command.fecha, poblacion=command.poblacion, litros_agua=float(command.litros_agua),
            letrinas=command.letrinas, casos_eda=command.casos_eda, casos_ira=command.casos_ira,
        )
        self.items.append(record)
        return record

    def find_by_day(self, shelter_id, day):
        return next((r for r in self.items if r.albergue_id == shelter_id and r.fecha == day), None)

    def history(self, shelter_id, limit, offset):
        own = sorted((r for r in self.items if r.albergue_id == shelter_id),
                     key=lambda r: r.fecha, reverse=True)
        return own[offset:offset + limit]


def body(day=None, **changes):
    value = {
        "fecha": (day or TODAY).isoformat(), "poblacion": 80, "litros_agua": 1500.5,
        "letrinas": 6, "casos_eda": 2, "casos_ira": 1,
    }
    value.update(changes)
    return value


@pytest.fixture
def records():
    return MemoryRecords()


@pytest.fixture
def shelters():
    return MemoryShelters(make_shelter())


@pytest.fixture
def make_client(records, shelters):
    def _make(user=USER):
        app = FastAPI()
        register_error_handlers(app)
        app.include_router(router, prefix="/api/v1")
        app.dependency_overrides[deps.get_daily_record_service] = lambda: DailyRecordService(records, shelters)
        app.dependency_overrides[deps.get_user_repository] = lambda: MagicMock()
        if user is not None:
            app.dependency_overrides[deps.get_current_user] = lambda: user
        return TestClient(app)
    return _make


# --- crear y consultar ------------------------------------------------------
def test_crea_registro_diario_valido(make_client, records):
    r = make_client().post(BASE, json=body())
    assert r.status_code == 201
    data = r.json()
    assert (data["poblacion"], data["litros_agua"], data["letrinas"]) == (80, 1500.5, 6)
    assert (data["casos_eda"], data["casos_ira"]) == (2, 1)
    assert len(records.items) == 1


def test_albergue_y_responsable_salen_del_usuario_autenticado(make_client):
    data = make_client().post(BASE, json=body()).json()
    assert data["albergue_id"] == SHELTER
    assert data["registrado_por"] == USER.id


def test_fecha_es_funcional_en_bogota(make_client):
    data = make_client().post(BASE, json=body()).json()
    assert datetime.fromisoformat(data["fecha"]).astimezone(APP_TIMEZONE).time() == time.min


def test_acepta_cero_y_litros_enteros(make_client):
    r = make_client().post(BASE, json=body(poblacion=0, litros_agua=0, letrinas=0, casos_eda=0, casos_ira=0))
    assert r.status_code == 201
    assert make_client().post(BASE, json=body(TODAY - timedelta(days=1), litros_agua=900)).status_code == 201


def test_consulta_por_fecha(make_client):
    client = make_client()
    client.post(BASE, json=body())
    r = client.get(f"{BASE}/{TODAY.isoformat()}")
    assert r.status_code == 200
    assert r.json()["poblacion"] == 80


def test_consulta_de_fecha_sin_registro_da_404(make_client):
    r = make_client().get(f"{BASE}/{TODAY.isoformat()}")
    assert r.status_code == 404
    assert r.json()["code"] == "DAILY_RECORD_NOT_FOUND"


def test_historial_del_mas_reciente_al_mas_antiguo_y_paginado(make_client):
    client = make_client()
    for days in (3, 1, 2):
        client.post(BASE, json=body(TODAY - timedelta(days=days)))
    fechas = [x["fecha"] for x in client.get(BASE).json()]
    assert fechas == sorted(fechas, reverse=True) and len(fechas) == 3
    assert [x["fecha"] for x in client.get(BASE, params={"limite": 1, "offset": 1}).json()] == fechas[1:2]


@pytest.mark.parametrize("params", [{"limite": 0}, {"limite": 366}, {"offset": -1}])
def test_paginacion_invalida_da_422(make_client, params):
    assert make_client().get(BASE, params=params).status_code == 422


def test_historial_solo_incluye_el_albergue_propio(make_client, records):
    records.items.append(DailyRecord(
        id=str(ObjectId()), created_at=NOW, registrado_por=USER.id, albergue_id=OTHER_SHELTER,
        fecha=start_of_day_colombia(TODAY), poblacion=1, litros_agua=1.0, letrinas=1, casos_eda=0, casos_ira=0,
    ))
    assert make_client().get(BASE).json() == []


def test_se_conservan_los_registros_historicos(make_client, records):
    client = make_client()
    client.post(BASE, json=body(TODAY - timedelta(days=1), poblacion=50))
    client.post(BASE, json=body(TODAY, poblacion=60))
    assert sorted(r.poblacion for r in records.items) == [50, 60]


def test_no_hay_modificacion_ni_borrado(make_client):
    client = make_client()
    client.post(BASE, json=body())
    day = f"{BASE}/{TODAY.isoformat()}"
    assert client.put(day, json=body()).status_code == 405
    assert client.patch(day, json={"poblacion": 1}).status_code == 405
    assert client.delete(day).status_code == 405


# --- validación -------------------------------------------------------------
@pytest.mark.parametrize("cambios", [
    {"poblacion": -1}, {"letrinas": -1}, {"casos_eda": -1}, {"casos_ira": -1}, {"litros_agua": -0.5},
    {"poblacion": "80"}, {"poblacion": 80.5}, {"poblacion": True}, {"casos_eda": None},
    {"litros_agua": "abc"}, {"litros_agua": 1_000_000_001}, {"poblacion": 2_147_483_648},
    {"fecha": "no-es-fecha"}, {"fecha": "2026-13-45"},
    {"albergue_id": SHELTER}, {"registrado_por": USER.id}, {"otro": 1},
])
def test_datos_invalidos_dan_422(make_client, records, cambios):
    assert make_client().post(BASE, json=body(**cambios)).status_code == 422
    assert records.items == []


@pytest.mark.parametrize("campo", ["fecha", "poblacion", "litros_agua", "letrinas", "casos_eda", "casos_ira"])
def test_campos_obligatorios(make_client, campo):
    cuerpo = body()
    del cuerpo[campo]
    assert make_client().post(BASE, json=cuerpo).status_code == 422


def test_fecha_futura_da_422(make_client, records):
    r = make_client().post(BASE, json=body(TODAY + timedelta(days=1)))
    assert r.status_code == 422
    assert r.json()["code"] == "INVALID_DAILY_RECORD"
    assert records.items == []


def test_la_respuesta_de_validacion_no_repite_el_valor_enviado(make_client):
    r = make_client().post(BASE, json=body(poblacion="secreto-123"))
    assert "secreto-123" not in r.text


# --- duplicados -------------------------------------------------------------
def test_un_registro_por_albergue_y_dia(make_client, records):
    client = make_client()
    assert client.post(BASE, json=body()).status_code == 201
    r = client.post(BASE, json=body(poblacion=999))
    assert r.status_code == 409
    assert r.json()["code"] == "DAILY_RECORD_DUPLICATE"
    assert [x.poblacion for x in records.items] == [80]  # el original no se pisa


def test_otro_dia_no_es_duplicado(make_client):
    client = make_client()
    assert client.post(BASE, json=body()).status_code == 201
    assert client.post(BASE, json=body(TODAY - timedelta(days=1))).status_code == 201


# --- referencias inexistentes y autorización ---------------------------------
def test_sin_credenciales_da_401(make_client):
    assert make_client(None).post(BASE, json=body()).status_code == 401
    assert make_client(None).get(BASE).status_code == 401


def test_super_admin_no_registra_por_un_albergue(make_client, records):
    boss = User("507f1f77bcf86cd799439055", "s@example.com", "x", UserRole.SUPER_ADMIN, True)
    assert make_client(boss).post(BASE, json=body()).status_code == 403
    assert records.items == []


def test_administrador_sin_albergue_asignado_da_403(make_client):
    orphan = User("507f1f77bcf86cd799439056", "o@example.com", "x", UserRole.SHELTER_ADMIN, True)
    assert make_client(orphan).post(BASE, json=body()).status_code == 403


def test_usuario_inactivo_da_403(make_client):
    inactive = User(USER.id, "a@example.com", "x", UserRole.SHELTER_ADMIN, False, albergue_id=SHELTER)
    assert make_client(inactive).post(BASE, json=body()).status_code == 403


def test_albergue_inexistente_da_404(make_client, records):
    ghost = User(USER.id, "a@example.com", "x", UserRole.SHELTER_ADMIN, True, albergue_id=OTHER_SHELTER)
    r = make_client(ghost).post(BASE, json=body())
    assert r.status_code == 404
    assert r.json()["code"] == "SHELTER_NOT_FOUND"
    assert records.items == []


def test_albergue_desactivado_no_recibe_registros(make_client, shelters, records):
    shelters.items[SHELTER] = make_shelter(active=False)
    r = make_client().post(BASE, json=body())
    assert r.status_code == 409
    assert r.json()["code"] == "SHELTER_INACTIVE"
    assert records.items == []


# --- dominio ----------------------------------------------------------------
@pytest.mark.parametrize("cambios", [
    {"poblacion": True}, {"poblacion": -1}, {"letrinas": 1.5}, {"casos_ira": 2**31},
    {"litros_agua": math.nan}, {"litros_agua": math.inf}, {"litros_agua": -1}, {"litros_agua": "10"},
])
def test_dominio_rechaza_valores_fuera_de_rango(cambios):
    valores = {
        "fecha": NOW, "poblacion": 1, "litros_agua": 1.0, "letrinas": 1, "casos_eda": 0, "casos_ira": 0,
    }
    valores.update(cambios)
    with pytest.raises(InvalidDailyRecord):
        DailyRecordCreate(**valores)


# --- persistencia (adaptador de Mongo con base simulada) ---------------------
COMMAND = DailyRecordCreate(fecha=start_of_day_colombia(TODAY), poblacion=80, litros_agua=1500,
                            letrinas=6, casos_eda=2, casos_ira=1)


def test_mongo_inserta_el_documento_del_contrato():
    database = MagicMock()
    record = MongoDailyRecordRepository(database).add(SHELTER, USER.id, COMMAND, NOW)
    document = database["registros_diarios"].insert_one.call_args.args[0]
    assert set(document) - {"_id"} == {
        "albergue_id", "fecha", "poblacion", "litros_agua", "letrinas", "casos_eda", "casos_ira",
        "registrado_por", "created_at",
    }
    assert document["albergue_id"] == ObjectId(SHELTER)
    assert document["registrado_por"] == ObjectId(USER.id)
    assert isinstance(document["litros_agua"], float)
    assert record.albergue_id == SHELTER and record.registrado_por == USER.id


def test_mongo_traduce_indice_unico_a_duplicado():
    database = MagicMock()
    database["registros_diarios"].insert_one.side_effect = DuplicateKeyError("E11000 secret")
    with pytest.raises(DuplicateDailyRecord):
        MongoDailyRecordRepository(database).add(SHELTER, USER.id, COMMAND, NOW)


def test_mongo_traduce_validador_de_esquema_a_dato_invalido():
    database = MagicMock()
    database["registros_diarios"].insert_one.side_effect = WriteError("Document failed validation", code=121)
    with pytest.raises(InvalidDailyRecord):
        MongoDailyRecordRepository(database).add(SHELTER, USER.id, COMMAND, NOW)


def test_mongo_oculta_errores_internos():
    database = MagicMock()
    database["registros_diarios"].insert_one.side_effect = OperationFailure("secret database info")
    with pytest.raises(PersistenceError):
        MongoDailyRecordRepository(database).add(SHELTER, USER.id, COMMAND, NOW)


def test_mongo_consulta_por_albergue_y_fecha_y_mapea():
    database = MagicMock()
    database["registros_diarios"].find_one.return_value = {
        "_id": ObjectId(), "albergue_id": ObjectId(SHELTER), "fecha": NOW, "poblacion": 5,
        "litros_agua": 10, "letrinas": 1, "casos_eda": 0, "casos_ira": 0,
        "registrado_por": ObjectId(USER.id), "created_at": NOW, "campo_privado": "nunca",
    }
    record = MongoDailyRecordRepository(database).find_by_day(SHELTER, NOW)
    database["registros_diarios"].find_one.assert_called_once_with(
        {"albergue_id": ObjectId(SHELTER), "fecha": NOW})
    assert record.litros_agua == 10.0 and record.albergue_id == SHELTER
    assert "campo_privado" not in vars(record)


def test_mongo_historial_ordena_pagina_y_limita():
    database = MagicMock()
    MongoDailyRecordRepository(database).history(SHELTER, 10, 20)
    collection = database["registros_diarios"]
    collection.find.assert_called_once_with({"albergue_id": ObjectId(SHELTER)})
    cursor = collection.find.return_value.sort.return_value
    cursor.skip.assert_called_once_with(20)
    cursor.skip.return_value.limit.assert_called_once_with(10)


def test_el_repositorio_nunca_borra_ni_modifica():
    database = MagicMock()
    repository = MongoDailyRecordRepository(database)
    repository.add(SHELTER, USER.id, COMMAND, NOW)
    repository.find_by_day(SHELTER, NOW)
    repository.history(SHELTER, 1, 0)
    collection = database["registros_diarios"]
    for operation in ("delete_one", "delete_many", "update_one", "update_many",
                      "replace_one", "find_one_and_update", "find_one_and_delete", "drop"):
        assert not getattr(collection, operation).called
