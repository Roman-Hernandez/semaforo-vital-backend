// ============================================================
// SEMÁFORO VITAL
// Migración:
//   007_create_intervenciones
//
// Responsabilidad DBA:
//   - crear la colección intervenciones
//   - establecer $jsonSchema
//   - configurar validación strict
//   - crear índices para consultas por albergue, fecha y tipo
//   - mantener trazabilidad de creación/modificación
//   - controlar referencias lógicas existentes
//   - registrar la migración en schema_migrations
//
// IMPORTANTE:
//
// La colección intervenciones representa acciones REALES
// ejecutadas sobre un albergue.
//
// NO representa:
//   - simulaciones
//   - escenarios hipotéticos
//   - recomendaciones no ejecutadas
//
// Las intervenciones simuladas se almacenarán posteriormente
// dentro del modelo de escenarios.
//
// tipo_intervencion permanece String abierto hasta que la PO
// defina el catálogo funcional.
//
// fuente_datos permanece String abierto hasta que se defina
// su catálogo oficial.
//
// MongoDB valida estructura y tipos.
// Las referencias entre colecciones son referencias lógicas.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

const MIGRATION_VERSION =
    "007_create_intervenciones";

print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 007");
print(" CREACIÓN DE INTERVENCIONES");
print("====================================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES REQUERIDAS
// ============================================================

const coleccionesRequeridas = [
    "usuarios",
    "albergues",
    "schema_migrations"
];

const coleccionesExistentes =
    db.getCollectionNames();


coleccionesRequeridas.forEach(
    function (coleccion) {

        if (
            !coleccionesExistentes.includes(
                coleccion
            )
        ) {

            throw new Error(
                "No existe la colección requerida: " +
                coleccion
            );
        }
    }
);


print(
    "✓ Colecciones requeridas disponibles."
);


// ============================================================
// 2. VERIFICAR MIGRACIÓN ANTERIOR
// ============================================================

const migracionAnterior =
    db.schema_migrations.countDocuments({
        version:
            "006_create_casos_enfermedades"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 006_create_casos_enfermedades " +
        "debe estar aplicada exactamente una vez antes " +
        "de ejecutar la 007."
    );
}


print(
    "✓ Migración 006 verificada."
);


// ============================================================
// 3. DEFINIR VALIDADOR
// ============================================================

const validatorIntervenciones = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de intervenciones",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha_intervencion",
            "tipo_intervencion",
            "descripcion",
            "fuente_datos",
            "registrado_por",
            "created_at"
        ],

        properties: {

            _id: {
                bsonType:
                    "objectId",

                description:
                    "Identificador único de la intervención"
            },


            albergue_id: {
                bsonType:
                    "objectId",

                description:
                    "Referencia lógica a albergues._id"
            },


            fecha_intervencion: {
                bsonType:
                    "date",

                description:
                    "Fecha funcional en la que fue ejecutada la intervención"
            },


            tipo_intervencion: {
                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Tipo de intervención ejecutada. Catálogo funcional pendiente de definición"
            },


            descripcion: {
                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Descripción de la intervención realmente ejecutada"
            },


            observaciones: {
                bsonType:
                    "string",

                description:
                    "Observaciones adicionales relacionadas con la intervención"
            },


            fuente_datos: {
                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Origen del dato. Catálogo funcional pendiente de definición"
            },


            registrado_por: {
                bsonType:
                    "objectId",

                description:
                    "Referencia lógica al usuario responsable de registrar la intervención"
            },


            created_at: {
                bsonType:
                    "date",

                description:
                    "Fecha y hora técnica original de creación"
            },


            updated_at: {
                bsonType:
                    "date",

                description:
                    "Fecha y hora de la última modificación"
            },


            updated_by: {
                bsonType:
                    "objectId",

                description:
                    "Referencia lógica al usuario responsable de la última modificación"
            }
        }
    }
};


// ============================================================
// 4. CREAR O ACTUALIZAR COLECCIÓN
// ============================================================

const existeIntervenciones =
    db
        .getCollectionNames()
        .includes(
            "intervenciones"
        );


if (
    !existeIntervenciones
) {

    db.createCollection(
        "intervenciones",
        {

            validator:
                validatorIntervenciones,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );


    print(
        "✓ Colección creada: intervenciones"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "intervenciones",

            validator:
                validatorIntervenciones,

            validationLevel:
                "strict",

            validationAction:
                "error"
        });


    if (
        resultadoCollMod.ok !== 1
    ) {

        throw new Error(
            "No fue posible actualizar el validator " +
            "de intervenciones."
        );
    }


    print(
        "✓ Validador actualizado: intervenciones"
    );
}


// ============================================================
// 5. CREAR ÍNDICES
// ============================================================
//
// Los índices NO son únicos.
//
// Pueden existir varias intervenciones:
//   - para un mismo albergue
//   - en una misma fecha
//   - incluso del mismo tipo
//
// porque representan acciones reales independientes.
// ============================================================


// ------------------------------------------------------------
// 5.1 Consultas por albergue + fecha
// ------------------------------------------------------------

