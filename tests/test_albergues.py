"""Pruebas de la API de albergues (RF-41). Usan un repositorio en memoria: no requieren MongoDB."""
import copy
from dataclasses import asdict, replace
from datetime import UTC, datetime, time

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import deps
from app.api.errors import register_error_handlers
from app.api.v1.endpoints.albergues import router
from app.core.timezone import APP_TIMEZONE
from app.domain.errors import DuplicateShelterCode
from app.domain.shelters import GeoPoint, Location, Shelter
from app.domain.users import User, UserRole

BASE = "/api/v1/albergues"
NOW = datetime(2026, 11, 15, 12, tzinfo=UTC)


def _user(role, albergue_id=None):
    return User(str(ObjectId()), "u@example.com", "x", role, True, albergue_id=albergue_id)


SUPER = _user(UserRole.SUPER_ADMIN)


class FakeAlbergueRepository:
    def __init__(self):
        self.docs: dict[str, Shelter] = {}

    def add(self, command, user_id, now, day):
        if any(s.codigo_albergue == command.codigo_albergue for s in self.docs.values()):
            raise DuplicateShelterCode()
        shelter = Shelter(
            id=str(ObjectId()), created_at=now, registrado_por=user_id,
            codigo_albergue=command.codigo_albergue, nombre=command.nombre,
            ubicacion=command.ubicacion, capacidad_instalada=command.capacidad_instalada,
            activo=True, fecha=day,
        )
        self.docs[shelter.id] = shelter
        return shelter

    def find(self, shelter_id):
        return self.docs.get(shelter_id)

    def list(self, active=None):
        shelters = [s for s in self.docs.values() if active is None or s.activo == active]
        return sorted(shelters, key=lambda s: s.codigo_albergue)

    def update(self, shelter_id, changes, user_id, now):
        shelter = self.docs.get(shelter_id)
        if shelter is None:
            return None
        values = {key: value for key, value in asdict(changes).items() if value is not None}
        if changes.ubicacion is not None:
            values["ubicacion"] = changes.ubicacion
        self.docs[shelter_id] = replace(shelter, **values, updated_by=user_id, updated_at=now)
        return self.docs[shelter_id]

    def deactivate(self, shelter_id, user_id, now):
        shelter = self.docs.get(shelter_id)
        if shelter is None:
            return None
        self.docs[shelter_id] = replace(shelter, activo=False, updated_by=user_id, updated_at=now)
        return self.docs[shelter_id]


def payload(**cambios):
    cuerpo = {
        "codigo_albergue": "SIM-PER-003",
        "nombre": "Albergue Ejemplo",
        "capacidad_instalada": 120,
        "ubicacion": {
            "departamento": "Risaralda",
            "municipio": "Pereira",
            "direccion": "Calle 1 # 2-3",
            "coordenadas": {"type": "Point", "coordinates": [-75.6946, 4.8143]},
        },
    }
    cuerpo.update(cambios)
    return cuerpo


def sembrar(repo, codigo="SIM-PER-001", activo=True):
    shelter = Shelter(
        id=str(ObjectId()), created_at=NOW, registrado_por=SUPER.id, codigo_albergue=codigo,
        nombre="Albergue Ejemplo", activo=activo, fecha=NOW, capacidad_instalada=120,
        ubicacion=Location(
            departamento="Risaralda", municipio="Pereira", direccion="Calle 1 # 2-3",
            coordenadas=GeoPoint(type="Point", coordinates=(-75.6946, 4.8143)),
        ),
    )
    repo.docs[shelter.id] = shelter
    return shelter


def admin_de(albergue):
    return _user(UserRole.SHELTER_ADMIN, albergue.id)


@pytest.fixture
def repo():
    return FakeAlbergueRepository()


@pytest.fixture
def make_client(repo):
    def _make(actor=None):
        app = FastAPI()
        register_error_handlers(app)
        app.include_router(router, prefix="/api/v1")
        app.dependency_overrides[deps.get_albergue_repository] = lambda: repo
        # get_current_user depende del repositorio de usuarios; sin credenciales no llega a usarlo.
        app.dependency_overrides[deps.get_user_repository] = lambda: object()
        if actor is not None:
            app.dependency_overrides[deps.get_current_user] = lambda: actor
        return TestClient(app)

    return _make


# --- datos válidos ----------------------------------------------------------
def test_super_crea_albergue_valido(make_client):
    r = make_client(SUPER).post(BASE, json=payload())
    assert r.status_code == 201
    cuerpo = r.json()
    assert cuerpo["codigo_albergue"] == "SIM-PER-003"
    assert cuerpo["activo"] is True
    assert cuerpo["registrado_por"] == SUPER.id
    assert cuerpo["ubicacion"]["coordenadas"]["coordinates"] == [-75.6946, 4.8143]


