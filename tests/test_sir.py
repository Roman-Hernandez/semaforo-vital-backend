from dataclasses import replace
from math import exp

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from test_shelters import SHELTER, USER, MemoryShelterRepository

from app.api.deps import get_current_user, get_shelter_service, get_user_repository
from app.api.errors import register_error_handlers
from app.api.v1.endpoints.sir import router
from app.application.shelters import ShelterService
from app.domain.pagination import Page
from app.domain.shelters import DiseaseRecord
from app.domain.sir import InvalidSIRInput, SIRSettings, solve_sir
from app.domain.users import UserRole


def test_rk4_matches_analytic_recovery_without_transmission():
    settings = SIRSettings(poblacion_total=300, infectados_iniciales=30, beta=0, gamma=0.1, dias_simulacion=30)
    result = solve_sir(settings)
    final = result.curva[-1]
    expected = 30 * exp(-0.1 * 30)
    assert final.susceptibles == 270
    assert final.infectados == pytest.approx(expected, abs=1e-8)
    assert final.recuperados == pytest.approx(30 - expected, abs=1e-8)


def test_rk4_matches_logistic_solution_without_recovery():
    settings = SIRSettings(poblacion_total=300, infectados_iniciales=3, beta=0.35, gamma=0, dias_simulacion=30)
    result = solve_sir(settings)
    expected = 300 / (1 + 99 * exp(-0.35 * 30))
    assert result.curva[-1].infectados == pytest.approx(expected, abs=1e-5)
    assert result.curva[-1].recuperados == 0


@pytest.mark.parametrize("method", ["Euler", "RK4"])
@pytest.mark.parametrize("settings", [
    SIRSettings(poblacion_total=100000, infectados_iniciales=100),
    SIRSettings(poblacion_total=1, infectados_iniciales=1, beta=5, gamma=5, paso_tiempo=1, dias_simulacion=365),
    SIRSettings(poblacion_total=300, infectados_iniciales=0, recuperados_iniciales=300),
])
def test_conservation_nonnegativity_and_daily_endpoints(method, settings):
    result = solve_sir(settings, method)
    assert len(result.curva) == settings.dias_simulacion + 1
    assert [p.dia for p in result.curva] == list(range(settings.dias_simulacion + 1))
    assert result.sin_negativos
    for point in result.curva:
        assert min(point.susceptibles, point.infectados, point.recuperados) >= 0
        assert point.susceptibles + point.infectados + point.recuperados == pytest.approx(settings.poblacion_total, rel=1e-10)


def test_rk4_is_closer_than_euler_to_finer_reference():
    settings = SIRSettings(poblacion_total=100000, infectados_iniciales=100)
    reference = solve_sir(replace(settings, paso_tiempo=0.01))
    rk4 = solve_sir(settings)
    euler = solve_sir(settings, "Euler")
    rk4_error = max(abs(a.infectados - b.infectados) for a, b in zip(rk4.curva, reference.curva))
    euler_error = max(abs(a.infectados - b.infectados) for a, b in zip(euler.curva, reference.curva))
    assert rk4_error < 0.01
    assert euler_error > rk4_error


@pytest.mark.parametrize("kwargs", [
    {"poblacion_total": 0}, {"poblacion_total": float("nan")}, {"beta": float("inf")},
    {"infectados_iniciales": -1}, {"poblacion_total": 10, "infectados_iniciales": 11},
    {"poblacion_total": 10, "infectados_iniciales": 6, "recuperados_iniciales": 5},
    {"dias_simulacion": True}, {"dias_simulacion": 366}, {"paso_tiempo": 0.001}, {"reduccion_beta": 2},
])
def test_domain_rejects_invalid_parameters(kwargs):
    with pytest.raises(InvalidSIRInput):
        SIRSettings(**kwargs)


