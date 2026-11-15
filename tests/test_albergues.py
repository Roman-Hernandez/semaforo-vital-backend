"""Pruebas de la API de albergues (RF-41). Usan un repositorio en memoria: no requieren MongoDB."""
import copy
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import deps
from app.api.v1.endpoints.albergues import router
from app.domain.albergues import AlbergueDuplicado
from app.domain.users import UserRole

BASE = "/api/v1/albergues"

SUPER = SimpleNamespace(id=str(ObjectId()), role=UserRole.SUPER_ADMIN, albergue_id=None)


class FakeAlbergueRepository:
    def __init__(self):
        self.docs: dict[str, dict] = {}

    def crear(self, datos):
        if any(d["codigo_albergue"] == datos["codigo_albergue"] for d in self.docs.values()):
            raise AlbergueDuplicado("Código repetido")
        doc = copy.deepcopy(datos)
        doc["id"] = str(ObjectId())
        self.docs[doc["id"]] = doc
        return copy.deepcopy(doc)

    def obtener(self, albergue_id):
        doc = self.docs.get(albergue_id)
        return copy.deepcopy(doc) if doc else None

    def listar(self, activo=None):
        docs = [d for d in self.docs.values() if activo is None or d["activo"] == activo]
        return [copy.deepcopy(d) for d in sorted(docs, key=lambda d: d["codigo_albergue"])]

    def actualizar(self, albergue_id, cambios):
        doc = self.docs.get(albergue_id)
        if doc is None:
            return None
        doc.update(copy.deepcopy(cambios))
        return copy.deepcopy(doc)


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
    doc = payload(codigo_albergue=codigo)
    doc.update(activo=activo, registrado_por=SUPER.id, created_at=datetime.now(UTC))
    return repo.crear(doc)


def admin_de(albergue):
    return SimpleNamespace(id=str(ObjectId()), role=UserRole("administrador_albergue"), albergue_id=albergue["id"])


@pytest.fixture
def repo():
    return FakeAlbergueRepository()


@pytest.fixture
def make_client(repo):
    def _make(actor=None):
        app = FastAPI()
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


def test_codigo_se_normaliza_a_mayusculas(make_client):
    r = make_client(SUPER).post(BASE, json=payload(codigo_albergue="sim-per-009"))
    assert r.status_code == 201
    assert r.json()["codigo_albergue"] == "SIM-PER-009"


def test_super_consulta_y_lista(make_client, repo):
    a = sembrar(repo, "SIM-PER-001")
    sembrar(repo, "SIM-PER-002")
    client = make_client(SUPER)
    assert client.get(f"{BASE}/{a['id']}").json()["codigo_albergue"] == "SIM-PER-001"
    assert [x["codigo_albergue"] for x in client.get(BASE).json()] == ["SIM-PER-001", "SIM-PER-002"]


def test_super_modifica_albergue(make_client, repo):
    a = sembrar(repo)
    r = make_client(SUPER).patch(
        f"{BASE}/{a['id']}", json={"nombre": "Nombre nuevo", "capacidad_instalada": 300}
    )
    assert r.status_code == 200
    assert r.json()["nombre"] == "Nombre nuevo"
    assert r.json()["capacidad_instalada"] == 300


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
        {"nombre": "ab"},
        {"capacidad_instalada": 0},
        {"capacidad_instalada": -5},
        {"capacidad_instalada": "100"},
        {"codigo_albergue": "ab c"},
        {"codigo_albergue": "SIM_PER_001"},
        {"codigo_albergue": ""},
        {"ubicacion": _ubic_con([-75.69, 95])},       # latitud fuera de rango
        {"ubicacion": _ubic_con([-200, 4.8])},        # longitud fuera de rango
        {"ubicacion": _ubic_con([-75.69])},           # falta la latitud
        {"ubicacion": _ubic_con([-75.69, 4.8, 10])},  # sobra un valor
        {"ubicacion": _ubic_con(municipio="")},
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


def test_tipo_de_geometria_debe_ser_point(make_client):
    u = _ubic_con()
    u["coordenadas"]["type"] = "Polygon"
    assert make_client(SUPER).post(BASE, json=payload(ubicacion=u)).status_code == 422