def test_crear_fija_fecha_funcional_en_bogota(make_client):
    cuerpo = make_client(SUPER).post(BASE, json=payload()).json()
    fecha = datetime.fromisoformat(cuerpo["fecha"])
    assert fecha.astimezone(APP_TIMEZONE).time() == time.min  # 00:00 America/Bogota


def test_codigo_se_normaliza_a_mayusculas(make_client):
    r = make_client(SUPER).post(BASE, json=payload(codigo_albergue="sim-per-009"))
    assert r.status_code == 201
    assert r.json()["codigo_albergue"] == "SIM-PER-009"


def test_capacidad_cero_es_valida_segun_el_contrato(make_client):
    assert make_client(SUPER).post(BASE, json=payload(capacidad_instalada=0)).status_code == 201


def test_super_consulta_y_lista(make_client, repo):
    a = sembrar(repo, "SIM-PER-001")
    sembrar(repo, "SIM-PER-002")
    client = make_client(SUPER)
    assert client.get(f"{BASE}/{a.id}").json()["codigo_albergue"] == "SIM-PER-001"
    assert [x["codigo_albergue"] for x in client.get(BASE).json()] == ["SIM-PER-001", "SIM-PER-002"]


def test_super_modifica_albergue(make_client, repo):
    a = sembrar(repo)
    r = make_client(SUPER).patch(
        f"{BASE}/{a.id}", json={"nombre": "Nombre nuevo", "capacidad_instalada": 300}
    )
    assert r.status_code == 200
    assert r.json()["nombre"] == "Nombre nuevo"
    assert r.json()["capacidad_instalada"] == 300


def test_modificar_registra_updated_by(make_client, repo):
    a = sembrar(repo)
    r = make_client(SUPER).patch(f"{BASE}/{a.id}", json={"capacidad_instalada": 300})
    assert r.json()["updated_by"] == SUPER.id
    assert r.json()["updated_at"] is not None


def test_albergue_inexistente_o_id_mal_formado_da_404(make_client):
    client = make_client(SUPER)
    assert client.get(f"{BASE}/{ObjectId()}").status_code == 404
    assert client.get(f"{BASE}/no-es-un-id").status_code == 404


# --- datos inválidos --------------------------------------------------------
UBIC = payload()["ubicacion"]


def _ubic_con(coordinates=None, **extra):
    u = copy.deepcopy(UBIC)
    if coordinates is not None:
        u["coordenadas"]["coordinates"] = coordinates
    u.update(extra)
    return u


@pytest.mark.parametrize(
    "cambios",
    [
        {"nombre": ""},
        {"capacidad_instalada": -5},
        {"capacidad_instalada": "100"},
        {"capacidad_instalada": 2_147_483_648},
        {"codigo_albergue": "ab c"},
        {"codigo_albergue": "SIM_PER_001"},
        {"codigo_albergue": ""},
        {"ubicacion": _ubic_con([-75.69, 95])},       # latitud fuera de rango
        {"ubicacion": _ubic_con([-200, 4.8])},        # longitud fuera de rango
        {"ubicacion": _ubic_con([-75.69])},           # falta la latitud
        {"ubicacion": _ubic_con([-75.69, 4.8, 10])},  # sobra un valor
        {"ubicacion": _ubic_con(municipio="")},
        {"ubicacion": _ubic_con(direccion="")},
        {"campo_desconocido": "x"},
    ],
)
def test_datos_invalidos_dan_422(make_client, repo, cambios):
    r = make_client(SUPER).post(BASE, json=payload(**cambios))
    assert r.status_code == 422
    assert repo.docs == {}


@pytest.mark.parametrize("campo", ["codigo_albergue", "nombre", "capacidad_instalada", "ubicacion"])
def test_campos_obligatorios(make_client, campo):
    cuerpo = payload()
    del cuerpo[campo]
    assert make_client(SUPER).post(BASE, json=cuerpo).status_code == 422


def test_direccion_es_obligatoria(make_client, repo):
    u = _ubic_con()
    del u["direccion"]
    assert make_client(SUPER).post(BASE, json=payload(ubicacion=u)).status_code == 422
    assert repo.docs == {}


def test_tipo_de_geometria_debe_ser_point(make_client):
    u = _ubic_con()
    u["coordenadas"]["type"] = "Polygon"
    assert make_client(SUPER).post(BASE, json=payload(ubicacion=u)).status_code == 422


def test_patch_vacio_o_con_codigo_da_422(make_client, repo):
    a = sembrar(repo)
    client = make_client(SUPER)
    assert client.patch(f"{BASE}/{a.id}", json={}).status_code == 422
    assert client.patch(f"{BASE}/{a.id}", json={"codigo_albergue": "OTRO-001"}).status_code == 422
    assert client.patch(f"{BASE}/{a.id}", json={"activo": False}).status_code == 422


