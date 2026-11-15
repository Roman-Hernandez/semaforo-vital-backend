// ============================================================
// SEMÁFORO VITAL
// Migración:
//   014_create_escenarios
//
// PROPÓSITO:
//
// Crear la colección escenarios para persistir hipótesis
// sanitarias e intervenciones simuladas asociadas a un
// albergue.
//
// REQUISITOS RELACIONADOS:
//
// RF-50 Consulta de escenarios
// RF-53 Creación de escenarios
// RF-54 Simulación de intervenciones
// RF-55 Comparación de escenarios
// RF-56 Priorización de intervenciones
// RF-61 Trazabilidad
//
// ARQUITECTURA:
//
// intervenciones
//     → acciones REALES ejecutadas
//
// escenarios.intervenciones_simuladas
//     → acciones HIPOTÉTICAS
//
// analisis_ia.escenario_id
//     → escenarios._id
//
// predicciones_sir.escenario_id
//     → escenarios._id
//
// IMPORTANTE:
//
// escenarios conserva la definición de una hipótesis.
//
// Una vez utilizada por una ejecución IA o SIR, la hipótesis
// debe permanecer reproducible.
//
// Por ello se trata como información histórica / append-only.
//
// NO se utilizan:
//
//   updated_at
//   updated_by
//
// para modificar una simulación histórica.
//
// MongoDB NO:
//
// - ejecuta modelos IA;
// - ejecuta el modelo SIR;
// - calcula el nivel de riesgo;
// - prioriza intervenciones;
// - compara gráficas.
//
// MongoDB persiste, valida estructura y conserva trazabilidad.
// ============================================================


db = db.getSiblingDB("semaforo_vital");


const MIGRATION_VERSION =
    "014_create_escenarios";


print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 014");
print(" ESCENARIOS HIPOTÉTICOS");
print("====================================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES REQUERIDAS
// ============================================================

const coleccionesRequeridas = [

    "usuarios",
    "albergues",
    "registros_diarios",
    "historial_poblacion",
    "condiciones_sanitarias",
    "casos_enfermedades",
    "metricas_albergue",
    "analisis_ia",
    "predicciones_sir",
    "estados_semaforo",
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
            "013_create_estados_semaforo"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 013_create_estados_semaforo debe " +
        "estar aplicada exactamente una vez antes de " +
        "ejecutar la migración 014."
    );
}


print(
    "✓ Migración 013 verificada."
);


// ============================================================
// 3. DEFINIR VALIDADOR
// ============================================================

