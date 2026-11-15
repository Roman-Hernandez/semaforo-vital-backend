// ============================================================
// SEMÁFORO VITAL
// Migración:
//   013_create_estados_semaforo
//
// Colección histórica oficial de estados del Semáforo Vital.
//
// PROPÓSITO:
//
// Conservar cada cálculo histórico del nivel de riesgo de un
// albergue y mantener trazabilidad hacia los datos utilizados
// para determinar dicho estado.
//
// ARQUITECTURA:
//
// estados_semaforo
//     → fuente histórica oficial
//
// metricas_albergue.estado_actual.semaforo_vital
//     → snapshot persistente del último estado
//
// Redis
//     → caché temporal futura
//
// REQUISITOS RELACIONADOS:
//
// RF-06  Consulta pública del Semáforo Vital
// RF-21  Consulta del Semáforo Vital del albergue
// RF-36  Clasificación del riesgo
// RF-37  Actualización del Semáforo Vital
// RF-38  Relación alertas / Semáforo Vital
//
// IMPORTANTE:
//
// estados_semaforo es una colección histórica.
//
// Cada nuevo cálculo debe producir un documento nuevo.
//
// NO se utilizan:
//
//   updated_at
//   updated_by
//
// para representar un nuevo cálculo.
//
// El cálculo funcional del nivel corresponde a Backend y a los
// componentes analíticos.
//
// MongoDB únicamente persiste y valida el contrato.
//
// ============================================================

db = db.getSiblingDB("semaforo_vital");


const MIGRATION_VERSION =
    "013_create_estados_semaforo";


print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 013");
print(" ESTADOS DEL SEMÁFORO VITAL");
print("====================================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES REQUERIDAS
// ============================================================
//
// La clasificación de riesgo puede utilizar:
//
// condiciones_sanitarias
// casos_enfermedades
// alertas
// analisis_ia
// predicciones_sir
// metricas_albergue
//
// Además requiere:
//
// usuarios
// albergues
// schema_migrations
//
// ============================================================

const coleccionesRequeridas = [

    "usuarios",
    "albergues",
    "condiciones_sanitarias",
    "casos_enfermedades",
    "alertas",
    "analisis_ia",
    "predicciones_sir",
    "metricas_albergue",
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
//
// La migración inmediatamente anterior es:
//
//   012_create_alertas
//
// Debe encontrarse registrada exactamente una vez.
//
// ============================================================

const migracionAnterior =
    db.schema_migrations.countDocuments({

        version:
            "012_create_alertas"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 012_create_alertas debe estar " +
        "aplicada exactamente una vez antes de ejecutar " +
        "la migración 013."
    );
}


print(
    "✓ Migración 012 verificada."
);


// ============================================================
// 3. VALIDADOR
// ============================================================

const validatorEstadosSemaforo = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de estados_semaforo",

        additionalProperties:
            false,

        required: [

            "albergue_id",
            "fecha_calculo",
            "nivel",
            "codigo",
            "datos_origen",
            "registrado_por",
            "created_at"
        ],

        properties: {

            // =================================================
            // IDENTIFICACIÓN
            // =================================================

            _id: {

                bsonType:
                    "objectId"
            },


            albergue_id: {

                bsonType:
                    "objectId",

                description:
                    "Referencia lógica hacia albergues._id"
            },


            // =================================================
            // RESULTADO DEL CÁLCULO
            // =================================================

            fecha_calculo: {

                bsonType:
                    "date",

                description:
                    "Momento funcional en el que fue calculado el estado"
            },


            nivel: {

                bsonType:
                    "string",

                enum: [

                    "verde",
                    "amarillo",
                    "rojo"
                ],

                description:
                    "Nivel oficial del Semáforo Vital"
            },


            codigo: {

                bsonType:
                    "int",

                description:
                    "Código numérico asociado al estado. La correspondencia oficial aún no se encuentra definida."
            },


            // =================================================
            // TRAZABILIDAD DE DATOS DE ORIGEN
            // =================================================
            //
            // El objeto datos_origen es obligatorio.
            //
            // Todos los arrays también son obligatorios para
            // mantener un contrato estable.
            //
            // Los arrays pueden estar vacíos porque todavía no
            // existe una definición funcional que determine una
            // cantidad mínima obligatoria de fuentes por cálculo.
            //
            // Todos utilizan uniqueItems para evitar repetir la
            // misma referencia dentro de una ejecución.
            //
            // =================================================

            datos_origen: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [

                    "condiciones_sanitarias_ids",
                    "casos_enfermedades_ids",
                    "alertas_ids",
                    "analisis_ia_ids",
                    "predicciones_sir_ids",
                    "metricas_albergue_ids"
                ],

                properties: {

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
                            "Condiciones sanitarias utilizadas para el cálculo"
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
                            "Registros epidemiológicos utilizados para el cálculo"
                    },


                    alertas_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        },

                        description:
                            "Alertas utilizadas como factor del estado"
                    },


                    analisis_ia_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        },

                        description:
                            "Resultados históricos de análisis IA utilizados"
                    },


                    predicciones_sir_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        },

                        description:
                            "Predicciones SIR utilizadas para el cálculo"
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
                            "Buckets de métricas utilizados durante el cálculo"
                    }
                }
            },


            // =================================================
            // TRAZABILIDAD TÉCNICA
            // =================================================

            registrado_por: {

                bsonType:
                    "objectId",

                description:
                    "Usuario responsable del registro. Procesos automáticos deberán utilizar el usuario técnico cuando sea definido."
            },


            created_at: {

                bsonType:
                    "date",

                description:
                    "Fecha técnica de creación del documento"
            }
        }
    }
};


