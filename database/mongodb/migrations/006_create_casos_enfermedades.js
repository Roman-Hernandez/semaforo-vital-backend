// ============================================================
// SEMÁFORO VITAL
// Migración:
//   006_create_casos_enfermedades
//
// Responsabilidad DBA:
//   - crear la colección casos_enfermedades
//   - establecer $jsonSchema
//   - configurar validación strict
//   - crear índices para consultas epidemiológicas
//   - mantener trazabilidad de creación/modificación
//   - controlar referencias lógicas existentes
//   - registrar la migración en schema_migrations
//
// IMPORTANTE:
//
// cantidad_casos_activos representa la cantidad de personas
// que tienen activa una enfermedad determinada en la fecha
// del registro.
//
// NO representa:
//   - casos nuevos del día
//   - casos acumulados históricos
//
// enfermedad permanece String abierto hasta que la PO
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
    "006_create_casos_enfermedades";

print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 006");
print(" CREACIÓN DE CASOS DE ENFERMEDADES");
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
            "005_create_condiciones_sanitarias"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 005_create_condiciones_sanitarias " +
        "debe estar aplicada exactamente una vez antes " +
        "de ejecutar la 006."
    );
}


print(
    "✓ Migración 005 verificada."
);


// ============================================================
// 3. DEFINIR VALIDADOR
// ============================================================

const validatorCasosEnfermedades = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de casos de enfermedades",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha",
            "enfermedad",
            "cantidad_casos_activos",
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
                    "Fecha funcional del registro epidemiológico"
            },


            enfermedad: {
                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Enfermedad registrada. Catálogo funcional pendiente de definición"
            },


            cantidad_casos_activos: {
                bsonType:
                    "int",

                minimum:
                    0,

                description:
                    "Cantidad de casos activos de la enfermedad en la fecha del registro"
            },


            observaciones: {
                bsonType:
                    "string",

                description:
                    "Observaciones adicionales del registro epidemiológico"
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
                    "Referencia lógica al usuario responsable de la creación"
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

const existeCasosEnfermedades =
    db
        .getCollectionNames()
        .includes(
            "casos_enfermedades"
        );


if (
    !existeCasosEnfermedades
) {

    db.createCollection(
        "casos_enfermedades",
        {

            validator:
                validatorCasosEnfermedades,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );


    print(
        "✓ Colección creada: casos_enfermedades"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "casos_enfermedades",

            validator:
                validatorCasosEnfermedades,

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
            "de casos_enfermedades."
        );
    }


    print(
        "✓ Validador actualizado: casos_enfermedades"
    );
}


// ============================================================
// 5. CREAR ÍNDICES
// ============================================================
//
// Actualmente NO existe una regla funcional aprobada que
// indique que debe existir un único registro de enfermedad
// por albergue y fecha.
//
// Por esta razón los índices NO son únicos.
// ============================================================


// ------------------------------------------------------------
// 5.1 Consultas por albergue + fecha
// ------------------------------------------------------------

db.casos_enfermedades.createIndex(
    {
        albergue_id:
            1,

        fecha:
            -1
    },
    {
        name:
            "ix_casos_enfermedades_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_casos_enfermedades_albergue_fecha"
);


// ------------------------------------------------------------
// 5.2 Consultas por albergue + enfermedad + fecha
// ------------------------------------------------------------

db.casos_enfermedades.createIndex(
    {
        albergue_id:
            1,

        enfermedad:
            1,

        fecha:
            -1
    },
    {
        name:
            "ix_casos_enfermedades_albergue_enfermedad_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_casos_enfermedades_albergue_enfermedad_fecha"
);


// ============================================================
// 6. CONTROL DE REFERENCIAS LÓGICAS EXISTENTES
// ============================================================
//
// Permite validar integridad aunque la colección ya existiera
// antes de ejecutar la migración.
// ============================================================


// ------------------------------------------------------------
// 6.1 albergue_id → albergues._id
// ------------------------------------------------------------

const casosAlbergueHuerfanos =
    db.casos_enfermedades.aggregate([

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
                    1,

                enfermedad:
                    1
            }
        }

    ]).toArray();


if (
    casosAlbergueHuerfanos.length > 0
) {

    printjson(
        casosAlbergueHuerfanos
    );

    throw new Error(
        "Existen casos de enfermedades asociados " +
        "a albergues inexistentes."
    );
}


print(
    "✓ Sin referencias huérfanas en albergue_id."
);


// ------------------------------------------------------------
// 6.2 registrado_por → usuarios._id
// ------------------------------------------------------------

const casosUsuarioCreadorHuerfano =
    db.casos_enfermedades.aggregate([

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
                    1,

                enfermedad:
                    1
            }
        }

    ]).toArray();


if (
    casosUsuarioCreadorHuerfano.length > 0
) {

    printjson(
        casosUsuarioCreadorHuerfano
    );

    throw new Error(
        "Existen casos de enfermedades con " +
        "registrado_por inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en registrado_por."
);


// ------------------------------------------------------------
// 6.3 updated_by → usuarios._id
// ------------------------------------------------------------

const casosUpdatedByHuerfano =
    db.casos_enfermedades.aggregate([

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
                    1,

                enfermedad:
                    1
            }
        }

    ]).toArray();


if (
    casosUpdatedByHuerfano.length > 0
) {

    printjson(
        casosUpdatedByHuerfano
    );

    throw new Error(
        "Existen casos de enfermedades con " +
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
                "Crear colección casos_enfermedades, validator e índices",

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
        "La migración 006 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 9. VERIFICAR ÍNDICES
// ============================================================

const indicesCasosEnfermedades =
    db.casos_enfermedades
        .getIndexes();


const indiceAlbergueFecha =
    indicesCasosEnfermedades.filter(
        function (indice) {

            return (
                indice.name ===
                "ix_casos_enfermedades_albergue_fecha"
            );
        }
    );


if (
    indiceAlbergueFecha.length !== 1
) {

    throw new Error(
        "No fue posible verificar el índice " +
        "ix_casos_enfermedades_albergue_fecha."
    );
}


print(
    "✓ Índice albergue + fecha confirmado."
);


const indiceAlbergueEnfermedadFecha =
    indicesCasosEnfermedades.filter(
        function (indice) {

            return (
                indice.name ===
                "ix_casos_enfermedades_albergue_enfermedad_fecha"
            );
        }
    );


if (
    indiceAlbergueEnfermedadFecha.length !== 1
) {

    throw new Error(
        "No fue posible verificar el índice " +
        "ix_casos_enfermedades_albergue_enfermedad_fecha."
    );
}


print(
    "✓ Índice albergue + enfermedad + fecha confirmado."
);


// ============================================================
// 10. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" MIGRACIÓN 006 FINALIZADA");
print("====================================================");

print(
    "✓ Colección casos_enfermedades disponible"
);

print(
    "✓ Validator $jsonSchema strict"
);

print(
    "✓ cantidad_casos_activos >= 0"
);

print(
    "✓ Índice albergue + fecha"
);

print(
    "✓ Índice albergue + enfermedad + fecha"
);

print(
    "✓ Controles de referencias lógicas"
);

print(
    "✓ Migración registrada"
);

print("");