# --- duplicados -------------------------------------------------------------
def test_codigo_duplicado_da_409(make_client, repo):
    client = make_client(SUPER)
    assert client.post(BASE, json=payload()).status_code == 201
    r = client.post(BASE, json=payload(nombre="Otro nombre"))
    assert r.status_code == 409
    assert r.json()["code"] == "SHELTER_CODE_DUPLICATE"
    assert len(repo.docs) == 1


def test_codigo_duplicado_ignora_mayusculas(make_client, repo):
    sembrar(repo, "SIM-PER-001")
    r = make_client(SUPER).post(BASE, json=payload(codigo_albergue="sim-per-001"))
    assert r.status_code == 409


# --- permisos ---------------------------------------------------------------
def test_sin_credenciales_no_accede(make_client):
    # No se sobreescribe get_current_user: se usa la autenticación real del proyecto.
    assert make_client().get(BASE).status_code == 401
    assert make_client().post(BASE, json=payload()).status_code == 401


def test_administrador_de_albergue_no_puede_crear(make_client, repo):
    admin = admin_de(sembrar(repo))
    assert make_client(admin).post(BASE, json=payload()).status_code == 403


def test_administrador_de_albergue_no_puede_desactivar(make_client, repo):
    a = sembrar(repo)
    r = make_client(admin_de(a)).patch(f"{BASE}/{a.id}/desactivar")
    assert r.status_code == 403
    assert repo.docs[a.id].activo is True


def test_administrador_consulta_solo_su_albergue(make_client, repo):
    propio = sembrar(repo, "SIM-PER-001")
    ajeno = sembrar(repo, "SIM-PER-002")
    client = make_client(admin_de(propio))
    assert client.get(f"{BASE}/{propio.id}").status_code == 200
    assert client.get(f"{BASE}/{ajeno.id}").status_code == 403
    assert [x["id"] for x in client.get(BASE).json()] == [propio.id]


def test_administrador_modifica_capacidad_de_su_albergue(make_client, repo):
    a = sembrar(repo)
    r = make_client(admin_de(a)).patch(f"{BASE}/{a.id}", json={"capacidad_instalada": 200})
    assert r.status_code == 200
    assert r.json()["capacidad_instalada"] == 200


def test_administrador_no_cambia_nombre_ni_albergues_ajenos(make_client, repo):
    propio = sembrar(repo, "SIM-PER-001")
    ajeno = sembrar(repo, "SIM-PER-002")
    client = make_client(admin_de(propio))
    assert client.patch(f"{BASE}/{propio.id}", json={"nombre": "Nuevo nombre"}).status_code == 403
    assert client.patch(f"{BASE}/{ajeno.id}", json={"capacidad_instalada": 10}).status_code == 403


def test_administrador_sin_albergue_asignado_no_accede(make_client, repo):
    a = sembrar(repo)
    huerfano = _user(UserRole.SHELTER_ADMIN, None)
    client = make_client(huerfano)
    assert client.get(BASE).status_code == 403
    assert client.get(f"{BASE}/{a.id}").status_code == 403


# --- desactivación e historial ---------------------------------------------
def test_desactivar_no_elimina_el_albergue(make_client, repo):
    a = sembrar(repo)
    client = make_client(SUPER)
    r = client.patch(f"{BASE}/{a.id}/desactivar")
    assert r.status_code == 200
    assert r.json()["activo"] is False
    assert r.json()["updated_by"] == SUPER.id
    assert r.json()["updated_at"] is not None
    # Sigue existiendo y consultable: el historial relacionado no se pierde.
    assert a.id in repo.docs
    assert client.get(f"{BASE}/{a.id}").json()["activo"] is False


def test_desactivar_es_idempotente(make_client, repo):
    a = sembrar(repo)
    client = make_client(SUPER)
    assert client.patch(f"{BASE}/{a.id}/desactivar").status_code == 200
    assert client.patch(f"{BASE}/{a.id}/desactivar").status_code == 200


def test_albergue_desactivado_no_se_modifica(make_client, repo):
    a = sembrar(repo, activo=False)
    r = make_client(SUPER).patch(f"{BASE}/{a.id}", json={"capacidad_instalada": 50})
    assert r.status_code == 409
    assert r.json()["code"] == "SHELTER_INACTIVE"


def test_lista_filtra_por_activo(make_client, repo):
    sembrar(repo, "SIM-PER-001", activo=True)
    sembrar(repo, "SIM-PER-002", activo=False)
    client = make_client(SUPER)
    assert [x["codigo_albergue"] for x in client.get(BASE, params={"activo": True}).json()] == ["SIM-PER-001"]
    assert [x["codigo_albergue"] for x in client.get(BASE, params={"activo": False}).json()] == ["SIM-PER-002"]


def test_no_existe_endpoint_para_borrar(make_client, repo):
    a = sembrar(repo)
    assert make_client(SUPER).delete(f"{BASE}/{a.id}").status_code == 405
