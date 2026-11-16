from dataclasses import asdict
from datetime import UTC, datetime
from functools import wraps

from bson import ObjectId
from bson.decimal128 import Decimal128
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.domain.errors import (
    InvalidPopulation,
    InvalidShelterData,
    PersistenceError,
    PopulationConflict,
)
from app.domain.shelters import (
    AlertStatistics,
    AnalysisInputs,
    AnalysisPeriod,
    DailyCases,
    DashboardSources,
    DiseaseRecord,
    DiseaseSummary,
    GeoPoint,
    Intervention,
    IntradayOccupancy,
    Location,
    MissingData,
    ModelVersion,
    PopulationRecord,
    Preprocessing,
    ProjectionPeriod,
    RiskAnalysis,
    RiskDistribution,
    RiskResult,
    SanitaryConditions,
    SanitaryResource,
    Shelter,
    ShelterIndicators,
    ShelterUpdate,
    SIRInputs,
    SIRParameters,
    SIRPoint,
    SIRPreprocessing,
    SIRSimulation,
    SIRState,
    TrafficLight,
)


def _plain(value):
    """Normalización privada del adaptador; no exporta documentos a la aplicación."""
    if isinstance(value, datetime):
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, Decimal128):
        return float(value.to_decimal())
    if isinstance(value, dict):
        return {("id" if key == "_id" else key): _plain(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_plain(item) for item in value]
    return value


def _persistence(operation):
    @wraps(operation)
    def guarded(*args, **kwargs):
        try:
            return operation(*args, **kwargs)
        except PyMongoError as exc:
            raise PersistenceError() from exc
    return guarded


def _trace(document):
    return {key: document.get(key) for key in (
        "id", "created_at", "registrado_por", "updated_at", "updated_by",
    )}


def _location(document):
    coordinates = document["coordenadas"]
    return Location(
        departamento=document["departamento"], municipio=document["municipio"],
        direccion=document["direccion"],
        coordenadas=GeoPoint(type=coordinates["type"], coordinates=tuple(coordinates["coordinates"])),
    )


def _shelter(document):
    if document is None:
        return None
    document = _plain(document)
    return Shelter(
        **_trace(document), codigo_albergue=document["codigo_albergue"],
        nombre=document["nombre"], ubicacion=_location(document["ubicacion"]),
        capacidad_instalada=document["capacidad_instalada"], activo=document["activo"],
        fecha=document["fecha"],
    )


def _population_record(document):
    document = _plain(document)
    return PopulationRecord(
        **_trace(document), albergue_id=document["albergue_id"],
        fecha=document["fecha"], poblacion=document["poblacion"],
    )


def _sir_simulation(document) -> SIRSimulation:
    document = _plain(document)
    parameters = document["parametros"]
    initial = parameters["condiciones_iniciales"]
    inputs = document["datos_entrada"]
    preprocessing = document["preprocesamiento"]
    points = [SIRPoint(
        dia=item["dia"], susceptibles=item["susceptibles"],
        infectados=item["infectados"], recuperados=item["recuperados"],
    ) for item in sorted(document["trayectoria"], key=lambda item: item["dia"])]
    if not points:
        raise PersistenceError()
    return SIRSimulation(
        **_trace(document), albergue_id=document["albergue_id"],
        fecha_ejecucion=document["fecha_ejecucion"], enfermedad=document["enfermedad"],
        publica=document["publica"], escenario_id=document.get("escenario_id"),
        modelo=ModelVersion(nombre=document["modelo"]["nombre"], version=document["modelo"]["version"]),
        parametros=SIRParameters(
            beta=parameters["beta"], gamma=parameters["gamma"],
            condiciones_iniciales=SIRState(
                susceptibles=initial["susceptibles"], infectados=initial["infectados"],
                recuperados=initial["recuperados"],
            ),
            horizonte_dias=parameters["horizonte_dias"], metodo_numerico=parameters["metodo_numerico"],
        ),
        datos_entrada=SIRInputs(
            historial_poblacion_ids=inputs["historial_poblacion_ids"],
            casos_enfermedades_ids=inputs["casos_enfermedades_ids"], analisis_ia_id=inputs.get("analisis_ia_id"),
        ),
        preprocesamiento=SIRPreprocessing(
            registros_considerados=preprocessing["registros_considerados"],
            registros_descartados=preprocessing["registros_descartados"],
            observaciones=preprocessing.get("observaciones"),
        ),
        trayectoria=points,
        periodo_estimacion=ProjectionPeriod(dia_inicio=points[0].dia, dia_fin=points[-1].dia),
    )


class MongoShelterRepository:
    def __init__(self, database: Database):
        self.database = database

    @_persistence
    def find(self, shelter_id: str) -> Shelter | None:
        return _shelter(self.database.albergues.find_one({"_id": ObjectId(shelter_id)}))

    @_persistence
    def update(self, shelter_id: str, changes: ShelterUpdate, user_id: str, now: datetime) -> Shelter | None:
        # BSON int32 is a storage constraint, not a population business rule.
        if changes.capacidad_instalada is not None and changes.capacidad_instalada > 2147483647:
            raise InvalidShelterData()
        values = {key: value for key, value in asdict(changes).items() if value is not None}
        if "ubicacion" in values:
            values["ubicacion"]["coordenadas"]["coordinates"] = list(changes.ubicacion.coordenadas.coordinates)
        return _shelter(self.database.albergues.find_one_and_update(
            {"_id": ObjectId(shelter_id)},
            {"$set": {**values, "updated_by": ObjectId(user_id), "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        ))

    @_persistence
    def population_history(self, shelter_id: str, limit: int, offset: int) -> list[PopulationRecord]:
        cursor = self.database.historial_poblacion.find({"albergue_id": ObjectId(shelter_id)})
        return [_population_record(doc) for doc in cursor.sort([("fecha", -1), ("_id", -1)]).skip(offset).limit(limit)]

    @_persistence
    def save_population(
        self, shelter_id: str, user_id: str, day: datetime, population: int, now: datetime,
    ) -> PopulationRecord:
        if population > 2147483647:
            raise InvalidPopulation()
        try:
            document = self.database.historial_poblacion.find_one_and_update(
                {"albergue_id": ObjectId(shelter_id), "fecha": day},
                {"$set": {"poblacion": population, "updated_at": now, "updated_by": ObjectId(user_id)},
                 "$setOnInsert": {"registrado_por": ObjectId(user_id), "created_at": now}},
                upsert=True, return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError as exc:
            raise PopulationConflict() from exc
        return _population_record(document)

    @_persistence
    def latest_metrics(self, shelter_id: str) -> ShelterIndicators:
        document = self.database.metricas_albergue.find_one(
            {"albergue_id": ObjectId(shelter_id)}, sort=[("fecha_bucket", -1), ("_id", -1)],
        )
        if document is None:
            return ShelterIndicators()
        document = _plain(document)
        measurement = document["ultima_medicion"]
        snapshot = document.get("estado_actual", {})
        risk = snapshot.get("semaforo_vital")
        return ShelterIndicators(
            ocupacion=IntradayOccupancy(
                porcentaje_ocupacion=document["calculados"].get("porcentaje_ocupacion"),
                personas_alojadas=measurement["personas_alojadas"], fecha_hora=measurement["fecha_hora"],
            ),
            semaforo=TrafficLight(
                nivel=risk["nivel"], codigo=risk.get("codigo"),
                estado_semaforo_id=risk.get("estado_semaforo_id"), fecha_calculo=risk.get("fecha_calculo"),
            ) if risk else None,
            alertas_activas=snapshot.get("alertas_activas", {}).get("cantidad"),
            ultima_actualizacion=document.get("updated_at") or document["created_at"],
        )

    @_persistence
    def dashboard_sources(self, shelter_id: str, limit: int) -> DashboardSources:
        scope = {"albergue_id": ObjectId(shelter_id)}

        def latest(collection, date_field, *, real_only=False):
            query = {**scope, "escenario_id": None} if real_only else scope
            return _plain(self.database[collection].find_one(query, sort=[(date_field, -1), ("_id", -1)]))

        def history(collection, date_field):
            return _plain(list(self.database[collection].find(scope).sort([(date_field, -1), ("_id", -1)]).limit(limit)))

        daily = latest("registros_diarios", "fecha")
        sanitary = latest("condiciones_sanitarias", "fecha")
        analysis = latest("analisis_ia", "fecha_ejecucion", real_only=True)
        official = latest("estados_semaforo", "fecha_calculo")
        alert_groups = _plain(list(self.database.alertas.aggregate([
            {"$match": scope},
            {"$group": {
                "_id": "$nivel_riesgo",
                "cantidad": {"$sum": {"$cond": ["$activa", 1, 0]}},
                "ultima_actualizacion": {"$max": {"$ifNull": ["$updated_at", "$created_at"]}},
            }},
        ])))
        counts = {"verde": 0, "amarillo": 0, "rojo": 0}
        for group in alert_groups:
            counts[group["id"]] = group["cantidad"]
        alert_dates = [group["ultima_actualizacion"] for group in alert_groups if group.get("ultima_actualizacion")]
        simulations = list(self.database.predicciones_sir.aggregate([
            {"$match": {**scope, "escenario_id": None}},
            {"$sort": {"fecha_ejecucion": -1, "_id": -1}},
            {"$group": {"_id": "$enfermedad", "simulation": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$simulation"}},
            {"$sort": {"fecha_ejecucion": -1, "_id": -1}},
            {"$limit": limit},
        ]))
        summaries = _plain(list(self.database.casos_enfermedades.aggregate([
            {"$match": scope},
            {"$sort": {"fecha": -1, "_id": -1}},
            {"$group": {"_id": "$enfermedad", "cantidad_casos_activos": {"$first": "$cantidad_casos_activos"}, "fecha": {"$first": "$fecha"}}},
            {"$project": {"_id": 0, "enfermedad": "$_id", "cantidad_casos_activos": 1, "fecha": 1}},
            {"$sort": {"enfermedad": 1}},
        ])))
        return DashboardSources(
            semaforo_oficial=TrafficLight(
                nivel=official["nivel"], codigo=official["codigo"],
                estado_semaforo_id=official["id"], fecha_calculo=official["fecha_calculo"],
            ) if official else None,
            fecha_actualizacion_semaforo=official["created_at"] if official else None,
            alertas=AlertStatistics(
                cantidad=sum(counts.values()), por_nivel_riesgo=RiskDistribution(**counts),
                ultima_actualizacion=max(alert_dates, default=None),
            ),
            simulaciones_sir=[_sir_simulation(item) for item in simulations],
            casos_diarios=DailyCases(
                casos_eda=daily.get("casos_eda"), casos_ira=daily.get("casos_ira"),
                ultima_actualizacion=daily.get("updated_at") or daily["created_at"],
            ) if daily else None,
            condiciones_sanitarias=SanitaryConditions(
                **_trace(sanitary), albergue_id=sanitary["albergue_id"], fecha=sanitary["fecha"],
                agua_potable_disponible=sanitary["agua_potable_disponible"],
                banos_disponibles=sanitary["banos_disponibles"], estado_higiene=sanitary["estado_higiene"],
                estado_saneamiento=sanitary["estado_saneamiento"], fuente_datos=sanitary["fuente_datos"],
                observaciones=sanitary.get("observaciones"),
                otros_recursos_sanitarios=[SanitaryResource(
                    nombre=item["nombre"], cantidad=item["cantidad"], observacion=item.get("observacion"),
                ) for item in sanitary.get("otros_recursos_sanitarios", [])],
            ) if sanitary else None,
            analisis_ia=RiskAnalysis(
                **_trace(analysis), albergue_id=analysis["albergue_id"],
                fecha_ejecucion=analysis["fecha_ejecucion"], escenario_id=analysis.get("escenario_id"),
                periodo_analizado=AnalysisPeriod(
                    fecha_inicio=analysis["periodo_analizado"]["fecha_inicio"],
                    fecha_fin=analysis["periodo_analizado"]["fecha_fin"],
                ),
                modelo=ModelVersion(
                    nombre=analysis["modelo"]["nombre"], version=analysis["modelo"]["version"],
                ),
                resultado=RiskResult(probabilidad_riesgo=analysis["resultado"]["probabilidad_riesgo"]),
                datos_entrada=AnalysisInputs(
                    registros_diarios_ids=analysis["datos_entrada"]["registros_diarios_ids"],
                    condiciones_sanitarias_ids=analysis["datos_entrada"]["condiciones_sanitarias_ids"],
                    casos_enfermedades_ids=analysis["datos_entrada"]["casos_enfermedades_ids"],
                    intervenciones_ids=analysis["datos_entrada"]["intervenciones_ids"],
                    metricas_albergue_ids=analysis["datos_entrada"]["metricas_albergue_ids"],
                ),
                preprocesamiento=Preprocessing(
                    registros_considerados=analysis["preprocesamiento"]["registros_considerados"],
                    registros_descartados=analysis["preprocesamiento"]["registros_descartados"],
                    datos_faltantes=[MissingData(
                        campo=item["campo"], cantidad=item["cantidad"], tratamiento=item["tratamiento"],
                    ) for item in analysis["preprocesamiento"]["datos_faltantes"]],
                ),
            ) if analysis else None,
            resumen_casos=[DiseaseSummary(
                enfermedad=doc["enfermedad"], cantidad_casos_activos=doc["cantidad_casos_activos"], fecha=doc["fecha"],
            ) for doc in summaries],
            evolucion_epidemiologica=[DiseaseRecord(
                **_trace(doc), albergue_id=doc["albergue_id"], fecha=doc["fecha"], enfermedad=doc["enfermedad"],
                cantidad_casos_activos=doc["cantidad_casos_activos"], fuente_datos=doc["fuente_datos"],
                observaciones=doc.get("observaciones"),
            ) for doc in history("casos_enfermedades", "fecha")],
            intervenciones=[Intervention(
                **_trace(doc), albergue_id=doc["albergue_id"], fecha_intervencion=doc["fecha_intervencion"],
                tipo_intervencion=doc["tipo_intervencion"], descripcion=doc["descripcion"],
                fuente_datos=doc["fuente_datos"], observaciones=doc.get("observaciones"),
            ) for doc in history("intervenciones", "fecha_intervencion")],
        )