// ============================================================
// 4. CREAR O ACTUALIZAR COLECCIÓN
// ============================================================

const existeEstadosSemaforo =
    db
        .getCollectionNames()
        .includes(
            "estados_semaforo"
        );


if (
    !existeEstadosSemaforo
) {

    db.createCollection(

        "estados_semaforo",

        {

            validator:
                validatorEstadosSemaforo,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );


    print(
        "✓ Colección creada: estados_semaforo"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "estados_semaforo",

            validator:
                validatorEstadosSemaforo,

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
            "de estados_semaforo."
        );
    }


    print(
        "✓ Validador actualizado: estados_semaforo"
    );
}


// ============================================================
// 5. ÍNDICES
// ============================================================
//
// estados_semaforo conserva histórico.
//
// Por esta razón ninguno de sus índices debe ser UNIQUE.
//
// Diferentes cálculos pueden existir para:
//
// - el mismo albergue;
// - el mismo nivel;
// - incluso la misma fecha_calculo.
//
// ============================================================


// ------------------------------------------------------------
// 5.1 HISTÓRICO POR ALBERGUE
// ------------------------------------------------------------

db.estados_semaforo.createIndex(

    {

        albergue_id:
            1,

        fecha_calculo:
            -1
    },

    {

        name:
            "ix_estados_semaforo_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_estados_semaforo_albergue_fecha"
);


// ------------------------------------------------------------
// 5.2 HISTÓRICO POR ALBERGUE Y NIVEL
// ------------------------------------------------------------

db.estados_semaforo.createIndex(

    {

        albergue_id:
            1,

        nivel:
            1,

        fecha_calculo:
            -1
    },

    {

        name:
            "ix_estados_semaforo_albergue_nivel_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_estados_semaforo_albergue_nivel_fecha"
);


// ------------------------------------------------------------
// 5.3 CONSULTA GLOBAL POR NIVEL
// ------------------------------------------------------------

db.estados_semaforo.createIndex(

    {

        nivel:
            1,

        fecha_calculo:
            -1
    },

    {

        name:
            "ix_estados_semaforo_nivel_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_estados_semaforo_nivel_fecha"
);


// ============================================================
// 6. REFERENCIA albergue_id
// ============================================================

const estadosConAlbergueHuerfano =
    db.estados_semaforo.aggregate([

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
                    1
            }
        }

    ]).toArray();


if (
    estadosConAlbergueHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron estados_semaforo con " +
        "albergue_id huérfano:"
    );


    printjson(
        estadosConAlbergueHuerfano
    );


    throw new Error(
        "Existen estados_semaforo asociados a " +
        "albergues inexistentes."
    );
}


