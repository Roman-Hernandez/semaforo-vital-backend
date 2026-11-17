"""Carga sintética reproducible. Por defecto solo prepara datos; --apply los incorpora sin sobrescribir.

Ejemplo: python -m database.mongodb.seeds.seed_demo_pereira --apply --end-date 2026-11-17
Las coordenadas son puntos ficticios del centro urbano de Pereira, no sedes reales.
"""
import argparse
import csv
import hashlib
import json
import math
import os
from collections import Counter
from dataclasses import asdict
from datetime import date, datetime, timedelta
from pathlib import Path

from bson import ObjectId
from pymongo import MongoClient, UpdateOne
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.core.timezone import now_colombia, start_of_day_colombia
from app.domain.sir import SIRSettings, solve_sir
from app.domain.sir_estimation import SIRObservation, estimate_sir
from app.infrastructure.security.tokens import hash_password

CAMPAIGN = "semaforo-demo-pereira-v1"
SOURCE = "SIMULACION_DEMO_PEREIRA_V1"
DISEASES = ("Enfermedad diarreica aguda", "Infección respiratoria aguda", "Síndrome febril")
COLLECTIONS = ("albergues", "usuarios", "historial_poblacion", "casos_enfermedades",
               "condiciones_sanitarias", "registros_diarios", "intervenciones", "predicciones_sir",
               "alertas", "estados_semaforo", "metricas_albergue", "auditoria_actividades")


def oid(collection: str, key: str) -> ObjectId:
    return ObjectId(hashlib.sha256(f"{CAMPAIGN}:{collection}:{key}".encode()).digest()[:12])