def test_patch_vacio_o_con_codigo_da_422(make_client, repo):
    a = sembrar(repo)
    client = make_client(SUPER)
    assert client.patch(f"{BASE}/{a['id']}", json={}).status_code == 422
    assert client.patch(f"{BASE}/{a['id']}", json={"codigo_albergue": "OTRO-001"}).status_code == 422
    assert client.patch(f"{BASE}/{a['id']}", json={"activo": False}).status_code == 422


# --- duplicados -------------------------------------------------------------
def test_codigo_duplicado_da_409(make_client, repo):
    client = make_client(SUPER)
    assert client.post(BASE, json=payload()).status_code == 201
    assert client.post(BASE, json=payload(nombre="Otro nombre")).status_code == 409
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
    r = make_client(admin_de(a)).patch(f"{BASE}/{a['id']}/desactivar")
    assert r.status_code == 403
    assert repo.docs[a["id"]]["activo"] is True


def test_administrador_consulta_solo_su_albergue(make_client, repo):
    propio = sembrar(repo, "SIM-PER-001")
    ajeno = sembrar(repo, "SIM-PER-002")
    client = make_client(admin_de(propio))
    assert client.get(f"{BASE}/{propio['id']}").status_code == 200
    assert client.get(f"{BASE}/{ajeno['id']}").status_code == 403
    assert [x["id"] for x in client.get(BASE).json()] == [propio["id"]]


def test_administrador_modifica_capacidad_de_su_albergue(make_client, repo):
    a = sembrar(repo)
    r = make_client(admin_de(a)).patch(f"{BASE}/{a['id']}", json={"capacidad_instalada": 200})
    assert r.status_code == 200
    assert r.json()["capacidad_instalada"] == 200


def test_administrador_no_cambia_nombre_ni_albergues_ajenos(make_client, repo):
    propio = sembrar(repo, "SIM-PER-001")
    ajeno = sembrar(repo, "SIM-PER-002")
    client = make_client(admin_de(propio))
    assert client.patch(f"{BASE}/{propio['id']}", json={"nombre": "Nuevo nombre"}).status_code == 403
    assert client.patch(f"{BASE}/{ajeno['id']}", json={"capacidad_instalada": 10}).status_code == 403


def test_administrador_sin_albergue_asignado_no_accede(make_client, repo):
    a = sembrar(repo)
    huerfano = SimpleNamespace(id=str(ObjectId()), role=UserRole("administrador_albergue"), albergue_id=None)
    client = make_client(huerfano)
    assert client.get(BASE).status_code == 403
    assert client.get(f"{BASE}/{a['id']}").status_code == 403


# --- desactivación e historial ---------------------------------------------
def test_desactivar_no_elimina_el_albergue(make_client, repo):
    a = sembrar(repo)
    client = make_client(SUPER)
    r = client.patch(f"{BASE}/{a['id']}/desactivar")
    assert r.status_code == 200
    assert r.json()["activo"] is False
    assert r.json()["desactivado_en"] is not None
    # Sigue existiendo y consultable: el historial relacionado no se pierde.
    assert a["id"] in repo.docs
    assert client.get(f"{BASE}/{a['id']}").json()["activo"] is False


def test_desactivar_es_idempotente(make_client, repo):
    a = sembrar(repo)
    client = make_client(SUPER)
    assert client.patch(f"{BASE}/{a['id']}/desactivar").status_code == 200
    assert client.patch(f"{BASE}/{a['id']}/desactivar").status_code == 200


def test_albergue_desactivado_no_se_modifica(make_client, repo):
    a = sembrar(repo, activo=False)
    r = make_client(SUPER).patch(f"{BASE}/{a['id']}", json={"capacidad_instalada": 50})
    assert r.status_code == 409


def test_lista_filtra_por_activo(make_client, repo):
    sembrar(repo, "SIM-PER-001", activo=True)
    sembrar(repo, "SIM-PER-002", activo=False)
    client = make_client(SUPER)
    assert [x["codigo_albergue"] for x in client.get(BASE, params={"activo": True}).json()] == ["SIM-PER-001"]
    assert [x["codigo_albergue"] for x in client.get(BASE, params={"activo": False}).json()] == ["SIM-PER-002"]


def test_no_existe_endpoint_para_borrar(make_client, repo):
    a = sembrar(repo)
    assert make_client(SUPER).delete(f"{BASE}/{a['id']}").status_code == 405