@pytest.fixture
def api():
    from datetime import timedelta

    from app.core.timezone import now_colombia
    now = now_colombia()
    repo = MemoryShelterRepository()
    first_day = now - timedelta(days=7)
    repo.save_population(SHELTER, USER.id, first_day, 300, first_day)
    repo.save_population(SHELTER, USER.id, now, 300, now)
    generated = solve_sir(SIRSettings(poblacion_total=300, infectados_iniciales=10,
        recuperados_iniciales=5, beta=0.35, gamma=0.1, dias_simulacion=7))
    rows = []
    for point in generated.curva:
        day = first_day + timedelta(days=point.dia)
        rows.append(DiseaseRecord(id=f"caso-{point.dia}", albergue_id=SHELTER,
            fecha=day, enfermedad="EDA", cantidad_casos_activos=round(point.infectados),
            cantidad_recuperados=round(point.recuperados), fuente_datos="registro_manual",
            registrado_por=USER.id, created_at=day))
    def page_diseases(shelter_id, since, until, paging, disease=None):
        names = sorted({row.enfermedad for row in rows if disease is None or row.enfermedad.casefold() == disease.strip().casefold()})
        return Page.create(names[paging.offset:paging.offset + paging.page_size], paging, len(names))
    repo.page_sir_diseases = page_diseases
    repo.sir_history = lambda shelter_id, since, until, diseases=None: [row for row in rows if diseases is None or row.enfermedad.casefold() in {name.casefold() for name in diseases}]
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[get_shelter_service] = lambda: ShelterService(repo)
    return TestClient(app), repo, app, rows


URL = "/api/v1/mi-albergue/modelo-sir/resultados"


def test_automatic_without_user_parameters_uses_real_series(api):
    client, repo, _, rows = api
    original = dict(repo.records)
    response = client.get(URL)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["poblacion_actual"] == 300
    disease = result["resultados"]["items"][0]
    assert disease["estado"] == "estimacion_disponible", disease
    assert disease["parametros_estimados"]["beta"] == pytest.approx(0.35, abs=0.03)
    assert disease["parametros_estimados"]["gamma"] == pytest.approx(0.1, abs=0.02)
    assert disease["observado"][-1]["registro_casos_id"] == rows[-1].id
    assert disease["observado"][-1]["susceptibles"] == 300 - rows[-1].cantidad_casos_activos - rows[-1].cantidad_recuperados
    assert disease["proyeccion"][0]["infectados"] == rows[-1].cantidad_casos_activos
    assert len(disease["proyeccion"]) == 15
    for point in disease["proyeccion"]:
        assert 0 <= point["infectados"] <= 300
        assert point["susceptibles"] + point["infectados"] + point["recuperados"] == pytest.approx(300)
    assert repo.records == original


def test_no_cases_produces_honest_empty_state(api):
    client, _, _, rows = api
    rows.clear()
    data = client.get(URL).json()
    assert data["resultados"]["items"] == []
    assert "casos_enfermedades" in data["datos_faltantes"]


def test_missing_recoveries_do_not_become_zero(api):
    client, _, _, rows = api
    rows[:] = [replace(row, cantidad_recuperados=None) for row in rows]
    result = client.get(URL).json()["resultados"]["items"][0]
    assert result["estado"] == "datos_insuficientes"
    assert "cantidad_recuperados" in result["datos_faltantes"]
    assert result["proyeccion"] == []
    assert result["parametros_estimados"] is None
    assert result["observado"][0]["recuperados"] is None


def test_minimal_history_and_population_changes_block_forecasts(api):
    client, repo, _, rows = api
    original = list(rows)
    rows[:] = rows[:1]
    assert client.get(URL).json()["resultados"]["items"][0]["estado"] == "datos_insuficientes"
    rows[:] = original
    last_day = max(repo.records)
    repo.records[last_day] = replace(repo.records[last_day], poblacion=400)
    assert client.get(URL).json()["resultados"]["items"][0]["estado"] == "datos_incompatibles"


def test_incompatible_counts_are_not_fixed_or_clamped(api):
    client, _, _, rows = api
    rows[-1] = replace(rows[-1], cantidad_casos_activos=301)
    result = client.get(URL).json()["resultados"]["items"][0]
    assert result["estado"] == "datos_incompatibles"
    assert result["proyeccion"] == []


def test_updates_recompute_results_and_observed_history(api):
    client, _, _, rows = api
    before = client.get(URL).json()["resultados"]["items"][0]
    rows[-1] = replace(rows[-1], cantidad_casos_activos=rows[-1].cantidad_casos_activos + 1)
    after = client.get(URL).json()["resultados"]["items"][0]
    assert after["observado"][-1]["infectados"] == before["observado"][-1]["infectados"] + 1
    assert after["parametros_estimados"] != before["parametros_estimados"]