const validatorEscenarios = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de escenarios",

        additionalProperties:
            false,

        required: [

            "albergue_id",
            "nombre",
            "datos_base",
            "condiciones_simuladas",
            "intervenciones_simuladas",
            "registrado_por",
            "created_at"
        ],

        properties: {

            // =================================================
            // IDENTIFICACIÓN
            // =================================================

            _id: {

                bsonType:
                    "objectId",

                description:
                    "Identificador técnico del escenario"
            },


            albergue_id: {

                bsonType:
                    "objectId",

                description:
                    "Referencia lógica hacia albergues._id"
            },


            nombre: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Nombre funcional del escenario hipotético"
            },


            descripcion: {

                bsonType:
                    "string",

                description:
                    "Descripción opcional del objetivo de la simulación"
            },


            // =================================================
            // DATOS REALES UTILIZADOS COMO BASE
            // =================================================
            //
            // Todos los arrays son obligatorios para mantener
            // un contrato estable.
            //
            // Pueden estar vacíos porque un escenario no
            // necesariamente utiliza todas las fuentes.
            //
            // uniqueItems evita repetir referencias dentro del
            // mismo escenario.
            //
            // =================================================

            datos_base: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [

                    "registros_diarios_ids",
                    "historial_poblacion_ids",
                    "condiciones_sanitarias_ids",
                    "casos_enfermedades_ids",
                    "metricas_albergue_ids",
                    "estados_semaforo_ids"
                ],

                properties: {

                    registros_diarios_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        },

                        description:
                            "Registros diarios reales utilizados como referencia"
                    },


                    historial_poblacion_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        },

                        description:
                            "Registros oficiales de población utilizados"
                    },


                    condiciones_sanitarias_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        },

                        description:
                            "Condiciones sanitarias reales utilizadas como base"
                    },


                    casos_enfermedades_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        },

                        description:
                            "Registros epidemiológicos reales utilizados"
                    },


                    metricas_albergue_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        },

                        description:
                            "Buckets de métricas utilizados como referencia"
                    },


                    estados_semaforo_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        },

                        description:
                            "Estados históricos del Semáforo Vital utilizados como referencia"
                    }
                }
            },


            // =================================================
            // CONDICIONES HIPOTÉTICAS
            // =================================================
            //
            // Se conservan las variables sanitarias ya
            // existentes y se permiten variables específicas
            // requeridas para escenarios como letrinas.
            //
            // letrinas y litros_agua son opcionales porque no
            // todos los escenarios deben modificar esas
            // variables.
            //
            // No se establecen enums artificiales para:
            //
            // estado_higiene
            // estado_saneamiento
            //
            // porque sus catálogos funcionales siguen
            // pendientes.
            //
            // =================================================

            condiciones_simuladas: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [

                    "agua_potable_disponible",
                    "banos_disponibles",
                    "estado_higiene",
                    "estado_saneamiento",
                    "otros_recursos_sanitarios"
                ],

                properties: {

                    agua_potable_disponible: {

                        bsonType:
                            "bool",

                        description:
                            "Disponibilidad hipotética de agua potable"
                    },


                    banos_disponibles: {

                        bsonType:
                            "int",

                        minimum:
                            0,

                        description:
                            "Cantidad hipotética de baños disponibles"
                    },


                    letrinas: {

                        bsonType:
                            "int",

                        minimum:
                            0,

                        description:
                            "Cantidad hipotética de letrinas"
                    },


                    litros_agua: {

                        bsonType: [

                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        description:
                            "Cantidad hipotética de agua disponible cuando aplique al escenario"
                    },


                    estado_higiene: {

                        bsonType:
                            "string",

                        minLength:
                            1,

                        description:
                            "Estado hipotético de higiene. Catálogo funcional pendiente"
                    },


                    estado_saneamiento: {

                        bsonType:
                            "string",

                        minLength:
                            1,

                        description:
                            "Estado hipotético de saneamiento. Catálogo funcional pendiente"
                    },


                    otros_recursos_sanitarios: {

                        bsonType:
                            "array",

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
                                        1
                                },


                                cantidad: {

                                    bsonType:
                                        "int",

                                    minimum:
                                        0
                                },


                                observacion: {

                                    bsonType:
                                        "string"
                                }
                            }
                        },

                        description:
                            "Otros recursos sanitarios hipotéticos"
                    }
                }
            },


            // =================================================
            // INTERVENCIONES SIMULADAS
            // =================================================
            //
            // Estas intervenciones NO representan acciones
            // ejecutadas.
            //
            // Las intervenciones reales continúan en:
            //
            // intervenciones
            //
            // =================================================

            intervenciones_simuladas: {

                bsonType:
                    "array",

                items: {

                    bsonType:
                        "object",

                    additionalProperties:
                        false,

                    required: [

                        "tipo_intervencion",
                        "descripcion"
                    ],

                    properties: {

                        tipo_intervencion: {

                            bsonType:
                                "string",

                            minLength:
                                1,

                            description:
                                "Tipo de intervención hipotética. Catálogo funcional pendiente"
                        },


                        descripcion: {

                            bsonType:
                                "string",

                            minLength:
                                1,

                            description:
                                "Descripción de la acción simulada"
                        },


                        observaciones: {

                            bsonType:
                                "string",

                            description:
                                "Observaciones opcionales sobre la intervención simulada"
                        }
                    }
                }
            },


            // =================================================
            // TRAZABILIDAD
            // =================================================

            registrado_por: {

                bsonType:
                    "objectId",

                description:
                    "Usuario responsable de crear el escenario"
            },


            created_at: {

                bsonType:
                    "date",

                description:
                    "Fecha técnica de creación del escenario"
            }
        }
    }
};


// ============================================================
// 4. CREAR O ACTUALIZAR COLECCIÓN
// ============================================================

const existeEscenarios =
    db
        .getCollectionNames()
        .includes(
            "escenarios"
        );


