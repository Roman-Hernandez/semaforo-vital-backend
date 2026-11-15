// ============================================================
// SEMÁFORO VITAL
// Migración:
//   008_create_metricas_albergue
//
// Responsabilidad DBA:
//   - crear la colección metricas_albergue
//   - implementar Bucket Pattern
//   - implementar Computed Pattern
//   - establecer $jsonSchema
//   - configurar validación strict
//   - crear índice único por albergue + fecha_bucket
//   - controlar referencias lógicas existentes
//   - registrar la migración en schema_migrations
//
// MODELO:
//
// Un documento representa:
//
//   1 albergue
//   +
//   1 día operativo
//
// y agrupa todas las mediciones intradía de ese período.
//
// IMPORTANTE:
//
// registros_diarios
//     → consolidado oficial diario
//
// metricas_albergue.mediciones
//     → telemetría intradía
//
// metricas_albergue.calculados
//     → valores precalculados del bucket
//
// metricas_albergue.ultima_medicion
//     → última lectura disponible
//
// metricas_albergue.estado_actual
//     → snapshot persistente del estado calculado
//
// estado_actual se mantiene opcional en esta migración porque
// las colecciones alertas y estados_semaforo todavía no han
// sido incorporadas.
//
// Sus referencias ObjectId se validarán estructuralmente ahora
// y referencialmente cuando existan dichas colecciones.
//
// La aplicación será responsable de mantener consistencia entre:
//
//   mediciones
//   calculados
//   ultima_medicion
//   estado_actual
//
// $jsonSchema valida estructura y tipos, pero no puede validar
// por sí solo que:
//
//   cantidad_mediciones == mediciones.length
//   suma_ph == suma real del array
//   promedio_ph == promedio real
//   ultima_medicion == último elemento temporal
//
// Estas reglas forman parte del contrato de actualización.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

const MIGRATION_VERSION =
    "008_create_metricas_albergue";


print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 008");
print(" MÉTRICAS DE ALBERGUE");
print(" BUCKET PATTERN + COMPUTED PATTERN");
print("====================================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES REQUERIDAS
// ============================================================

const coleccionesRequeridas = [
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
            "007_create_intervenciones"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 007_create_intervenciones " +
        "debe estar aplicada exactamente una vez antes " +
        "de ejecutar la 008."
    );
}


print(
    "✓ Migración 007 verificada."
);


// ============================================================
// 3. DEFINIR VALIDADOR
// ============================================================