def generate_dataset(shelters: int, days: int, end: date, now: datetime,
                     actor: ObjectId, password_hash: str) -> dict[str, list[dict]]:
    data = {name: [] for name in COLLECTIONS}
    first = end - timedelta(days=days - 1)

    def add(collection, key, document):
        document = {"_id": oid(collection, key), **document}
        data[collection].append(document)
        if collection not in ("auditoria_actividades", "metricas_albergue"):
            data["auditoria_actividades"].append({
                "_id": oid("auditoria_actividades", f"{collection}:{key}"),
                "usuario_id": actor, "albergue_id": document["_id"] if collection == "albergues" else document.get("albergue_id"),
                "fecha_actividad": now, "accion": "CARGA_DATOS_SINTETICOS", "entidad": collection,
                "entidad_id": document["_id"], "created_at": now,
                "descripcion": f"[DEMO] Importación reproducible {CAMPAIGN}; no corresponde a una actividad histórica real",
            })
        return document["_id"]

    for index in range(shelters):
        shelter_key = f"{index + 1:03d}"
        shelter_id = oid("albergues", shelter_key)
        admin_ids = [oid("usuarios", f"{shelter_key}:{shift}") for shift in (1, 2)]
        capacity = 180 + (index * 37) % 321
        population = round(capacity * (0.65 + (index % 5) * 0.09))
        profile = index % 3
        longitude = round(-75.704 + (index % 6) * 0.0016, 6)
        latitude = round(4.8085 + ((index // 6) % 5) * 0.0012, 6)
        add("albergues", shelter_key, {
            "codigo_albergue": f"ALB-{str(shelter_id).upper()}",
            "nombre": f"[DEMO] Albergue Pereira {shelter_key}",
            "ubicacion": {"departamento": "Risaralda", "municipio": "Pereira",
                "direccion": f"Punto simulado {shelter_key}, zona centro de Pereira; no es una sede real",
                "coordenadas": {"type": "Point", "coordinates": [longitude, latitude]}},
            "capacidad_instalada": capacity, "activo": True, "registrado_por": actor,
            "fecha": start_of_day_colombia(first), "created_at": now, "updated_at": now, "updated_by": actor,
        })
        for shift, admin_id in enumerate(admin_ids, 1):
            add("usuarios", f"{shelter_key}:{shift}", {
                "email": f"demo{index * 2 + shift:02d}@test.com", "password_hash": password_hash,
                "role": "administrador_albergue", "active": True, "nombre": f"Usuario Demo {shelter_key}",
                "apellido": f"Turno {shift}", "albergue_id": shelter_id,
                "created_at": now, "updated_at": now, "registrado_por": actor, "updated_by": actor,
            })
        trajectories = []
        for disease_index in range(3):
            beta = (0.135, 0.17, 0.10)[profile] + disease_index * 0.005
            gamma = (0.085, 0.09, 0.105)[profile] + disease_index * 0.005
            trajectories.append(solve_sir(SIRSettings(poblacion_total=population,
                infectados_iniciales=3 + disease_index, recuperados_iniciales=2,
                beta=beta, gamma=gamma, dias_simulacion=days - 1)).curva)
        history = [[] for _ in DISEASES]
        population_ids = []
        daily_refs = []
        for day_index in range(days):
            day = first + timedelta(days=day_index)
            timestamp = start_of_day_colombia(day)
            key = f"{shelter_key}:{day}"
            creator = admin_ids[day_index % 2]
            trace = {"albergue_id": shelter_id, "registrado_por": creator,
                     "created_at": now, "updated_at": now, "updated_by": creator}
            population_id = add("historial_poblacion", key, {**trace, "fecha": timestamp, "poblacion": population})
            population_ids.append(population_id)
            case_ids, counts = [], []
            for disease_index, disease in enumerate(DISEASES):
                point = trajectories[disease_index][day_index]
                # Redondear acumulados preserva S no creciente, R no decreciente y S+I+R=N.
                recovered = round(point.recuperados)
                ever_infected = min(population, math.ceil(point.infectados + point.recuperados))
                infected = ever_infected - recovered
                case_id = add("casos_enfermedades", f"{key}:{disease_index}", {
                    **trace, "fecha": timestamp, "enfermedad": disease,
                    "cantidad_casos_activos": infected, "cantidad_recuperados": recovered,
                    "fuente_datos": SOURCE, "observaciones": "[DEMO] Serie sintética, no corresponde a pacientes reales",
                })
                case_ids.append(case_id); counts.append(infected)
                history[disease_index].append(SIRObservation(day, population, infected, recovered,
                    str(case_id), str(population_id)))
            poor_water = profile == 1 and day_index % 14 < 5
            baths = max(2, population // (30 if poor_water else 18))
            condition_id = add("condiciones_sanitarias", key, {
                **trace, "fecha": timestamp, "agua_potable_disponible": not poor_water,
                "banos_disponibles": baths, "estado_higiene": "requiere atención" if poor_water else "adecuada",
                "estado_saneamiento": "requiere atención" if poor_water else "adecuado",
                "otros_recursos_sanitarios": [{"nombre": "letrinas", "cantidad": max(1, baths // 2)},
                    {"nombre": "lavamanos", "cantidad": max(2, baths - 1)}],
                "fuente_datos": SOURCE, "observaciones": "[DEMO] Inspección sanitaria sintética",
            })
            add("registros_diarios", key, {**trace, "fecha": timestamp, "poblacion": population,
                "litros_agua": float(population * (7 if poor_water else 20)), "letrinas": max(1, baths // 2),
                "casos_eda": counts[0], "casos_ira": counts[1]})
            if day_index % 5 == 0:
                add("intervenciones", key, {**trace, "fecha_intervencion": timestamp,
                    "tipo_intervencion": ("Suministro de agua", "Campaña de higiene", "Mantenimiento de letrinas")[day_index % 3],
                    "descripcion": "[DEMO] Intervención sanitaria simulada para pruebas del sistema",
                    "fuente_datos": SOURCE, "observaciones": "No representa una intervención ejecutada en Pereira"})
            alert_ids = []
            if day_index % 3 == 0:
                alert_ids.append(add("alertas", key, {**trace, "fecha_alerta": timestamp,
                    "nivel_riesgo": "rojo" if poor_water else "amarillo", "tipo_alerta": "inspeccion_demo",
                    "mensaje": f"[SIMULACIÓN] {'Revisar suministro de agua' if poor_water else 'Seguimiento sanitario'}; no es una alerta real",
                    "activa": (end - day).days <= 6, "publica": day_index % 4 != 0,
                    "datos_origen": {"condicion_sanitaria_id": condition_id, "casos_enfermedades_ids": case_ids},
                    "fuente_datos": SOURCE}))
            risk = "rojo" if poor_water else ("amarillo" if profile != 2 else "verde")
            code = {"verde": 1, "amarillo": 2, "rojo": 3}[risk]
            state_id = add("estados_semaforo", key, {"albergue_id": shelter_id, "registrado_por": creator,
                "created_at": now, "fecha_calculo": timestamp,
                "nivel": risk, "codigo": code, "datos_origen": {"condiciones_sanitarias_ids": [condition_id],
                    "casos_enfermedades_ids": case_ids, "alertas_ids": alert_ids, "analisis_ia_ids": [],
                    "predicciones_sir_ids": [], "metricas_albergue_ids": []}})
            daily_refs.append((key, timestamp, state_id, risk, code, poor_water, alert_ids))
        for disease_index, disease in enumerate(DISEASES):
            observations = history[disease_index][-28:]
            last = observations[-1]
            if last.infectados == 0:
                continue
            try:
                estimated = estimate_sir(observations)
            except ValueError:
                continue
            result = solve_sir(SIRSettings(poblacion_total=population, infectados_iniciales=last.infectados,
                recuperados_iniciales=last.recuperados, beta=estimated.beta, gamma=estimated.gamma,
                dias_simulacion=14, reduccion_beta=0))
            prediction_id = add("predicciones_sir", f"{shelter_key}:{end}:{disease_index}", {
                "albergue_id": shelter_id, "registrado_por": admin_ids[0], "created_at": now,
                "fecha_ejecucion": now, "enfermedad": disease, "publica": True,
                "modelo": {"nombre": "SIR automático · DATOS SINTÉTICOS", "version": "demo-pereira-v1"},
                "parametros": {"beta": estimated.beta, "gamma": estimated.gamma,
                    "condiciones_iniciales": {"susceptibles": last.susceptibles, "infectados": last.infectados, "recuperados": last.recuperados},
                    "horizonte_dias": 14, "metodo_numerico": "RK4"},
                "datos_entrada": {"historial_poblacion_ids": [ObjectId(p.registro_poblacion_id) for p in observations],
                    "casos_enfermedades_ids": [ObjectId(p.registro_casos_id) for p in observations]},
                "preprocesamiento": {"registros_considerados": len(observations), "registros_descartados": 0,
                    "observaciones": f"{SOURCE}: resultado calculado por el motor; sus datos de entrada son sintéticos"},
                "trayectoria": [asdict(point) for point in result.curva],
            })
            data["estados_semaforo"][-1]["datos_origen"]["predicciones_sir_ids"].append(prediction_id)
        for key, timestamp, state_id, risk, code, poor_water, alert_ids in daily_refs:
            hours = range(24 if timestamp.date() < now.date() else min(24, now.hour + 1))
            for hour in hours:
                bucket = timestamp + timedelta(hours=hour)
                measurement = {"fecha_hora": bucket, "ph": round(7.0 + (hour % 5) * 0.06, 2),
                    "cloro_residual": 0.1 if poor_water else round(0.5 + (hour % 3) * 0.05, 2),
                    "personas_alojadas": population, "porcentaje_ocupacion": round(population / capacity * 100, 2)}
                metric_id = add("metricas_albergue", f"{key}:{hour}", {"albergue_id": shelter_id,
                    "fecha_bucket": bucket, "mediciones": [measurement], "ultima_medicion": measurement,
                    "calculados": {"cantidad_mediciones": 1, "suma_ph": measurement["ph"],
                        "suma_cloro_residual": measurement["cloro_residual"], "promedio_ph": measurement["ph"],
                        "promedio_cloro_residual": measurement["cloro_residual"], "porcentaje_ocupacion": measurement["porcentaje_ocupacion"]},
                    "estado_actual": {"agua": {"nivel": "bajo" if poor_water else "adecuado"},
                        "hacinamiento": {"nivel": "alto" if population / capacity > 0.95 else "normal"},
                        "semaforo_vital": {"nivel": risk, "codigo": code, "estado_semaforo_id": state_id, "fecha_calculo": timestamp},
                        "alertas_activas": {"cantidad": len(alert_ids) if (end - timestamp.date()).days <= 6 else 0,
                            "ids": alert_ids if (end - timestamp.date()).days <= 6 else []}},
                    "created_at": now, "updated_at": now})
                if hour == 0:
                    # Referencia representativa, sin listas de miles de mediciones dentro de un estado.
                    state = next(row for row in reversed(data["estados_semaforo"]) if row["_id"] == state_id)
                    state["datos_origen"]["metricas_albergue_ids"].append(metric_id)
    return data


def validate_samples(database, data):
    for collection, rows in data.items():
        if not rows:
            continue
        info = database.command("listCollections", filter={"name": collection})["cursor"]["firstBatch"]
        if not info or not info[0].get("options", {}).get("validator"):
            raise ValueError(f"Falta el validador de {collection}; aplique las migraciones primero")
        validator = info[0]["options"]["validator"]
        samples = [rows[0], rows[len(rows) // 2], rows[-1]]
        invalid = list(database.aggregate([
            {"$documents": {"$literal": samples}}, {"$match": {"$nor": [validator]}}, {"$project": {"_id": 1}},
        ]))
        if invalid:
            raise ValueError(f"La carga sintética no cumple el contrato de {collection}; no se inició la escritura")
    print("Muestras compatibles con todos los validadores de MongoDB", flush=True)


def write_documents(database, collection, documents, batch_size=1000):
    inserted = 0
    for offset in range(0, len(documents), batch_size):
        batch = documents[offset:offset + batch_size]
        result = database[collection].bulk_write([
            UpdateOne({"_id": doc["_id"]}, {"$setOnInsert": doc}, upsert=True) for doc in batch
        ], ordered=True)
        inserted += result.upserted_count
    print(f"{collection}: {len(documents)} preparados, {inserted} nuevos", flush=True)
    return inserted


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--shelters", type=int, default=30)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--end-date", type=date.fromisoformat, default=now_colombia().date())
    parser.add_argument("--credentials", type=Path, default=Path("/tmp/semaforo-demo-pereira-credenciales.csv"))
    args = parser.parse_args()
    if not 1 <= args.shelters <= 100 or not 29 <= args.days <= 180:
        parser.error("Use entre 1 y 100 albergues, y entre 29 y 180 días")
    now = now_colombia()
    if args.end_date > now.date():
        parser.error("La fecha final no puede ser futura")
    if args.credentials.exists():
        with args.credentials.open(newline="") as handle:
            password = next(csv.DictReader(handle))["password"]
    else:
        password = os.environ.get("SEMAFORO_DEMO_PASSWORD") or "1077"
    client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=10000)
    try:
        database = client[settings.mongodb_db]
        actor = database.usuarios.find_one({"role": "super_administrador", "active": True}, {"_id": 1})
        if not actor:
            raise RuntimeError("Debe existir un súper administrador activo para atribuir la carga")
        data = generate_dataset(args.shelters, args.days, args.end_date, now, actor["_id"], hash_password(password))
        print(json.dumps({"campaña": CAMPAIGN, "fecha_inicial": str(args.end_date - timedelta(days=args.days - 1)),
            "fecha_final": str(args.end_date), "documentos": {k: len(v) for k, v in data.items()},
            "total": sum(map(len, data.values()))}, ensure_ascii=False), flush=True)
        if not args.apply:
            return
        validate_samples(database, data)
        args.credentials.parent.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(args.credentials, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        os.chmod(args.credentials, 0o600)
        with os.fdopen(descriptor, "w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["email", "password", "albergue", "codigo"])
            writer.writeheader()
            by_id = {row["_id"]: row for row in data["albergues"]}
            for user in data["usuarios"]:
                shelter = by_id[user["albergue_id"]]
                writer.writerow({"email": user["email"], "password": password,
                    "albergue": shelter["nombre"], "codigo": shelter["codigo_albergue"]})
        args.credentials.chmod(0o600)
        # Guardar antes de escribir la BD permite reanudar una carga parcial con las mismas credenciales.
        inserted = Counter()
        inserted["albergues"] += write_documents(database, "albergues", data["albergues"])
        inserted["usuarios"] += write_documents(database, "usuarios", data["usuarios"])
        for collection in COLLECTIONS[2:]:
            inserted[collection] += write_documents(database, collection, data[collection])
        database.demo_seed_runs.update_one({"_id": CAMPAIGN}, {"$set": {"source": SOURCE,
            "last_run_at": now, "shelters": args.shelters, "days": args.days,
            "end_date": str(args.end_date), "planned": {k: len(v) for k, v in data.items()}}}, upsert=True)
        print(json.dumps({"nuevos": sum(inserted.values()), "credenciales": str(args.credentials)}, ensure_ascii=False))
    except PyMongoError as error:
        # No imprimir operaciones ni detalles de conexión: podrían contener hashes o credenciales.
        raise SystemExit(f"Carga detenida por {type(error).__name__}; se puede reejecutar sin sobrescribir") from None
    finally:
        client.close()


if __name__ == "__main__":
    main()