db.intervenciones.createIndex(
    {
        albergue_id:
            1,

        fecha_intervencion:
            -1
    },
    {
        name:
            "ix_intervenciones_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_intervenciones_albergue_fecha"
);


// ------------------------------------------------------------
// 5.2 Consultas por albergue + tipo + fecha
// ------------------------------------------------------------

db.intervenciones.createIndex(
    {
        albergue_id:
            1,

        tipo_intervencion:
            1,

        fecha_intervencion:
            -1
    },
    {
        name:
            "ix_intervenciones_albergue_tipo_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_intervenciones_albergue_tipo_fecha"
);


// ============================================================
// 6. CONTROL DE REFERENCIAS LÓGICAS EXISTENTES
// ============================================================
//
// Esta validación permite detectar inconsistencias si la
// colección ya existiera con documentos antes de aplicar
// formalmente la migración.
// ============================================================


// ------------------------------------------------------------
// 6.1 albergue_id → albergues._id
// ------------------------------------------------------------

const intervencionesAlbergueHuerfanas =
    db.intervenciones.aggregate([

        {
            $lookup: {

                from:
                    "albergues",

                localField:
                    "albergue_id",

                foreignField:
                    "_id",

                as:
                    "albergue"
            }
        },

        {
            $match: {

                "albergue.0": {
                    $exists:
                        false
                }
            }
        },

        {
            $project: {

                albergue_id:
                    1,

                fecha_intervencion:
                    1,

                tipo_intervencion:
                    1
            }
        }

    ]).toArray();


if (
    intervencionesAlbergueHuerfanas.length > 0
) {

    printjson(
        intervencionesAlbergueHuerfanas
    );

    throw new Error(
        "Existen intervenciones asociadas " +
        "a albergues inexistentes."
    );
}


print(
    "✓ Sin referencias huérfanas en albergue_id."
);


// ------------------------------------------------------------
// 6.2 registrado_por → usuarios._id
// ------------------------------------------------------------

const intervencionesUsuarioCreadorHuerfano =
    db.intervenciones.aggregate([

        {
            $lookup: {

                from:
                    "usuarios",

                localField:
                    "registrado_por",

                foreignField:
                    "_id",

                as:
                    "usuario_creador"
            }
        },

        {
            $match: {

                "usuario_creador.0": {
                    $exists:
                        false
                }
            }
        },

        {
            $project: {

                registrado_por:
                    1,

                albergue_id:
                    1,

                fecha_intervencion:
                    1,

                tipo_intervencion:
                    1
            }
        }

    ]).toArray();


if (
    intervencionesUsuarioCreadorHuerfano.length > 0
) {

    printjson(
        intervencionesUsuarioCreadorHuerfano
    );

    throw new Error(
        "Existen intervenciones con " +
        "registrado_por inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en registrado_por."
);


// ------------------------------------------------------------
// 6.3 updated_by → usuarios._id
// ------------------------------------------------------------

const intervencionesUpdatedByHuerfano =
    db.intervenciones.aggregate([

        {
            $match: {

                updated_by: {
                    $exists:
                        true
                }
            }
        },

        {
            $lookup: {

                from:
                    "usuarios",

                localField:
                    "updated_by",

                foreignField:
                    "_id",

                as:
                    "usuario_actualizador"
            }
        },

        {
            $match: {

                "usuario_actualizador.0": {
                    $exists:
                        false
                }
            }
        },

        {
            $project: {

                updated_by:
                    1,

                albergue_id:
                    1,

                fecha_intervencion:
                    1,

                tipo_intervencion:
                    1
            }
        }

    ]).toArray();


if (
    intervencionesUpdatedByHuerfano.length > 0
) {

    printjson(
        intervencionesUpdatedByHuerfano
    );

    throw new Error(
        "Existen intervenciones con " +
        "updated_by inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en updated_by."
);


// ============================================================
// 7. REGISTRAR MIGRACIÓN
// ============================================================

db.schema_migrations.updateOne(
    {
        version:
            MIGRATION_VERSION
    },

    {
        $setOnInsert: {

            version:
                MIGRATION_VERSION,

            description:
                "Crear colección intervenciones, validator e índices",

            executed_at:
                new Date()
        }
    },

    {
        upsert:
            true
    }
);


print("");
print(
    "✓ Migración registrada: " +
    MIGRATION_VERSION
);


// ============================================================
// 8. VERIFICAR REGISTRO ÚNICO
// ============================================================

const cantidadMigracion =
    db.schema_migrations.countDocuments({
        version:
            MIGRATION_VERSION
    });


if (
    cantidadMigracion !== 1
) {

    throw new Error(
        "La migración 007 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 9. VERIFICAR ÍNDICES
// ============================================================

const indicesIntervenciones =
    db.intervenciones
        .getIndexes();


// ------------------------------------------------------------
// 9.1 Índice albergue + fecha
// ------------------------------------------------------------

const indiceAlbergueFecha =
    indicesIntervenciones.filter(
        function (indice) {

            return (
                indice.name ===
                "ix_intervenciones_albergue_fecha"
            );
        }
    );


if (
    indiceAlbergueFecha.length !== 1
) {

    throw new Error(
        "No fue posible verificar el índice " +
        "ix_intervenciones_albergue_fecha."
    );
}


print(
    "✓ Índice albergue + fecha confirmado."
);


// ------------------------------------------------------------
// 9.2 Índice albergue + tipo + fecha
// ------------------------------------------------------------

const indiceAlbergueTipoFecha =
    indicesIntervenciones.filter(
        function (indice) {

            return (
                indice.name ===
                "ix_intervenciones_albergue_tipo_fecha"
            );
        }
    );


if (
    indiceAlbergueTipoFecha.length !== 1
) {

    throw new Error(
        "No fue posible verificar el índice " +
        "ix_intervenciones_albergue_tipo_fecha."
    );
}


print(
    "✓ Índice albergue + tipo + fecha confirmado."
);


// ============================================================
// 10. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" MIGRACIÓN 007 FINALIZADA");
print("====================================================");

print(
    "✓ Colección intervenciones disponible"
);

print(
    "✓ Validator $jsonSchema strict"
);

print(
    "✓ Intervenciones reales diferenciadas de simulaciones"
);

print(
    "✓ Índice albergue + fecha"
);

print(
    "✓ Índice albergue + tipo + fecha"
);

print(
    "✓ Controles de referencias lógicas"
);

print(
    "✓ Migración registrada"
);

print("");