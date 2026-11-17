from collections import Counter
from datetime import date, datetime
from itertools import pairwise
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import pytest
from bson import ObjectId

from database.mongodb.seeds.seed_demo_pereira import generate_dataset, write_documents


@pytest.fixture(scope="module")
def dataset():
    return generate_dataset(3, 90, date(2026, 11, 17),
        datetime(2026, 11, 17, 13, 30, tzinfo=ZoneInfo("America/Bogota")),
        ObjectId("507f1f77bcf86cd799439011"), "$argon2id$hash_solo_de_prueba")


def test_seed_volume_location_and_accounts(dataset):
    assert len(dataset["albergues"]) == 3
    assert len(dataset["usuarios"]) == 6
    assert [user["email"] for user in dataset["usuarios"]] == [f"demo{i:02d}@test.com" for i in range(1, 7)]
    assert sum(map(len, dataset.values())) > 10_000
    for shelter in dataset["albergues"]:
        assert shelter["nombre"].startswith("[DEMO]")
        assert shelter["ubicacion"]["municipio"] == "Pereira"
        longitude, latitude = shelter["ubicacion"]["coordenadas"]["coordinates"]
        assert -75.71 < longitude < -75.68 and 4.80 < latitude < 4.825
        assert shelter["codigo_albergue"] == f"ALB-{str(shelter['_id']).upper()}"
    assert all(user["role"] == "administrador_albergue" for user in dataset["usuarios"])
    assert all("password" not in user and user["password_hash"].startswith("$argon2id$") for user in dataset["usuarios"])


def test_source_references_exist_and_sir_counts_are_consistent(dataset):
    actor = ObjectId("507f1f77bcf86cd799439011")
    ids = {name: {row["_id"] for row in rows} for name, rows in dataset.items()}
    users = ids["usuarios"] | {actor}
    populations = {(row["albergue_id"], row["fecha"]): row for row in dataset["historial_poblacion"]}
    for name, rows in dataset.items():
        assert len(ids[name]) == len(rows)
        for row in rows:
            if row.get("albergue_id") is not None:
                assert row["albergue_id"] in ids["albergues"]
            if "registrado_por" in row:
                assert row["registrado_por"] in users
    for case in dataset["casos_enfermedades"]:
        n = populations[(case["albergue_id"], case["fecha"])]["poblacion"]
        assert 0 <= case["cantidad_casos_activos"] + case["cantidad_recuperados"] <= n
    for prediction in dataset["predicciones_sir"]:
        inputs = prediction["datos_entrada"]
        assert set(inputs["historial_poblacion_ids"]) <= ids["historial_poblacion"]
        assert set(inputs["casos_enfermedades_ids"]) <= ids["casos_enfermedades"]
        initial = prediction["parametros"]["condiciones_iniciales"]
        n = sum(initial.values())
        for point in prediction["trayectoria"]:
            assert point["susceptibles"] + point["infectados"] + point["recuperados"] == pytest.approx(n)
            assert 0 <= point["infectados"] <= n
    for event in dataset["auditoria_actividades"]:
        assert event["usuario_id"] in users
        assert event["entidad_id"] in ids[event["entidad"]]
        assert event["accion"] == "CARGA_DATOS_SINTETICOS"
    for state in dataset["estados_semaforo"]:
        assert "updated_at" not in state and "updated_by" not in state
        for field, collection in (("condiciones_sanitarias_ids", "condiciones_sanitarias"),
            ("casos_enfermedades_ids", "casos_enfermedades"), ("alertas_ids", "alertas"),
            ("predicciones_sir_ids", "predicciones_sir"), ("metricas_albergue_ids", "metricas_albergue")):
            assert set(state["datos_origen"][field]) <= ids[collection]


def test_expected_model_data_is_available_and_snapshots_are_not_added_twice(dataset):
    assert len(dataset["predicciones_sir"]) >= 6
    days = Counter((r["albergue_id"], r["fecha"], r["enfermedad"]) for r in dataset["casos_enfermedades"])
    assert set(days.values()) == {1}
    for disease in {r["enfermedad"] for r in dataset["casos_enfermedades"]}:
        for shelter in dataset["albergues"]:
            rows = [r for r in dataset["casos_enfermedades"] if r["albergue_id"] == shelter["_id"] and r["enfermedad"] == disease]
            for left, right in pairwise(rows):
                assert right["cantidad_recuperados"] >= left["cantidad_recuperados"]
                assert right["cantidad_recuperados"] + right["cantidad_casos_activos"] >= left["cantidad_recuperados"] + left["cantidad_casos_activos"]


def test_writes_are_insert_only_and_do_not_replace_existing_documents():
    database = MagicMock()
    database.__getitem__.return_value.bulk_write.return_value.upserted_count = 1
    document = {"_id": ObjectId(), "nombre": "[DEMO] Prueba"}
    assert write_documents(database, "albergues", [document]) == 1
    operation = database.__getitem__.return_value.bulk_write.call_args.args[0][0]
    assert operation._filter == {"_id": document["_id"]}
    assert operation._doc == {"$setOnInsert": document}
    assert operation._upsert
