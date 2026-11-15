// ============================================================
// SEMÁFORO VITAL
// Migración:
//   005_create_condiciones_sanitarias
//
// Responsabilidad DBA:
//   - crear la colección condiciones_sanitarias
//   - establecer $jsonSchema
//   - configurar validación strict
//   - crear índice para consultas por albergue y fecha
//   - mantener trazabilidad de creación/modificación
//   - registrar la migración en schema_migrations
//
// IMPORTANTE:
// - estado_higiene permanece String abierto hasta que la PO
//   defina el catálogo funcional.
// - estado_saneamiento permanece String abierto hasta que la PO
//   defina el catálogo funcional.
// - fuente_datos permanece String abierto hasta que se defina
//   su catálogo oficial.
//
// MongoDB valida estructura y tipos.
// Las referencias entre colecciones son referencias lógicas.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

const MIGRATION_VERSION =
    "005_create_condiciones_sanitarias";

print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 005");
print(" CREACIÓN DE CONDICIONES SANITARIAS");
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
            "004_add_update_traceability"
    });

if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 004_add_update_traceability " +
        "debe estar aplicada exactamente una vez antes " +
        "de ejecutar la 005."
    );
}

print(
    "✓ Migración 004 verificada."
);


// ============================================================
// 3. DEFINIR VALIDADOR
// ============================================================

const validatorCondicionesSanitarias = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de condiciones sanitarias",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha",
            "agua_potable_disponible",
            "banos_disponibles",
            "estado_higiene",
            "estado_saneamiento",
            "fuente_datos",
            "registrado_por",
            "created_at"
        ],

        properties: {

            _id: {
                bsonType:
                    "objectId",

                description:
                    "Identificador único del registro"
            },


            albergue_id: {
                bsonType:
                    "objectId",

                description:
                    "Referencia lógica a albergues._id"
            },


            fecha: {
                bsonType:
                    "date",

                description:
                    "Fecha funcional de la condición sanitaria"
            },


            agua_potable_disponible: {
                bsonType:
                    "bool",

                description:
                    "Indica disponibilidad de agua potable"
            },


            banos_disponibles: {
                bsonType:
                    "int",

                minimum:
                    0,

                description:
                    "Cantidad de baños disponibles"
            },


            estado_higiene: {
                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Estado de higiene. Catálogo funcional pendiente de definición"
            },


            estado_saneamiento: {
                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Estado de saneamiento. Catálogo funcional pendiente de definición"
            },


            otros_recursos_sanitarios: {

                bsonType:
                    "array",

                description:
                    "Otros recursos sanitarios disponibles",

                items: {

                    bsonType:
                        "object",

                    additionalProperties:
                        false,

                    required: [
                        "nombre",
                        "cantidad"
                    ],

                    properties: {

                        nombre: {
                            bsonType:
                                "string",

                            minLength:
                                1,

                            description:
                                "Nombre del recurso sanitario"
                        },


                        cantidad: {
                            bsonType:
                                "int",

                            minimum:
                                0,

                            description:
                                "Cantidad disponible del recurso"
                        },


                        observacion: {
                            bsonType:
                                "string",

                            description:
                                "Observación asociada al recurso"
                        }
                    }
                }
            },


            observaciones: {
                bsonType:
                    "string",

                description:
                    "Observaciones generales del registro"
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
                    "Referencia lógica al usuario creador"
            },


            created_at: {
                bsonType:
                    "date",

                description:
                    "Fecha y hora original de creación"
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

const existeCondicionesSanitarias =
    db
        .getCollectionNames()
        .includes(
            "condiciones_sanitarias"
        );


if (
    !existeCondicionesSanitarias
) {

    db.createCollection(
        "condiciones_sanitarias",
        {

            validator:
                validatorCondicionesSanitarias,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );

    print(
        "✓ Colección creada: condiciones_sanitarias"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "condiciones_sanitarias",

            validator:
                validatorCondicionesSanitarias,

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
            "de condiciones_sanitarias."
        );
    }


    print(
        "✓ Validador actualizado: condiciones_sanitarias"
    );
}


// ============================================================
// 5. CREAR ÍNDICE
// ============================================================
//
// Este índice NO es único.
//
// Una condición sanitaria representa información histórica y
// actualmente no existe una regla funcional aprobada que limite
// a un único documento por albergue y fecha.
// ============================================================

db.condiciones_sanitarias.createIndex(
    {
        albergue_id:
            1,

        fecha:
            -1
    },
    {
        name:
            "ix_condiciones_sanitarias_albergue_fecha"
    }
);

print(
    "✓ Índice creado/verificado: " +
    "ix_condiciones_sanitarias_albergue_fecha"
);


// ============================================================
// 6. CONTROL DE REFERENCIAS LÓGICAS EXISTENTES
// ============================================================
//
// Esta sección también permite que la migración sea segura si
// por alguna razón la colección ya existía con documentos.
// ============================================================


// ------------------------------------------------------------
// 6.1 albergue_id → albergues._id
// ------------------------------------------------------------

const condicionesAlbergueHuerfanas =
    db.condiciones_sanitarias.aggregate([

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

                fecha:
                    1
            }
        }

    ]).toArray();


if (
    condicionesAlbergueHuerfanas.length > 0
) {

    printjson(
        condicionesAlbergueHuerfanas
    );

    throw new Error(
        "Existen condiciones sanitarias asociadas " +
        "a albergues inexistentes."
    );
}


print(
    "✓ Sin referencias huérfanas en albergue_id."
);


// ------------------------------------------------------------
// 6.2 registrado_por → usuarios._id
// ------------------------------------------------------------

const condicionesUsuarioCreadorHuerfano =
    db.condiciones_sanitarias.aggregate([

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

                fecha:
                    1
            }
        }

    ]).toArray();


if (
    condicionesUsuarioCreadorHuerfano.length > 0
) {

    printjson(
        condicionesUsuarioCreadorHuerfano
    );

    throw new Error(
        "Existen condiciones sanitarias con " +
        "registrado_por inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en registrado_por."
);


// ------------------------------------------------------------
// 6.3 updated_by → usuarios._id
// ------------------------------------------------------------

const condicionesUpdatedByHuerfano =
    db.condiciones_sanitarias.aggregate([

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

                fecha:
                    1
            }
        }

    ]).toArray();


if (
    condicionesUpdatedByHuerfano.length > 0
) {

    printjson(
        condicionesUpdatedByHuerfano
    );

    throw new Error(
        "Existen condiciones sanitarias con " +
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
                "Crear colección condiciones_sanitarias, validator e índice",

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
        "La migración 005 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 9. VERIFICAR ÍNDICE
// ============================================================

const indiceCondicionesSanitarias =
    db.condiciones_sanitarias
        .getIndexes()
        .filter(
            function (indice) {

                return (
                    indice.name ===
                    "ix_condiciones_sanitarias_albergue_fecha"
                );
            }
        );


if (
    indiceCondicionesSanitarias.length !== 1
) {

    throw new Error(
        "No fue posible verificar el índice " +
        "ix_condiciones_sanitarias_albergue_fecha."
    );
}


print(
    "✓ Índice de condiciones sanitarias confirmado."
);


// ============================================================
// 10. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" MIGRACIÓN 005 FINALIZADA");
print("====================================================");

print(
    "✓ Colección condiciones_sanitarias disponible"
);

print(
    "✓ Validator $jsonSchema strict"
);

print(
    "✓ Índice albergue + fecha"
);

print(
    "✓ Controles de referencias lógicas"
);

print(
    "✓ Migración registrada"
);

print("");