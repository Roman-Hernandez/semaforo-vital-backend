// Historial poblacional independiente: no modifica albergues ni registros_diarios.
db = db.getSiblingDB("semaforo_vital");
const version = "010_create_historial_poblacion";

if (!db.getCollectionNames().includes("historial_poblacion")) {
    db.createCollection("historial_poblacion", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                additionalProperties: false,
                required: ["albergue_id", "fecha", "poblacion", "registrado_por", "created_at"],
                properties: {
                    _id: {bsonType: "objectId"},
                    albergue_id: {bsonType: "objectId"},
                    fecha: {bsonType: "date"},
                    poblacion: {bsonType: "int", minimum: 0},
                    registrado_por: {bsonType: "objectId"},
                    created_at: {bsonType: "date"},
                    updated_at: {bsonType: "date"},
                    updated_by: {bsonType: "objectId"}
                }
            }
        },
        validationLevel: "strict",
        validationAction: "error"
    });
}

db.historial_poblacion.createIndex(
    {albergue_id: 1, fecha: -1},
    {unique: true, name: "ux_historial_poblacion_albergue_fecha"}
);

// Conserva la población histórica existente, sin sobrescribir reportes nuevos.
db.registros_diarios.find({}).forEach(registro => {
    const poblacion = {
        albergue_id: registro.albergue_id,
        fecha: registro.fecha,
        poblacion: registro.poblacion,
        registrado_por: registro.registrado_por,
        created_at: registro.created_at
    };
    for (const campo of ["updated_at", "updated_by"]) {
        if (registro[campo] !== undefined) poblacion[campo] = registro[campo];
    }
    db.historial_poblacion.updateOne(
        {albergue_id: registro.albergue_id, fecha: registro.fecha},
        {$setOnInsert: poblacion},
        {upsert: true}
    );
});

db.schema_migrations.updateOne({version}, {$setOnInsert: {
    version,
    description: "Crear historial poblacional independiente por albergue y fecha",
    executed_at: new Date()
}}, {upsert: true});