if (
    !existeEscenarios
) {

    db.createCollection(

        "escenarios",

        {

            validator:
                validatorEscenarios,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );


    print(
        "✓ Colección creada: escenarios"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "escenarios",

            validator:
                validatorEscenarios,

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
            "de escenarios."
        );
    }


    print(
        "✓ Validador actualizado: escenarios"
    );
}


// ============================================================
// 5. CREAR ÍNDICES DE ESCENARIOS
// ============================================================
//
// No se utiliza UNIQUE.
//
// Pueden existir múltiples escenarios:
// - para el mismo albergue;
// - con el mismo nombre;
// - creados en el mismo instante.
//
// ============================================================

db.escenarios.createIndex(

    {

        albergue_id:
            1,

        created_at:
            -1
    },

    {

        name:
            "ix_escenarios_albergue_created_at"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_escenarios_albergue_created_at"
);


// ============================================================
// 6. ÍNDICES DE RESULTADOS POR ESCENARIO
// ============================================================
//
// escenario_id ya existía como campo opcional en:
//
// analisis_ia
// predicciones_sir
//
// Ahora se crean índices específicos para consultar todas las
// ejecuciones asociadas a una hipótesis.
//
// ============================================================


// ------------------------------------------------------------
// 6.1 analisis_ia
// ------------------------------------------------------------

db.analisis_ia.createIndex(

    {

        escenario_id:
            1,

        fecha_ejecucion:
            -1
    },

    {

        name:
            "ix_analisis_ia_escenario_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_analisis_ia_escenario_fecha"
);


// ------------------------------------------------------------
// 6.2 predicciones_sir
// ------------------------------------------------------------

db.predicciones_sir.createIndex(

    {

        escenario_id:
            1,

        fecha_ejecucion:
            -1
    },

    {

        name:
            "ix_predicciones_sir_escenario_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_predicciones_sir_escenario_fecha"
);


// ============================================================
// 7. REFERENCIA escenarios.albergue_id
// ============================================================

const escenariosConAlbergueHuerfano =
    db.escenarios.aggregate([

        {

            $lookup: {

                from:
                    "albergues",

                localField:
                    "albergue_id",

                foreignField:
                    "_id",

                as:
                    "albergue_ref"
            }
        },


        {

            $match: {

                "albergue_ref.0": {

                    $exists:
                        false
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                albergue_id:
                    1,

                nombre:
                    1
            }
        }

    ]).toArray();


if (
    escenariosConAlbergueHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron escenarios con albergue_id huérfano:"
    );


    printjson(
        escenariosConAlbergueHuerfano
    );


    throw new Error(
        "Existen escenarios asociados a albergues inexistentes."
    );
}


print(
    "✓ Sin referencias huérfanas en escenarios.albergue_id."
);


// ============================================================
// 8. REFERENCIA escenarios.registrado_por
// ============================================================

const escenariosConUsuarioHuerfano =
    db.escenarios.aggregate([

        {

            $lookup: {

                from:
                    "usuarios",

                localField:
                    "registrado_por",

                foreignField:
                    "_id",

                as:
                    "usuario_ref"
            }
        },


        {

            $match: {

                "usuario_ref.0": {

                    $exists:
                        false
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                registrado_por:
                    1,

                albergue_id:
                    1,

                nombre:
                    1
            }
        }

    ]).toArray();


if (
    escenariosConUsuarioHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron escenarios con registrado_por huérfano:"
    );


    printjson(
        escenariosConUsuarioHuerfano
    );


    throw new Error(
        "Existen escenarios con registrado_por inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en escenarios.registrado_por."
);


// ============================================================
// 9. FUNCIÓN DE REFERENCIAS EN ARRAYS
// ============================================================

function verificarReferenciasArrayEscenario(
    campo,
    coleccionDestino,
    etiqueta
) {

    const referenciasHuerfanas =
        db.escenarios.aggregate([

            {

                $unwind: {

                    path:
                        "$" + campo
                }
            },


            {

                $lookup: {

                    from:
                        coleccionDestino,

                    localField:
                        campo,

                    foreignField:
                        "_id",

                    as:
                        "referencia_encontrada"
                }
            },


            {

                $match: {

                    "referencia_encontrada.0": {

                        $exists:
                            false
                    }
                }
            },


            {

                $project: {

                    _id:
                        1,

                    albergue_id:
                        1,

                    nombre:
                        1,

                    referencia:
                        "$" + campo
                }
            }

        ]).toArray();


    if (
        referenciasHuerfanas.length > 0
    ) {

        print("");

        print(
            "Se detectaron referencias huérfanas en " +
            campo +
            ":"
        );


        printjson(
            referenciasHuerfanas
        );


        throw new Error(
            "Existen escenarios con referencias " +
            "inexistentes hacia " +
            coleccionDestino +
            "."
        );
    }


    print(
        "✓ Referencias " +
        etiqueta +
        " verificadas."
    );
}


// ============================================================
// 10. VERIFICAR REFERENCIAS DE datos_base
// ============================================================

verificarReferenciasArrayEscenario(

    "datos_base.registros_diarios_ids",

    "registros_diarios",

    "registros_diarios_ids"
);


verificarReferenciasArrayEscenario(

    "datos_base.historial_poblacion_ids",

    "historial_poblacion",

    "historial_poblacion_ids"
);


verificarReferenciasArrayEscenario(

    "datos_base.condiciones_sanitarias_ids",

    "condiciones_sanitarias",

    "condiciones_sanitarias_ids"
);


verificarReferenciasArrayEscenario(

    "datos_base.casos_enfermedades_ids",

    "casos_enfermedades",

    "casos_enfermedades_ids"
);


verificarReferenciasArrayEscenario(

    "datos_base.metricas_albergue_ids",

    "metricas_albergue",

    "metricas_albergue_ids"
);


verificarReferenciasArrayEscenario(

    "datos_base.estados_semaforo_ids",

    "estados_semaforo",

    "estados_semaforo_ids"
);


// ============================================================
// 11. FUNCIÓN DE COHERENCIA DE ALBERGUE
// ============================================================
//
// Toda fuente incluida en datos_base debe pertenecer al
// mismo albergue del escenario.
//
// ============================================================

function verificarCoherenciaAlbergueEscenario(
    campo,
    coleccionDestino,
    etiqueta
) {

    const referenciasOtroAlbergue =
        db.escenarios.aggregate([

            {

                $unwind: {

                    path:
                        "$" + campo
                }
            },


            {

                $lookup: {

                    from:
                        coleccionDestino,

                    localField:
                        campo,

                    foreignField:
                        "_id",

                    as:
                        "referencia_encontrada"
                }
            },


            {

                $unwind: {

                    path:
                        "$referencia_encontrada"
                }
            },


            {

                $match: {

                    $expr: {

                        $ne: [

                            "$albergue_id",

                            "$referencia_encontrada.albergue_id"
                        ]
                    }
                }
            },


            {

                $project: {

                    _id:
                        1,

                    nombre:
                        1,

                    albergue_id:
                        1,

                    referencia_id:
                        "$" + campo,

                    albergue_referencia:
                        "$referencia_encontrada.albergue_id"
                }
            }

        ]).toArray();


    if (
        referenciasOtroAlbergue.length > 0
    ) {

        print("");

        print(
            "Se detectaron referencias de otro albergue en " +
            campo +
            ":"
        );


        printjson(
            referenciasOtroAlbergue
        );


        throw new Error(
            "Existen escenarios cuya fuente " +
            etiqueta +
            " pertenece a otro albergue."
        );
    }


    print(
        "✓ Coherencia de albergue verificada: " +
        etiqueta
    );
}


// ============================================================
// 12. VERIFICAR COHERENCIA DE datos_base
// ============================================================

verificarCoherenciaAlbergueEscenario(

    "datos_base.registros_diarios_ids",

    "registros_diarios",

    "registros_diarios_ids"
);


verificarCoherenciaAlbergueEscenario(

    "datos_base.historial_poblacion_ids",

    "historial_poblacion",

    "historial_poblacion_ids"
);


verificarCoherenciaAlbergueEscenario(

    "datos_base.condiciones_sanitarias_ids",

    "condiciones_sanitarias",

    "condiciones_sanitarias_ids"
);


verificarCoherenciaAlbergueEscenario(

    "datos_base.casos_enfermedades_ids",

    "casos_enfermedades",

    "casos_enfermedades_ids"
);


verificarCoherenciaAlbergueEscenario(

    "datos_base.metricas_albergue_ids",

    "metricas_albergue",

    "metricas_albergue_ids"
);


verificarCoherenciaAlbergueEscenario(

    "datos_base.estados_semaforo_ids",

    "estados_semaforo",

    "estados_semaforo_ids"
);


// ============================================================
// 13. analisis_ia.escenario_id → escenarios._id
// ============================================================

const analisisEscenarioHuerfano =
    db.analisis_ia.aggregate([

        {

            $match: {

                escenario_id: {

                    $exists:
                        true
                }
            }
        },


        {

            $lookup: {

                from:
                    "escenarios",

                localField:
                    "escenario_id",

                foreignField:
                    "_id",

                as:
                    "escenario_ref"
            }
        },


        {

            $match: {

                "escenario_ref.0": {

                    $exists:
                        false
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                albergue_id:
                    1,

                escenario_id:
                    1
            }
        }

    ]).toArray();


if (
    analisisEscenarioHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron analisis_ia con escenario_id huérfano:"
    );


    printjson(
        analisisEscenarioHuerfano
    );


    throw new Error(
        "Existen documentos analisis_ia con " +
        "escenario_id inexistente."
    );
}


print(
    "✓ analisis_ia.escenario_id verificado."
);


// ============================================================
// 14. COHERENCIA analisis_ia ↔ escenario
// ============================================================

const analisisEscenarioOtroAlbergue =
    db.analisis_ia.aggregate([

        {

            $match: {

                escenario_id: {

                    $exists:
                        true
                }
            }
        },


        {

            $lookup: {

                from:
                    "escenarios",

                localField:
                    "escenario_id",

                foreignField:
                    "_id",

                as:
                    "escenario_ref"
            }
        },


        {

            $unwind: {

                path:
                    "$escenario_ref"
            }
        },


        {

            $match: {

                $expr: {

                    $ne: [

                        "$albergue_id",

                        "$escenario_ref.albergue_id"
                    ]
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                escenario_id:
                    1,

                albergue_id:
                    1,

                albergue_escenario:
                    "$escenario_ref.albergue_id"
            }
        }

    ]).toArray();


if (
    analisisEscenarioOtroAlbergue.length > 0
) {

    print("");

    print(
        "Se detectaron analisis_ia asociados a " +
        "escenarios de otro albergue:"
    );


    printjson(
        analisisEscenarioOtroAlbergue
    );


    throw new Error(
        "Existen documentos analisis_ia cuyo escenario " +
        "pertenece a otro albergue."
    );
}


print(
    "✓ Coherencia analisis_ia ↔ escenario verificada."
);


// ============================================================
// 15. predicciones_sir.escenario_id → escenarios._id
// ============================================================

const prediccionesEscenarioHuerfano =
    db.predicciones_sir.aggregate([

        {

            $match: {

                escenario_id: {

                    $exists:
                        true
                }
            }
        },


        {

            $lookup: {

                from:
                    "escenarios",

                localField:
                    "escenario_id",

                foreignField:
                    "_id",

                as:
                    "escenario_ref"
            }
        },


        {

            $match: {

                "escenario_ref.0": {

                    $exists:
                        false
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                albergue_id:
                    1,

                escenario_id:
                    1,

                enfermedad:
                    1
            }
        }

    ]).toArray();


if (
    prediccionesEscenarioHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron predicciones_sir con " +
        "escenario_id huérfano:"
    );


    printjson(
        prediccionesEscenarioHuerfano
    );


    throw new Error(
        "Existen documentos predicciones_sir con " +
        "escenario_id inexistente."
    );
}


print(
    "✓ predicciones_sir.escenario_id verificado."
);


// ============================================================
// 16. COHERENCIA predicciones_sir ↔ escenario
// ============================================================

const prediccionesEscenarioOtroAlbergue =
    db.predicciones_sir.aggregate([

        {

            $match: {

                escenario_id: {

                    $exists:
                        true
                }
            }
        },


        {

            $lookup: {

                from:
                    "escenarios",

                localField:
                    "escenario_id",

                foreignField:
                    "_id",

                as:
                    "escenario_ref"
            }
        },


        {

            $unwind: {

                path:
                    "$escenario_ref"
            }
        },


        {

            $match: {

                $expr: {

                    $ne: [

                        "$albergue_id",

                        "$escenario_ref.albergue_id"
                    ]
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                escenario_id:
                    1,

                albergue_id:
                    1,

                enfermedad:
                    1,

                albergue_escenario:
                    "$escenario_ref.albergue_id"
            }
        }

    ]).toArray();


if (
    prediccionesEscenarioOtroAlbergue.length > 0
) {

    print("");

    print(
        "Se detectaron predicciones_sir asociadas a " +
        "escenarios de otro albergue:"
    );


    printjson(
        prediccionesEscenarioOtroAlbergue
    );


    throw new Error(
        "Existen predicciones_sir cuyo escenario " +
        "pertenece a otro albergue."
    );
}


print(
    "✓ Coherencia predicciones_sir ↔ escenario verificada."
);


// ============================================================
// 17. DECISIONES DEL CONTRATO
// ============================================================
//
// escenarios
//     → almacena hipótesis.
//
// intervenciones
//     → continúa almacenando exclusivamente acciones reales.
//
// condiciones_simuladas
//     → representa el estado sanitario hipotético.
//
// intervenciones_simuladas
//     → representa cero o más acciones hipotéticas.
//
// datos_base
//     → conserva referencias hacia los documentos reales
//       utilizados para construir la hipótesis.
//
// escenario_id
//     → continúa opcional en analisis_ia y predicciones_sir.
//
//       ejecución sobre datos reales:
//           escenario_id ausente
//
//       ejecución hipotética:
//           escenario_id presente
//
// updated_at / updated_by
//     → NO forman parte de escenarios.
//
//       Una nueva hipótesis debe generar un nuevo escenario
//       cuando sea necesario preservar reproducibilidad.
//
// ============================================================

print(
    "✓ Escenarios separados de intervenciones reales."
);


print(
    "✓ datos_base conserva trazabilidad de fuentes."
);


print(
    "✓ intervenciones_simuladas permanece embebida."
);


print(
    "✓ escenario_id habilitado para IA y SIR."
);


print(
    "✓ Escenarios históricos no utilizan updated_at ni updated_by."
);


// ============================================================
// 18. REGLAS FUNCIONALES NO IMPLEMENTADAS EN MONGODB
// ============================================================
//
// MongoDB NO determina:
//
// - cómo cambia beta ante una intervención;
// - cómo cambia gamma;
// - cómo afecta higiene al riesgo;
// - cómo afecta agua potable al riesgo;
// - cuál intervención reduce más el riesgo;
// - cuál escenario debe priorizarse;
// - qué nivel de Semáforo resultaría;
// - cómo comparar gráficas;
// - qué intervención debe recomendarse.
//
// RF-53 a RF-56 definen el comportamiento funcional, pero no
// establecen fórmulas matemáticas ni pesos.
//
// Estas responsabilidades corresponden al Backend,
// componente IA y componente matemático.
//
// ============================================================

print(
    "✓ No se incorporan fórmulas funcionales no aprobadas."
);


// ============================================================
// 19. REGISTRAR MIGRACIÓN
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
                "Crear escenarios hipotéticos con condiciones e intervenciones simuladas y trazabilidad de fuentes",

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
// 20. VERIFICAR REGISTRO ÚNICO
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
        "La migración 014 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 21. VERIFICAR ÍNDICES
// ============================================================


// ------------------------------------------------------------
// 21.1 escenarios
// ------------------------------------------------------------

const indicesEscenarios =
    db.escenarios
        .getIndexes();


const indiceEscenariosAlbergueCreatedAt =
    indicesEscenarios.find(

        function (indice) {

            return (
                indice.name ===
                "ix_escenarios_albergue_created_at"
            );
        }
    );


if (
    !indiceEscenariosAlbergueCreatedAt
) {

    throw new Error(
        "No existe ix_escenarios_albergue_created_at."
    );
}


if (
    indiceEscenariosAlbergueCreatedAt.unique === true
) {

    throw new Error(
        "ix_escenarios_albergue_created_at " +
        "no debe ser UNIQUE."
    );
}


if (
    indiceEscenariosAlbergueCreatedAt.key.albergue_id !== 1 ||
    indiceEscenariosAlbergueCreatedAt.key.created_at !== -1
) {

    throw new Error(
        "La definición de ix_escenarios_albergue_created_at " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_escenarios_albergue_created_at confirmado."
);


// ------------------------------------------------------------
// 21.2 analisis_ia
// ------------------------------------------------------------

const indicesAnalisisIA =
    db.analisis_ia
        .getIndexes();


const indiceAnalisisEscenarioFecha =
    indicesAnalisisIA.find(

        function (indice) {

            return (
                indice.name ===
                "ix_analisis_ia_escenario_fecha"
            );
        }
    );


if (
    !indiceAnalisisEscenarioFecha
) {

    throw new Error(
        "No existe ix_analisis_ia_escenario_fecha."
    );
}


if (
    indiceAnalisisEscenarioFecha.unique === true
) {

    throw new Error(
        "ix_analisis_ia_escenario_fecha no debe ser UNIQUE."
    );
}


if (
    indiceAnalisisEscenarioFecha.key.escenario_id !== 1 ||
    indiceAnalisisEscenarioFecha.key.fecha_ejecucion !== -1
) {

    throw new Error(
        "La definición de ix_analisis_ia_escenario_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_analisis_ia_escenario_fecha confirmado."
);


// ------------------------------------------------------------
// 21.3 predicciones_sir
// ------------------------------------------------------------

const indicesPrediccionesSir =
    db.predicciones_sir
        .getIndexes();


const indicePrediccionesEscenarioFecha =
    indicesPrediccionesSir.find(

        function (indice) {

            return (
                indice.name ===
                "ix_predicciones_sir_escenario_fecha"
            );
        }
    );


if (
    !indicePrediccionesEscenarioFecha
) {

    throw new Error(
        "No existe ix_predicciones_sir_escenario_fecha."
    );
}


if (
    indicePrediccionesEscenarioFecha.unique === true
) {

    throw new Error(
        "ix_predicciones_sir_escenario_fecha " +
        "no debe ser UNIQUE."
    );
}


if (
    indicePrediccionesEscenarioFecha.key.escenario_id !== 1 ||
    indicePrediccionesEscenarioFecha.key.fecha_ejecucion !== -1
) {

    throw new Error(
        "La definición de " +
        "ix_predicciones_sir_escenario_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_predicciones_sir_escenario_fecha confirmado."
);


// ============================================================
// 22. VERIFICAR VALIDACIÓN STRICT
// ============================================================

const infoColeccion =
    db
        .getCollectionInfos({

            name:
                "escenarios"
        })[0];


if (
    !infoColeccion
) {

    throw new Error(
        "No fue posible consultar la colección escenarios."
    );
}


if (
    infoColeccion.options.validationLevel !== "strict"
) {

    throw new Error(
        "escenarios debe utilizar validationLevel strict."
    );
}


if (
    infoColeccion.options.validationAction !== "error"
) {

    throw new Error(
        "escenarios debe utilizar validationAction error."
    );
}


print(
    "✓ Validación strict/error confirmada."
);


// ============================================================
// 23. CONTRATO IMPLEMENTADO
// ============================================================

print("");
print("----------------------------------------------------");
print(" CONTRATO IMPLEMENTADO");
print("----------------------------------------------------");

print(
    "✓ Escenarios hipotéticos por albergue"
);

print(
    "✓ Condiciones sanitarias simuladas"
);

print(
    "✓ Intervenciones simuladas embebidas"
);

print(
    "✓ Datos reales utilizados como base"
);

print(
    "✓ Trazabilidad de usuario y fecha"
);

print(
    "✓ Referencias lógicas verificadas"
);

print(
    "✓ Coherencia de albergue verificada"
);

print(
    "✓ Integración con analisis_ia"
);

print(
    "✓ Integración con predicciones_sir"
);

print(
    "✓ Colección append-only"
);


// ============================================================
// 24. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" MIGRACIÓN 014 FINALIZADA");
print("====================================================");

print(
    "✓ Colección escenarios disponible"
);

print(
    "✓ Validator $jsonSchema strict"
);

print(
    "✓ Índice escenarios por albergue y creación"
);

print(
    "✓ Índice IA por escenario"
);

print(
    "✓ Índice SIR por escenario"
);

print(
    "✓ Referencias datos_base controladas"
);

print(
    "✓ Coherencia de albergue controlada"
);

print(
    "✓ escenario_id activado como referencia lógica"
);

print(
    "✓ Intervenciones reales y simuladas separadas"
);

print(
    "✓ Migración registrada"
);

print("");