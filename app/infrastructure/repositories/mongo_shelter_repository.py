from dataclasses import asdict
from datetime import UTC, datetime

from bson import ObjectId
from bson.decimal128 import Decimal128
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.domain.errors import (
    InvalidPopulation,
    InvalidShelterData,
    PersistenceError,
    PopulationConflict,
)
from app.domain.pagination import ListFilters, PaginatedResult, Pagination
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
    RecordInput,
    RecordKind,
    RiskAnalysis,
    RiskDistribution,
    RiskResult,
    SanitaryConditions,
    SanitaryResource,
    Shelter,
    ShelterIndicators,
    ShelterRecord,
    ShelterUpdate,
    SIRInputs,
    SIRParameters,
    SIRPoint,
    SIRPreprocessing,
    SIRSimulation,
    SIRState,
    TrafficLight,
)
from app.infrastructure.database.errors import persistence_guard as _persistence
from app.infrastructure.database.pagination import (
    filtered_query,
    paginate_aggregate,
    paginate_find,
)

_MATCH = "$match"
_GROUP = "$group"
_SORT = "$sort"
_FIRST = "$first"
_DISEASE_FIELD = "$enfermedad"


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


def _sanitary(document):
    document = _plain(document)
    return SanitaryConditions(
        **_trace(document), albergue_id=document["albergue_id"], fecha=document["fecha"],
        agua_potable_disponible=document["agua_potable_disponible"],
        banos_disponibles=document["banos_disponibles"], estado_higiene=document["estado_higiene"],
        estado_saneamiento=document["estado_saneamiento"], fuente_datos=document["fuente_datos"],
        observaciones=document.get("observaciones"),
        otros_recursos_sanitarios=[SanitaryResource(**item) for item in document.get("otros_recursos_sanitarios", [])],
    )


def _disease(document):
    document = _plain(document)
    return DiseaseRecord(**_trace(document), cantidad_recuperados=document.get("cantidad_recuperados"), albergue_id=document["albergue_id"], fecha=document["fecha"],
                         enfermedad=document["enfermedad"], cantidad_casos_activos=document["cantidad_casos_activos"],
                         fuente_datos=document["fuente_datos"], observaciones=document.get("observaciones"))


def _intervention(document):
    document = _plain(document)
    return Intervention(**_trace(document), albergue_id=document["albergue_id"],
                        fecha_intervencion=document["fecha_intervencion"], tipo_intervencion=document["tipo_intervencion"],
                        descripcion=document["descripcion"], fuente_datos=document["fuente_datos"],
                        observaciones=document.get("observaciones"))