const validatorMetricasAlbergue = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de métricas de albergue",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha_bucket",
            "mediciones",
            "calculados",
            "ultima_medicion",
            "created_at",
            "updated_at"
        ],

        properties: {

            // =================================================
            // IDENTIFICACIÓN DEL BUCKET
            // =================================================

            _id: {

                bsonType:
                    "objectId",

                description:
                    "Identificador único del bucket"
            },


            albergue_id: {

                bsonType:
                    "objectId",

                description:
                    "Referencia lógica a albergues._id"
            },


            fecha_bucket: {

                bsonType:
                    "date",

                description:
                    "Fecha operativa del bucket normalizada según America/Bogota"
            },


            // =================================================
            // BUCKET PATTERN
            // =================================================

            mediciones: {

                bsonType:
                    "array",

                minItems:
                    1,

                description:
                    "Mediciones intradía agrupadas dentro del bucket",

                items: {

                    bsonType:
                        "object",

                    additionalProperties:
                        false,

                    required: [
                        "fecha_hora",
                        "ph",
                        "cloro_residual",
                        "personas_alojadas",
                        "porcentaje_ocupacion"
                    ],

                    properties: {

                        fecha_hora: {

                            bsonType:
                                "date",

                            description:
                                "Fecha y hora real de la medición"
                        },


                        ph: {

                            bsonType: [
                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0,

                            description:
                                "Medición de pH"
                        },


                        cloro_residual: {

                            bsonType: [
                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0,

                            description:
                                "Medición de cloro residual"
                        },


                        personas_alojadas: {

                            bsonType:
                                "int",

                            minimum:
                                0,

                            description:
                                "Cantidad de personas alojadas al momento de la medición"
                        },


                        porcentaje_ocupacion: {

                            bsonType: [
                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0,

                            description:
                                "Porcentaje de ocupación calculado al momento de la medición. Puede superar 100 en situaciones de sobreocupación"
                        }
                    }
                }
            },


            // =================================================
            // COMPUTED PATTERN
            // =================================================

            calculados: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "cantidad_mediciones",
                    "suma_ph",
                    "suma_cloro_residual",
                    "promedio_ph",
                    "promedio_cloro_residual",
                    "porcentaje_ocupacion"
                ],

                description:
                    "Valores precalculados del bucket para evitar agregaciones repetitivas",

                properties: {

                    cantidad_mediciones: {

                        bsonType:
                            "int",

                        minimum:
                            1,

                        description:
                            "Cantidad de elementos contenidos en mediciones"
                    },


                    suma_ph: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        description:
                            "Suma precalculada de las mediciones de pH"
                    },


                    suma_cloro_residual: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        description:
                            "Suma precalculada de las mediciones de cloro residual"
                    },


                    promedio_ph: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        description:
                            "Promedio precalculado de pH"
                    },


                    promedio_cloro_residual: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        description:
                            "Promedio precalculado de cloro residual"
                    },


                    porcentaje_ocupacion: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        description:
                            "Porcentaje de ocupación precalculado para consulta rápida"
                    }
                }
            },


            // =================================================
            // ÚLTIMA MEDICIÓN
            // =================================================

            ultima_medicion: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "fecha_hora",
                    "ph",
                    "cloro_residual",
                    "personas_alojadas",
                    "porcentaje_ocupacion"
                ],

                description:
                    "Snapshot de la última medición disponible dentro del bucket",

                properties: {

                    fecha_hora: {

                        bsonType:
                            "date"
                    },


                    ph: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },


                    cloro_residual: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },


                    personas_alojadas: {

                        bsonType:
                            "int",

                        minimum:
                            0
                    },


                    porcentaje_ocupacion: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    }
                }
            },


            // =================================================
            // SNAPSHOT PERSISTENTE DEL ESTADO ACTUAL
            // =================================================
            //
            // Es opcional durante esta etapa.
            //
            // Posteriormente será alimentado con información
            // derivada de:
            //
            //   - estados_semaforo
            //   - alertas
            //
            // MongoDB valida aquí la estructura futura, pero
            // las referencias lógicas serán verificadas cuando
            // existan dichas colecciones.
            // =================================================

            estado_actual: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "agua",
                    "hacinamiento",
                    "semaforo_vital",
                    "alertas_activas"
                ],

                properties: {

                    agua: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [
                            "nivel"
                        ],

                        properties: {

                            nivel: {

                                bsonType:
                                    "string",

                                minLength:
                                    1,

                                description:
                                    "Nivel calculado del componente agua"
                            }
                        }
                    },


                    hacinamiento: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [
                            "nivel"
                        ],

                        properties: {

                            nivel: {

                                bsonType:
                                    "string",

                                minLength:
                                    1,

                                description:
                                    "Nivel calculado del componente hacinamiento"
                            }
                        }
                    },


                    semaforo_vital: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [
                            "nivel",
                            "codigo",
                            "estado_semaforo_id",
                            "fecha_calculo"
                        ],

                        properties: {

                            nivel: {

                                bsonType:
                                    "string",

                                minLength:
                                    1,

                                description:
                                    "Nivel vigente del Semáforo Vital"
                            },


                            codigo: {

                                bsonType:
                                    "int",

                                description:
                                    "Código funcional asociado al nivel calculado"
                            },


                            estado_semaforo_id: {

                                bsonType:
                                    "objectId",

                                description:
                                    "Referencia lógica futura hacia estados_semaforo._id"
                            },


                            fecha_calculo: {

                                bsonType:
                                    "date",

                                description:
                                    "Fecha y hora del cálculo del estado"
                            }
                        }
                    },


                    alertas_activas: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [
                            "cantidad",
                            "ids"
                        ],

                        properties: {

                            cantidad: {

                                bsonType:
                                    "int",

                                minimum:
                                    0,

                                description:
                                    "Cantidad de alertas activas reflejadas en el snapshot"
                            },


                            ids: {

                                bsonType:
                                    "array",

                                uniqueItems:
                                    true,

                                items: {

                                    bsonType:
                                        "objectId"
                                },

                                description:
                                    "Referencias lógicas futuras hacia alertas._id"
                            }
                        }
                    }
                }
            },


            // =================================================
            // TRAZABILIDAD TÉCNICA
            // =================================================

            created_at: {

                bsonType:
                    "date",

                description:
                    "Fecha y hora técnica de creación del bucket"
            },


            updated_at: {

                bsonType:
                    "date",

                description:
                    "Fecha y hora de la última actualización del bucket"
            }
        }
    }
};


// ============================================================
// 4. CREAR O ACTUALIZAR COLECCIÓN
// ============================================================

const existeMetricasAlbergue =
    db
        .getCollectionNames()
        .includes(
            "metricas_albergue"
        );


if (
    !existeMetricasAlbergue
) {

    db.createCollection(
        "metricas_albergue",
        {

            validator:
                validatorMetricasAlbergue,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );


    print(
        "✓ Colección creada: metricas_albergue"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "metricas_albergue",

            validator:
                validatorMetricasAlbergue,

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
            "de metricas_albergue."
        );
    }


    print(
        "✓ Validador actualizado: metricas_albergue"
    );
}


// ============================================================
// 5. VERIFICAR DUPLICADOS ANTES DEL ÍNDICE ÚNICO
// ============================================================
//
// Regla del Bucket Pattern:
//
//   1 documento
//   por
//   albergue + fecha_bucket
//
// Si la colección hubiera existido previamente con datos
// duplicados, no se debe crear el índice sin resolver primero
// la inconsistencia.
// ============================================================