def test_duplicate_day_is_latest_snapshot_not_sum(api):
    from datetime import timedelta
    client, _, _, rows = api
    rows.append(replace(rows[-1], id="correccion", updated_at=rows[-1].created_at + timedelta(hours=1),
                        cantidad_casos_activos=rows[-1].cantidad_casos_activos + 1))
    result = client.get(URL).json()["resultados"]["items"][0]
    assert len(result["observado"]) == 8
    assert result["observado"][-1]["registro_casos_id"] == "correccion"
    assert result["observado"][-1]["infectados"] == rows[-1].cantidad_casos_activos


@pytest.mark.parametrize("body", [{"beta": 0.35}, {"gamma": 0.1}, {"poblacion_total": 100000},
                                  {"infectados_iniciales": 3}, {"dias_simulacion": 30}])
def test_api_does_not_accept_manual_model_parameters(api, body):
    client, _, _, _ = api
    assert client.post("/api/v1/mi-albergue/modelo-sir/simular", json=body).status_code == 422


def test_requires_assigned_admin_and_token(api):
    client, _, app, _ = api
    app.dependency_overrides[get_current_user] = lambda: replace(USER, role=UserRole.SUPER_ADMIN)
    assert client.get(URL).status_code == 403
    app.dependency_overrides[get_current_user] = lambda: replace(USER, albergue_id=None)
    assert client.get(URL).status_code == 403
    del app.dependency_overrides[get_current_user]
    app.dependency_overrides[get_user_repository] = lambda: object()
    assert client.get(URL).status_code == 401


def test_stale_observations_do_not_look_like_current_forecasts(api):
    from datetime import timedelta
    client, repo, _, rows = api
    rows[:] = [replace(row, fecha=row.fecha - timedelta(days=9), created_at=row.created_at - timedelta(days=9)) for row in rows]
    first = min(rows, key=lambda r: r.fecha).fecha
    repo.records[first] = replace(next(iter(repo.records.values())), fecha=first)
    result = client.get(URL).json()["resultados"]["items"][0]
    assert result["estado"] == "datos_insuficientes"
    assert "casos_recientes" in result["datos_faltantes"]
    assert not result["proyeccion"]


def test_filter_multiple_diseases_and_normalize_case(api):
    client, _, _, rows = api
    rows.extend([replace(row, id="ira-" + row.id, enfermedad="IRA") for row in list(rows)])
    assert len(client.get(URL).json()["resultados"]["items"]) == 2
    selected = client.get(URL, params={"enfermedad": " eda "}).json()
    assert len(selected["resultados"]["items"]) == 1
    assert selected["resultados"]["items"][0]["enfermedad"] == "EDA"


def test_recovery_rate_is_not_invented_when_no_recovery_is_observed(api):
    client, _, _, rows = api
    rows[:] = [replace(row, cantidad_recuperados=0) for row in rows]
    result = client.get(URL).json()["resultados"]["items"][0]
    assert result["estado"] == "datos_insuficientes"
    assert result["parametros_estimados"] is None
    assert not result["proyeccion"]


def test_recovery_field_is_optional_but_rejects_invalid_types():
    from pydantic import ValidationError

    from app.api.record_schemas import DiseaseRequest
    payload = {"fecha": "2026-11-17", "enfermedad": "EDA", "cantidad_casos_activos": 3}
    assert DiseaseRequest(**payload).to_command().cantidad_recuperados is None
    assert DiseaseRequest(**payload, cantidad_recuperados=2).to_command().cantidad_recuperados == 2
    for value in (-1, True, "2"):
        with pytest.raises(ValidationError):
            DiseaseRequest(**payload, cantidad_recuperados=value)


def test_disease_pagination_keeps_complete_series_and_true_total(api):
    client, _, _, rows = api
    rows.extend([replace(row, id=f"ira-{row.id}", enfermedad="IRA") for row in list(rows)])
    first = client.get(URL + "?page=1&page_size=1").json()["resultados"]
    second = client.get(URL + "?page=2&page_size=1").json()["resultados"]
    assert first["total"] == second["total"] == 2
    assert first["items"][0]["enfermedad"] != second["items"][0]["enfermedad"]
    for page in (first, second):
        assert len(page["items"]) == 1
        assert len(page["items"][0]["observado"]) == 8
        assert len(page["items"][0]["proyeccion"]) == 15
    beyond = client.get(URL + "?page=3&page_size=1").json()
    assert beyond["resultados"]["items"] == []
    assert "casos_enfermedades" not in beyond["datos_faltantes"]