_RECORD_MAPPERS = {RecordKind.SANITARY: _sanitary, RecordKind.DISEASE: _disease, RecordKind.INTERVENTION: _intervention}


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
    def page_records(self, shelter_id: str, kind: RecordKind, paging: Pagination, filters: ListFilters) -> PaginatedResult[ShelterRecord]:
        date_field = "fecha_intervencion" if kind == RecordKind.INTERVENTION else "fecha"
        fields = {RecordKind.DISEASE: ("enfermedad",),
                  RecordKind.SANITARY: ("estado_higiene", "estado_saneamiento", "observaciones"),
                  RecordKind.INTERVENTION: ("tipo_intervencion", "descripcion", "observaciones")}[kind]
        query = filtered_query({"albergue_id": ObjectId(shelter_id)}, filters, fields, date_field)
        return paginate_find(self.database[kind.value], query, paging, [(date_field, -1), ("_id", -1)], _RECORD_MAPPERS[kind])

    @_persistence
    def page_population(self, shelter_id: str, paging: Pagination, filters: ListFilters) -> PaginatedResult[PopulationRecord]:
        query = filtered_query({"albergue_id": ObjectId(shelter_id)}, filters, (), "fecha")
        return paginate_find(self.database.historial_poblacion, query, paging,
                             [("fecha", -1), ("_id", -1)], _population_record)

    @_persistence
    def page_sir_diseases(self, shelter_id: str, since: datetime, until: datetime,
                          paging: Pagination, disease: str | None = None) -> PaginatedResult[str]:
        pipeline = [{_MATCH: {"albergue_id": ObjectId(shelter_id), "fecha": {"$gte": since, "$lte": until}}},
            {"$group": {"_id": {"$toLower": {"$trim": {"input": _DISEASE_FIELD}}}, "nombre": {"$first": _DISEASE_FIELD}}}]
        if disease:
            pipeline.append({_MATCH: {"_id": disease.strip().casefold()}})
        pipeline.append({"$sort": {"_id": 1}})
        return paginate_aggregate(self.database.casos_enfermedades, pipeline, paging, lambda row: row["nombre"].strip())

    @_persistence
    def list_records(self, shelter_id: str, kind: RecordKind, limit: int, offset: int) -> list[ShelterRecord]:
        date_field = "fecha_intervencion" if kind == RecordKind.INTERVENTION else "fecha"
        cursor = self.database[kind.value].find({"albergue_id": ObjectId(shelter_id)})
        return [_RECORD_MAPPERS[kind](doc) for doc in cursor.sort([(date_field, -1), ("_id", -1)]).skip(offset).limit(limit)]

    @_persistence
    def save_record(self, shelter_id: str, kind: RecordKind, command: RecordInput,
                    user_id: str, now: datetime, record_id: str | None = None) -> ShelterRecord | None:
        collection = self.database[kind.value]
        values = {key: value for key, value in asdict(command).items() if value is not None}
        # BSON validators reject null optional fields, including nested resource observations.
        if "otros_recursos_sanitarios" in values:
            values["otros_recursos_sanitarios"] = [
                {key: value for key, value in resource.items() if value is not None}
                for resource in values["otros_recursos_sanitarios"]
            ]
        if record_id is None:
            document = {**values, "albergue_id": ObjectId(shelter_id),
                        "registrado_por": ObjectId(user_id), "created_at": now}
            collection.insert_one(document)
        else:
            if not ObjectId.is_valid(record_id):
                return None
            update = {"$set": {**values, "updated_by": ObjectId(user_id), "updated_at": now}}
            if command.observaciones is None:
                update["$unset"] = {"observaciones": ""}
            document = collection.find_one_and_update(
                {"_id": ObjectId(record_id), "albergue_id": ObjectId(shelter_id)},
                update, return_document=ReturnDocument.AFTER,
            )
        return _RECORD_MAPPERS[kind](document) if document else None

    @_persistence
    def find(self, shelter_id: str) -> Shelter | None:
        if not ObjectId.is_valid(shelter_id):
            return None
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
    def sir_history(self, shelter_id: str, since: datetime, until: datetime, diseases: list[str] | None = None) -> list[DiseaseRecord]:
        # Historial acotado por fecha, no por número de registros: no omite enfermedades con menos entradas.
        query = {"albergue_id": ObjectId(shelter_id), "fecha": {"$gte": since, "$lte": until}}
        if diseases is not None:
            if not diseases:
                return []
            query["$expr"] = {"$in": [{"$toLower": {"$trim": {"input": _DISEASE_FIELD}}}, [name.casefold() for name in diseases]]}
        documents = self.database.casos_enfermedades.find(query).sort([("fecha", 1), ("updated_at", 1), ("created_at", 1), ("_id", 1)])
        return [_disease(document) for document in documents]

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
            {_MATCH: scope},
            {_GROUP: {
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
            {_MATCH: {**scope, "escenario_id": None}},
            {_SORT: {"fecha_ejecucion": -1, "_id": -1}},
            {_GROUP: {"_id": _DISEASE_FIELD, "simulation": {_FIRST: "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$simulation"}},
            {_SORT: {"fecha_ejecucion": -1, "_id": -1}},
            {"$limit": limit},
        ]))
        summaries = _plain(list(self.database.casos_enfermedades.aggregate([
            {_MATCH: scope},
            {_SORT: {"fecha": -1, "_id": -1}},
            {_GROUP: {"_id": _DISEASE_FIELD, "cantidad_casos_activos": {_FIRST: "$cantidad_casos_activos"}, "fecha": {_FIRST: "$fecha"}}},
            {"$project": {"_id": 0, "enfermedad": "$_id", "cantidad_casos_activos": 1, "fecha": 1}},
            {_SORT: {"enfermedad": 1}},
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
            condiciones_sanitarias=_sanitary(sanitary) if sanitary else None,
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
            evolucion_epidemiologica=[_disease(doc) for doc in history("casos_enfermedades", "fecha")],
            intervenciones=[_intervention(doc) for doc in history("intervenciones", "fecha_intervencion")],
        )