const bucketsDuplicados =
    db.metricas_albergue.aggregate([

        {
            $group: {

                _id: {

                    albergue_id:
                        "$albergue_id",

                    fecha_bucket:
                        "$fecha_bucket"
                },

                cantidad: {
                    $sum:
                        1
                },

                ids: {
                    $push:
                        "$_id"
                }
            }
        },

        {
            $match: {

                cantidad: {
                    $gt:
                        1
                }
            }
        }

    ]).toArray();


if (
    bucketsDuplicados.length > 0
) {

    print("");
    print(
        "Se detectaron buckets duplicados:"
    );

    printjson(
        bucketsDuplicados
    );


    throw new Error(
        "No es posible crear el índice único. " +
        "Existen múltiples documentos para el mismo " +
        "albergue_id + fecha_bucket."
    );
}


print(
    "✓ Sin buckets duplicados por albergue + fecha_bucket."
);


// ============================================================
// 6. CREAR ÍNDICE ÚNICO DEL BUCKET
// ============================================================

db.metricas_albergue.createIndex(
    {
        albergue_id:
            1,

        fecha_bucket:
            1
    },
    {
        name:
            "ux_metricas_albergue_albergue_fecha_bucket",

        unique:
            true
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ux_metricas_albergue_albergue_fecha_bucket"
);


// ============================================================
// 7. CONTROL DE REFERENCIAS LÓGICAS EXISTENTES
// ============================================================
//
// Actualmente la única referencia exigible es:
//
//   metricas_albergue.albergue_id
//       → albergues._id
//
// Las referencias dentro de estado_actual hacia:
//
//   estados_semaforo
//   alertas
//
// se controlarán cuando esas colecciones sean creadas.
// ============================================================

const metricasAlbergueHuerfanas =
    db.metricas_albergue.aggregate([

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

                fecha_bucket:
                    1
            }
        }

    ]).toArray();


if (
    metricasAlbergueHuerfanas.length > 0
) {

    print("");
    print(
        "Se detectaron referencias huérfanas:"
    );

    printjson(
        metricasAlbergueHuerfanas
    );


    throw new Error(
        "Existen buckets de metricas_albergue " +
        "asociados a albergues inexistentes."
    );
}


print(
    "✓ Sin referencias huérfanas en albergue_id."
);


// ============================================================
// 8. REGISTRAR MIGRACIÓN
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
                "Crear metricas_albergue con Bucket Pattern y Computed Pattern",

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
// 9. VERIFICAR REGISTRO ÚNICO DE MIGRACIÓN
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
        "La migración 008 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 10. VERIFICAR ÍNDICE
// ============================================================

const indicesMetricasAlbergue =
    db.metricas_albergue
        .getIndexes();


const indiceBucket =
    indicesMetricasAlbergue.find(
        function (indice) {

            return (
                indice.name ===
                "ux_metricas_albergue_albergue_fecha_bucket"
            );
        }
    );


if (
    !indiceBucket
) {

    throw new Error(
        "No fue posible verificar el índice " +
        "ux_metricas_albergue_albergue_fecha_bucket."
    );
}


if (
    indiceBucket.unique !== true
) {

    throw new Error(
        "El índice del bucket existe pero no es UNIQUE."
    );
}


print(
    "✓ Índice único del Bucket Pattern confirmado."
);


// ============================================================
// 11. VERIFICAR DEFINICIÓN DEL ÍNDICE
// ============================================================

if (
    indiceBucket.key.albergue_id !== 1 ||
    indiceBucket.key.fecha_bucket !== 1
) {

    throw new Error(
        "El índice del bucket no tiene la definición esperada."
    );
}


print(
    "✓ Definición del índice del bucket confirmada."
);


// ============================================================
// 12. INFORMACIÓN DEL MODELO
// ============================================================

print("");
print("----------------------------------------------------");
print(" MODELO IMPLEMENTADO");
print("----------------------------------------------------");

print(
    "Bucket Pattern:"
);

print(
    "  1 documento = 1 albergue + 1 fecha_bucket"
);

print("");

print(
    "Computed Pattern:"
);

print(
    "  calculados.cantidad_mediciones"
);

print(
    "  calculados.suma_ph"
);

print(
    "  calculados.suma_cloro_residual"
);

print(
    "  calculados.promedio_ph"
);

print(
    "  calculados.promedio_cloro_residual"
);

print(
    "  calculados.porcentaje_ocupacion"
);

print("");

print(
    "Snapshot:"
);

print(
    "  ultima_medicion"
);

print(
    "  estado_actual (opcional en esta etapa)"
);


// ============================================================
// 13. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" MIGRACIÓN 008 FINALIZADA");
print("====================================================");

print(
    "✓ Colección metricas_albergue disponible"
);

print(
    "✓ Bucket Pattern implementado"
);

print(
    "✓ Computed Pattern implementado"
);

print(
    "✓ mediciones intradía"
);

print(
    "✓ calculados precalculados"
);

print(
    "✓ ultima_medicion"
);

print(
    "✓ estado_actual preparado para integración futura"
);

print(
    "✓ Validator $jsonSchema strict"
);

print(
    "✓ Índice único albergue + fecha_bucket"
);

print(
    "✓ Control de referencias hacia albergues"
);

print(
    "✓ Migración registrada"
);

print("");