print(
    "✓ Sin referencias huérfanas en albergue_id."
);


// ============================================================
// 7. REFERENCIA registrado_por
// ============================================================

const estadosConUsuarioHuerfano =
    db.estados_semaforo.aggregate([

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
                    1
            }
        }

    ]).toArray();


if (
    estadosConUsuarioHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron estados_semaforo con " +
        "registrado_por huérfano:"
    );


    printjson(
        estadosConUsuarioHuerfano
    );


    throw new Error(
        "Existen estados_semaforo con " +
        "registrado_por inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en registrado_por."
);


// ============================================================
// 8. FUNCIÓN DE CONTROL DE REFERENCIAS EN ARRAYS
// ============================================================
//
// Comprueba referencias huérfanas dentro de los arrays de
// datos_origen.
//
// ============================================================

function verificarReferenciasArray(
    campo,
    coleccionDestino,
    etiqueta
) {

    const referenciasHuerfanas =
        db.estados_semaforo.aggregate([

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
            "Existen estados_semaforo con referencias " +
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
// 9. VERIFICAR REFERENCIAS DE DATOS DE ORIGEN
// ============================================================

verificarReferenciasArray(

    "datos_origen.condiciones_sanitarias_ids",

    "condiciones_sanitarias",

    "condiciones_sanitarias_ids"
);


verificarReferenciasArray(

    "datos_origen.casos_enfermedades_ids",

    "casos_enfermedades",

    "casos_enfermedades_ids"
);


verificarReferenciasArray(

    "datos_origen.alertas_ids",

    "alertas",

    "alertas_ids"
);


verificarReferenciasArray(

    "datos_origen.analisis_ia_ids",

    "analisis_ia",

    "analisis_ia_ids"
);


verificarReferenciasArray(

    "datos_origen.predicciones_sir_ids",

    "predicciones_sir",

    "predicciones_sir_ids"
);


verificarReferenciasArray(

    "datos_origen.metricas_albergue_ids",

    "metricas_albergue",

    "metricas_albergue_ids"
);


// ============================================================
// 10. FUNCIÓN DE COHERENCIA DE ALBERGUE
// ============================================================
//
// Todas las fuentes utilizadas por un estado deben pertenecer
// al mismo albergue indicado por:
//
// estados_semaforo.albergue_id
//
// ============================================================

function verificarCoherenciaAlbergueArray(
    campo,
    coleccionDestino,
    etiqueta
) {

    const referenciasOtroAlbergue =
        db.estados_semaforo.aggregate([

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

                $unwind:
                    "$referencia_encontrada"
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

                    albergue_estado:
                        "$albergue_id",

                    albergue_origen:
                        "$referencia_encontrada.albergue_id",

                    referencia:
                        "$" + campo
                }
            }

        ]).toArray();


    if (
        referenciasOtroAlbergue.length > 0
    ) {

        print("");

        print(
            "Se detectaron referencias de " +
            etiqueta +
            " pertenecientes a otro albergue:"
        );


        printjson(
            referenciasOtroAlbergue
        );


        throw new Error(
            "Existen estados_semaforo con referencias " +
            "de " +
            etiqueta +
            " pertenecientes a otro albergue."
        );
    }


    print(
        "✓ " +
        etiqueta +
        " pertenece al albergue del estado."
    );
}


// ============================================================
// 11. COHERENCIA DE ALBERGUE DE LAS FUENTES
// ============================================================

verificarCoherenciaAlbergueArray(

    "datos_origen.condiciones_sanitarias_ids",

    "condiciones_sanitarias",

    "condiciones_sanitarias_ids"
);


verificarCoherenciaAlbergueArray(

    "datos_origen.casos_enfermedades_ids",

    "casos_enfermedades",

    "casos_enfermedades_ids"
);


verificarCoherenciaAlbergueArray(

    "datos_origen.alertas_ids",

    "alertas",

    "alertas_ids"
);


verificarCoherenciaAlbergueArray(

    "datos_origen.analisis_ia_ids",

    "analisis_ia",

    "analisis_ia_ids"
);


verificarCoherenciaAlbergueArray(

    "datos_origen.predicciones_sir_ids",

    "predicciones_sir",

    "predicciones_sir_ids"
);


verificarCoherenciaAlbergueArray(

    "datos_origen.metricas_albergue_ids",

    "metricas_albergue",

    "metricas_albergue_ids"
);


// ============================================================
// 12. DECISIONES DEL CONTRATO
// ============================================================
//
// nivel
//     → enum cerrado:
//         verde
//         amarillo
//         rojo
//
// codigo
//     → Int32.
//
//       NO se define todavía:
//
//         1 = verde
//         2 = amarillo
//         3 = rojo
//
//       porque la correspondencia numérica oficial no ha sido
//       aprobada funcionalmente.
//
// datos_origen
//     → objeto obligatorio.
//
// arrays de datos_origen
//     → obligatorios.
//
//     → uniqueItems = true.
//
//     → pueden estar vacíos.
//
//       No se establece minItems porque no existe todavía una
//       especificación que determine una cantidad mínima de
//       fuentes por cálculo.
//
// registrado_por
//     → ObjectId obligatorio.
//
//       El cálculo automático deberá asociarse posteriormente
//       al usuario técnico definido por el proyecto.
//
// updated_at / updated_by
//     → NO forman parte de esta colección.
//
//       Un nuevo cálculo crea un nuevo documento.
//
// ============================================================

print(
    "✓ nivel limitado a verde/amarillo/rojo."
);


print(
    "✓ codigo permanece Int32 sin correspondencia artificial."
);


print(
    "✓ datos_origen mantiene contrato estable."
);


print(
    "✓ Arrays de origen permiten cero o más referencias."
);


print(
    "✓ Estados históricos no utilizan updated_at ni updated_by."
);


// ============================================================
// 13. REGLAS FUNCIONALES NO IMPLEMENTADAS EN MONGODB
// ============================================================
//
// MongoDB NO determina:
//
// - cuándo debe ser verde;
// - cuándo debe ser amarillo;
// - cuándo debe ser rojo;
// - pesos de cada variable;
// - umbrales sanitarios;
// - umbrales epidemiológicos;
// - impacto exacto de una alerta;
// - combinación IA + SIR;
// - prioridad entre fuentes.
//
// RF-36, RF-37 y RF-38 establecen las fuentes que participan
// en el proceso, pero no definen todavía una fórmula de
// clasificación.
//
// Estas reglas corresponden a Backend y/o componentes
// analíticos cuando exista una definición funcional aprobada.
//
// ============================================================

print(
    "✓ No se incorporan fórmulas de riesgo no aprobadas."
);


// ============================================================
// 14. RELACIÓN CON metricas_albergue.estado_actual
// ============================================================
//
// Ya existe estructuralmente:
//
// metricas_albergue
//     .estado_actual
//     .semaforo_vital
//     .estado_semaforo_id
//         → estados_semaforo._id
//
// También existen:
//
// nivel
// codigo
// fecha_calculo
//
// El flujo funcional esperado es:
//
// 1. Backend calcula el nuevo estado.
//
// 2. Backend inserta un nuevo documento en:
//
//      estados_semaforo
//
// 3. Después de una persistencia correcta, Backend actualiza:
//
//      metricas_albergue.estado_actual.semaforo_vital
//
// con:
//
//      nivel
//      codigo
//      estado_semaforo_id
//      fecha_calculo
//
// IMPORTANTE:
//
// Esta migración NO modifica documentos existentes de
// metricas_albergue.
//
// Tampoco realiza backfill de estado_semaforo_id.
//
// No se pueden fabricar documentos históricos a partir de un
// snapshot previo porque podrían faltar:
//
// - fuentes utilizadas;
// - usuario responsable;
// - fecha histórica exacta;
// - contexto de cálculo.
//
// La relación será utilizada para nuevos cálculos oficiales.
//
// ============================================================

print(
    "✓ estados_semaforo queda preparada como fuente histórica " +
    "del snapshot metricas_albergue.estado_actual."
);


// ============================================================
// 15. RELACIÓN FUTURA CON REDIS
// ============================================================
//
// Redis NO forma parte de esta migración.
//
// Arquitectura aprobada:
//
// estados_semaforo
//     → histórico oficial
//
// metricas_albergue.estado_actual
//     → snapshot persistente
//
// Redis
//     → caché temporal
//
// La integración Redis corresponde a un checkpoint posterior.
//
// ============================================================

print(
    "✓ Redis permanece fuera del alcance de la migración 013."
);


// ============================================================
// 16. REGISTRAR MIGRACIÓN
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
                "Crear historial oficial de estados del Semáforo Vital con trazabilidad de fuentes",

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
// 17. VERIFICAR REGISTRO ÚNICO
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
        "La migración 013 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 18. VERIFICAR ÍNDICES
// ============================================================

const indicesEstadosSemaforo =
    db.estados_semaforo
        .getIndexes();


// ------------------------------------------------------------
// 18.1 albergue + fecha
// ------------------------------------------------------------

const indiceAlbergueFecha =
    indicesEstadosSemaforo.find(

        function (indice) {

            return (
                indice.name ===
                "ix_estados_semaforo_albergue_fecha"
            );
        }
    );


if (
    !indiceAlbergueFecha
) {

    throw new Error(
        "No existe ix_estados_semaforo_albergue_fecha."
    );
}


if (
    indiceAlbergueFecha.unique === true
) {

    throw new Error(
        "ix_estados_semaforo_albergue_fecha " +
        "no debe ser UNIQUE."
    );
}


if (
    indiceAlbergueFecha.key.albergue_id !== 1 ||
    indiceAlbergueFecha.key.fecha_calculo !== -1
) {

    throw new Error(
        "La definición de " +
        "ix_estados_semaforo_albergue_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_estados_semaforo_albergue_fecha confirmado."
);


// ------------------------------------------------------------
// 18.2 albergue + nivel + fecha
// ------------------------------------------------------------

const indiceAlbergueNivelFecha =
    indicesEstadosSemaforo.find(

        function (indice) {

            return (
                indice.name ===
                "ix_estados_semaforo_albergue_nivel_fecha"
            );
        }
    );


if (
    !indiceAlbergueNivelFecha
) {

    throw new Error(
        "No existe " +
        "ix_estados_semaforo_albergue_nivel_fecha."
    );
}


if (
    indiceAlbergueNivelFecha.unique === true
) {

    throw new Error(
        "ix_estados_semaforo_albergue_nivel_fecha " +
        "no debe ser UNIQUE."
    );
}


if (
    indiceAlbergueNivelFecha.key.albergue_id !== 1 ||
    indiceAlbergueNivelFecha.key.nivel !== 1 ||
    indiceAlbergueNivelFecha.key.fecha_calculo !== -1
) {

    throw new Error(
        "La definición de " +
        "ix_estados_semaforo_albergue_nivel_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_estados_semaforo_albergue_nivel_fecha confirmado."
);


// ------------------------------------------------------------
// 18.3 nivel + fecha
// ------------------------------------------------------------

const indiceNivelFecha =
    indicesEstadosSemaforo.find(

        function (indice) {

            return (
                indice.name ===
                "ix_estados_semaforo_nivel_fecha"
            );
        }
    );


if (
    !indiceNivelFecha
) {

    throw new Error(
        "No existe ix_estados_semaforo_nivel_fecha."
    );
}


if (
    indiceNivelFecha.unique === true
) {

    throw new Error(
        "ix_estados_semaforo_nivel_fecha " +
        "no debe ser UNIQUE."
    );
}


if (
    indiceNivelFecha.key.nivel !== 1 ||
    indiceNivelFecha.key.fecha_calculo !== -1
) {

    throw new Error(
        "La definición de ix_estados_semaforo_nivel_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_estados_semaforo_nivel_fecha confirmado."
);


// ============================================================
// 19. VERIFICAR VALIDACIÓN STRICT
// ============================================================

const infoColeccion =
    db
        .getCollectionInfos({

            name:
                "estados_semaforo"
        })[0];


if (
    !infoColeccion
) {

    throw new Error(
        "No fue posible consultar estados_semaforo."
    );
}


if (
    infoColeccion.options.validationLevel !== "strict"
) {

    throw new Error(
        "estados_semaforo debe utilizar " +
        "validationLevel strict."
    );
}


if (
    infoColeccion.options.validationAction !== "error"
) {

    throw new Error(
        "estados_semaforo debe utilizar " +
        "validationAction error."
    );
}


print(
    "✓ validationLevel strict confirmado."
);


print(
    "✓ validationAction error confirmado."
);


// ============================================================
// 20. CONTRATO IMPLEMENTADO
// ============================================================

print("");

print("----------------------------------------------------");
print(" CONTRATO IMPLEMENTADO");
print("----------------------------------------------------");


print(
    "✓ Historial oficial del Semáforo Vital"
);


print(
    "✓ Un nuevo cálculo genera un nuevo documento"
);


print(
    "✓ nivel verde/amarillo/rojo"
);


print(
    "✓ codigo Int32"
);


print(
    "✓ Trazabilidad hacia condiciones_sanitarias"
);


print(
    "✓ Trazabilidad hacia casos_enfermedades"
);


print(
    "✓ Trazabilidad hacia alertas"
);


print(
    "✓ Trazabilidad hacia analisis_ia"
);


print(
    "✓ Trazabilidad hacia predicciones_sir"
);


print(
    "✓ Trazabilidad hacia metricas_albergue"
);


print(
    "✓ Coherencia de albergue verificada"
);


print(
    "✓ Trazabilidad de creación"
);


print(
    "✓ Tres índices históricos no únicos"
);


print(
    "✓ Snapshot metricas_albergue permanece separado"
);


print(
    "✓ Redis permanece como caché futura"
);


// ============================================================
// 21. RESULTADO
// ============================================================

print("");

print("====================================================");
print(" MIGRACIÓN 013 FINALIZADA");
print("====================================================");


print(
    "✓ Colección estados_semaforo disponible"
);


print(
    "✓ Validator $jsonSchema strict"
);


print(
    "✓ additionalProperties deshabilitado"
);


print(
    "✓ nivel validado"
);


print(
    "✓ codigo validado como Int32"
);


print(
    "✓ datos_origen validado"
);


print(
    "✓ Referencia hacia albergues controlada"
);


print(
    "✓ Referencia hacia usuarios controlada"
);


print(
    "✓ Referencias hacia condiciones_sanitarias controladas"
);


print(
    "✓ Referencias hacia casos_enfermedades controladas"
);


print(
    "✓ Referencias hacia alertas controladas"
);


print(
    "✓ Referencias hacia analisis_ia controladas"
);


print(
    "✓ Referencias hacia predicciones_sir controladas"
);


print(
    "✓ Referencias hacia metricas_albergue controladas"
);


print(
    "✓ Coherencia de albergue controlada"
);


print(
    "✓ Índices configurados"
);


print(
    "✓ Migración registrada"
);


print("");