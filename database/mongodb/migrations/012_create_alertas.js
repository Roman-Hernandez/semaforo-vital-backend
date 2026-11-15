// ============================================================
// SEMÁFORO VITAL
// Migración:
//   012_create_alertas
//
// Colección histórica de alertas sanitarias y epidemiológicas.
//
// PROPÓSITO:
//
// Conservar las alertas generadas para cada albergue,
// su nivel de riesgo, estado activo/inactivo, visibilidad
// pública y trazabilidad hacia los datos que las originaron.
//
// REQUISITOS RELACIONADOS:
//
// RF-07  Consulta de alertas públicas
// RF-19  Historial de alertas
// RF-22  Consulta de alertas del albergue
// RF-36  Clasificación del riesgo
// RF-37  Actualización del Semáforo Vital
// RF-38  Relación alertas / Semáforo Vital
// RF-39  Generación de alertas
// RF-40  Historial de alertas
//
// IMPORTANTE:
//
// alertas conserva histórico.
//
// Las alertas NO se eliminan como operación normal.
//
// Una alerta puede pasar:
//
//   activa = true
//       ↓
//   activa = false
//
// El nivel_riesgo asociado a una alerta NO sustituye la futura
// colección estados_semaforo.
//
// estados_semaforo será la fuente histórica oficial del estado
// del Semáforo Vital.
//
// DECISIONES FUNCIONALES PENDIENTES:
//
// - catálogo oficial de tipo_alerta
// - catálogo oficial de fuente_datos
// - usuario técnico para eventos automáticos
//
// Por esta razón NO se inventan enums para esos campos.
//
// ============================================================

db = db.getSiblingDB("semaforo_vital");


const MIGRATION_VERSION =
    "012_create_alertas";


print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 012");
print(" ALERTAS");
print("====================================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES REQUERIDAS
// ============================================================
//
// alertas depende estructuralmente de:
//
// usuarios
// albergues
// condiciones_sanitarias
// casos_enfermedades
// predicciones_sir
//
// metricas_albergue NO es dependencia de creación.
//
// La relación:
//
// metricas_albergue.estado_actual.alertas_activas.ids[]
//     → alertas._id
//
// será endurecida posteriormente.
//
// ============================================================

const coleccionesRequeridas = [

    "usuarios",
    "albergues",
    "condiciones_sanitarias",
    "casos_enfermedades",
    "predicciones_sir",
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
//   011_create_predicciones_sir
//
// Debe existir exactamente una vez.
//
// ============================================================

const migracionAnterior =
    db.schema_migrations.countDocuments({

        version:
            "011_create_predicciones_sir"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 011_create_predicciones_sir " +
        "debe estar aplicada exactamente una vez antes " +
        "de ejecutar la 012."
    );
}


print(
    "✓ Migración 011 verificada."
);


// ============================================================
// 3. VALIDADOR
// ============================================================

const validatorAlertas = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de alertas",

        additionalProperties:
            false,

        required: [

            "albergue_id",
            "fecha_alerta",
            "nivel_riesgo",
            "tipo_alerta",
            "mensaje",
            "activa",
            "publica",
            "datos_origen",
            "fuente_datos",
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
            // EVENTO
            // =================================================

            fecha_alerta: {

                bsonType:
                    "date",

                description:
                    "Momento funcional en el que fue generada la alerta"
            },


            nivel_riesgo: {

                bsonType:
                    "string",

                enum: [

                    "verde",
                    "amarillo",
                    "rojo"
                ],

                description:
                    "Nivel de riesgo asociado a la alerta"
            },


            tipo_alerta: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Tipo funcional de alerta. Catálogo oficial pendiente."
            },


            mensaje: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Descripción legible de la alerta"
            },


            // =================================================
            // CICLO DE VIDA
            // =================================================

            activa: {

                bsonType:
                    "bool",

                description:
                    "Indica si la alerta permanece vigente"
            },


            publica: {

                bsonType:
                    "bool",

                description:
                    "Marcador funcional que indica si la alerta puede ser expuesta públicamente"
            },


            // =================================================
            // DATOS DE ORIGEN
            // =================================================
            //
            // El objeto es obligatorio para mantener una estructura
            // estable.
            //
            // Sus referencias internas son opcionales porque dependen
            // del tipo de evento que originó la alerta.
            //
            // =================================================

            datos_origen: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                properties: {

                    condicion_sanitaria_id: {

                        bsonType:
                            "objectId",

                        description:
                            "Referencia opcional hacia condiciones_sanitarias._id"
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
                            "Referencias opcionales hacia casos_enfermedades._id"
                    },


                    prediccion_sir_id: {

                        bsonType:
                            "objectId",

                        description:
                            "Referencia opcional hacia predicciones_sir._id"
                    }
                }
            },


            // =================================================
            // TRAZABILIDAD
            // =================================================

            fuente_datos: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Origen funcional del evento. Catálogo oficial pendiente."
            },


            registrado_por: {

                bsonType:
                    "objectId",

                description:
                    "Referencia lógica hacia usuarios._id"
            },


            created_at: {

                bsonType:
                    "date",

                description:
                    "Fecha técnica de creación del documento"
            },


            updated_at: {

                bsonType:
                    "date",

                description:
                    "Fecha técnica de última actualización"
            },


            updated_by: {

                bsonType:
                    "objectId",

                description:
                    "Usuario responsable de la última actualización"
            }
        }
    }
};


// ============================================================
// 4. CREAR O ACTUALIZAR COLECCIÓN
// ============================================================

const existeAlertas =
    db
        .getCollectionNames()
        .includes(
            "alertas"
        );


if (
    !existeAlertas
) {

    db.createCollection(

        "alertas",

        {

            validator:
                validatorAlertas,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );


    print(
        "✓ Colección creada: alertas"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "alertas",

            validator:
                validatorAlertas,

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
            "de alertas."
        );
    }


    print(
        "✓ Validador actualizado: alertas"
    );
}


// ============================================================
// 5. ÍNDICES
// ============================================================
//
// Ningún índice es UNIQUE.
//
// Una misma fecha puede contener múltiples alertas.
//
// ============================================================


// ------------------------------------------------------------
// 5.1 HISTÓRICO POR ALBERGUE
// ------------------------------------------------------------

db.alertas.createIndex(

    {

        albergue_id:
            1,

        fecha_alerta:
            -1
    },

    {

        name:
            "ix_alertas_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_alertas_albergue_fecha"
);


// ------------------------------------------------------------
// 5.2 ALERTAS ACTIVAS POR ALBERGUE
// ------------------------------------------------------------

db.alertas.createIndex(

    {

        albergue_id:
            1,

        activa:
            1,

        fecha_alerta:
            -1
    },

    {

        name:
            "ix_alertas_albergue_activa_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_alertas_albergue_activa_fecha"
);


// ------------------------------------------------------------
// 5.3 CONSULTA GLOBAL POR NIVEL
// ------------------------------------------------------------

db.alertas.createIndex(

    {

        nivel_riesgo:
            1,

        activa:
            1
    },

    {

        name:
            "ix_alertas_nivel_activa"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_alertas_nivel_activa"
);


// ============================================================
// 6. REFERENCIA albergue_id
// ============================================================

const alertasConAlbergueHuerfano =
    db.alertas.aggregate([

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
    alertasConAlbergueHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron alertas con albergue_id huérfano:"
    );


    printjson(
        alertasConAlbergueHuerfano
    );


    throw new Error(
        "Existen documentos alertas asociados " +
        "a albergues inexistentes."
    );
}


print(
    "✓ Sin referencias huérfanas en albergue_id."
);


// ============================================================
// 7. REFERENCIA registrado_por
// ============================================================

const alertasConUsuarioHuerfano =
    db.alertas.aggregate([

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
    alertasConUsuarioHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron alertas con registrado_por huérfano:"
    );


    printjson(
        alertasConUsuarioHuerfano
    );


    throw new Error(
        "Existen documentos alertas con " +
        "registrado_por inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en registrado_por."
);


// ============================================================
// 8. REFERENCIA OPCIONAL updated_by
// ============================================================

const alertasConUpdatedByHuerfano =
    db.alertas.aggregate([

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
                    "usuario_actualizacion_ref"
            }
        },


        {

            $match: {

                "usuario_actualizacion_ref.0": {

                    $exists:
                        false
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                updated_by:
                    1
            }
        }

    ]).toArray();


if (
    alertasConUpdatedByHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron alertas con updated_by huérfano:"
    );


    printjson(
        alertasConUpdatedByHuerfano
    );


    throw new Error(
        "Existen documentos alertas con updated_by inexistente."
    );
}


print(
    "✓ Referencia opcional updated_by verificada."
);


// ============================================================
// 9. REFERENCIA OPCIONAL condicion_sanitaria_id
// ============================================================

const condicionesHuerfanas =
    db.alertas.aggregate([

        {

            $match: {

                "datos_origen.condicion_sanitaria_id": {

                    $exists:
                        true
                }
            }
        },


        {

            $lookup: {

                from:
                    "condiciones_sanitarias",

                localField:
                    "datos_origen.condicion_sanitaria_id",

                foreignField:
                    "_id",

                as:
                    "condicion_ref"
            }
        },


        {

            $match: {

                "condicion_ref.0": {

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

                condicion_sanitaria_id:
                    "$datos_origen.condicion_sanitaria_id"
            }
        }

    ]).toArray();


if (
    condicionesHuerfanas.length > 0
) {

    print("");

    print(
        "Se detectaron referencias huérfanas hacia " +
        "condiciones_sanitarias:"
    );


    printjson(
        condicionesHuerfanas
    );


    throw new Error(
        "Existen alertas con condicion_sanitaria_id inexistente."
    );
}


print(
    "✓ Referencia opcional condicion_sanitaria_id verificada."
);


// ============================================================
// 10. REFERENCIAS casos_enfermedades_ids
// ============================================================

const casosHuerfanos =
    db.alertas.aggregate([

        {

            $match: {

                "datos_origen.casos_enfermedades_ids": {

                    $exists:
                        true
                }
            }
        },


        {

            $unwind: {

                path:
                    "$datos_origen.casos_enfermedades_ids"
            }
        },


        {

            $lookup: {

                from:
                    "casos_enfermedades",

                localField:
                    "datos_origen.casos_enfermedades_ids",

                foreignField:
                    "_id",

                as:
                    "caso_ref"
            }
        },


        {

            $match: {

                "caso_ref.0": {

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

                caso_enfermedad_id:
                    "$datos_origen.casos_enfermedades_ids"
            }
        }

    ]).toArray();


if (
    casosHuerfanos.length > 0
) {

    print("");

    print(
        "Se detectaron referencias huérfanas hacia " +
        "casos_enfermedades:"
    );


    printjson(
        casosHuerfanos
    );


    throw new Error(
        "Existen alertas con referencias inexistentes " +
        "en casos_enfermedades_ids."
    );
}


print(
    "✓ Referencias casos_enfermedades_ids verificadas."
);


// ============================================================
// 11. REFERENCIA OPCIONAL prediccion_sir_id
// ============================================================

const prediccionesHuerfanas =
    db.alertas.aggregate([

        {

            $match: {

                "datos_origen.prediccion_sir_id": {

                    $exists:
                        true
                }
            }
        },


        {

            $lookup: {

                from:
                    "predicciones_sir",

                localField:
                    "datos_origen.prediccion_sir_id",

                foreignField:
                    "_id",

                as:
                    "prediccion_ref"
            }
        },


        {

            $match: {

                "prediccion_ref.0": {

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

                prediccion_sir_id:
                    "$datos_origen.prediccion_sir_id"
            }
        }

    ]).toArray();


if (
    prediccionesHuerfanas.length > 0
) {

    print("");

    print(
        "Se detectaron referencias huérfanas hacia " +
        "predicciones_sir:"
    );


    printjson(
        prediccionesHuerfanas
    );


    throw new Error(
        "Existen alertas con prediccion_sir_id inexistente."
    );
}


print(
    "✓ Referencia opcional prediccion_sir_id verificada."
);


// ============================================================
// 12. COHERENCIA DE ALBERGUE:
//     condicion_sanitaria_id
// ============================================================
//
// Si una condición sanitaria es utilizada como origen,
// debe pertenecer al mismo albergue de la alerta.
//
// ============================================================

const condicionesOtroAlbergue =
    db.alertas.aggregate([

        {

            $match: {

                "datos_origen.condicion_sanitaria_id": {

                    $exists:
                        true
                }
            }
        },


        {

            $lookup: {

                from:
                    "condiciones_sanitarias",

                localField:
                    "datos_origen.condicion_sanitaria_id",

                foreignField:
                    "_id",

                as:
                    "condicion_ref"
            }
        },


        {

            $unwind:
                "$condicion_ref"
        },


        {

            $match: {

                $expr: {

                    $ne: [

                        "$albergue_id",
                        "$condicion_ref.albergue_id"
                    ]
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                albergue_alerta:
                    "$albergue_id",

                albergue_origen:
                    "$condicion_ref.albergue_id",

                condicion_sanitaria_id:
                    "$datos_origen.condicion_sanitaria_id"
            }
        }

    ]).toArray();


if (
    condicionesOtroAlbergue.length > 0
) {

    print("");

    print(
        "Se detectaron condiciones sanitarias pertenecientes " +
        "a un albergue diferente al de la alerta:"
    );


    printjson(
        condicionesOtroAlbergue
    );


    throw new Error(
        "Existen alertas cuya condicion_sanitaria_id " +
        "pertenece a otro albergue."
    );
}


print(
    "✓ condicion_sanitaria_id pertenece al albergue de la alerta."
);


// ============================================================
// 13. COHERENCIA DE ALBERGUE:
//     casos_enfermedades_ids
// ============================================================

const casosOtroAlbergue =
    db.alertas.aggregate([

        {

            $match: {

                "datos_origen.casos_enfermedades_ids": {

                    $exists:
                        true
                }
            }
        },


        {

            $unwind: {

                path:
                    "$datos_origen.casos_enfermedades_ids"
            }
        },


        {

            $lookup: {

                from:
                    "casos_enfermedades",

                localField:
                    "datos_origen.casos_enfermedades_ids",

                foreignField:
                    "_id",

                as:
                    "caso_ref"
            }
        },


        {

            $unwind:
                "$caso_ref"
        },


        {

            $match: {

                $expr: {

                    $ne: [

                        "$albergue_id",
                        "$caso_ref.albergue_id"
                    ]
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                albergue_alerta:
                    "$albergue_id",

                albergue_origen:
                    "$caso_ref.albergue_id",

                caso_enfermedad_id:
                    "$datos_origen.casos_enfermedades_ids"
            }
        }

    ]).toArray();


if (
    casosOtroAlbergue.length > 0
) {

    print("");

    print(
        "Se detectaron casos epidemiológicos pertenecientes " +
        "a un albergue diferente al de la alerta:"
    );


    printjson(
        casosOtroAlbergue
    );


    throw new Error(
        "Existen alertas con casos_enfermedades_ids " +
        "pertenecientes a otro albergue."
    );
}


print(
    "✓ casos_enfermedades_ids pertenecen al albergue de la alerta."
);


// ============================================================
// 14. COHERENCIA DE ALBERGUE:
//     prediccion_sir_id
// ============================================================

const prediccionesOtroAlbergue =
    db.alertas.aggregate([

        {

            $match: {

                "datos_origen.prediccion_sir_id": {

                    $exists:
                        true
                }
            }
        },


        {

            $lookup: {

                from:
                    "predicciones_sir",

                localField:
                    "datos_origen.prediccion_sir_id",

                foreignField:
                    "_id",

                as:
                    "prediccion_ref"
            }
        },


        {

            $unwind:
                "$prediccion_ref"
        },


        {

            $match: {

                $expr: {

                    $ne: [

                        "$albergue_id",
                        "$prediccion_ref.albergue_id"
                    ]
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                albergue_alerta:
                    "$albergue_id",

                albergue_origen:
                    "$prediccion_ref.albergue_id",

                prediccion_sir_id:
                    "$datos_origen.prediccion_sir_id"
            }
        }

    ]).toArray();


if (
    prediccionesOtroAlbergue.length > 0
) {

    print("");

    print(
        "Se detectaron predicciones SIR pertenecientes " +
        "a un albergue diferente al de la alerta:"
    );


    printjson(
        prediccionesOtroAlbergue
    );


    throw new Error(
        "Existen alertas cuya prediccion_sir_id " +
        "pertenece a otro albergue."
    );
}


print(
    "✓ prediccion_sir_id pertenece al albergue de la alerta."
);


// ============================================================
// 15. DECISIONES DEL CONTRATO
// ============================================================
//
// nivel_riesgo
//     → enum cerrado:
//         verde
//         amarillo
//         rojo
//
// tipo_alerta
//     → String abierto.
//       El catálogo PF-06 sigue pendiente.
//
// fuente_datos
//     → String abierto.
//       El catálogo oficial sigue pendiente.
//
// registrado_por
//     → ObjectId obligatorio.
//
//       Para procesos automáticos deberá definirse un usuario
//       técnico.
//
// publica
//     → marcador funcional.
//       No reemplaza autorización Backend.
//
// analisis_ia_id
//     → NO se incorpora todavía porque no forma parte del
//       contrato lógico aprobado de datos_origen.
//
// prioridad
//     → NO se incorpora porque no existe catálogo funcional
//       aprobado.
//
// ============================================================

print(
    "✓ nivel_riesgo limitado a verde/amarillo/rojo."
);


print(
    "✓ tipo_alerta permanece abierto hasta definición funcional."
);


print(
    "✓ fuente_datos permanece abierto hasta definición funcional."
);


print(
    "✓ publica disponible como marcador funcional."
);


print(
    "✓ No se introduce prioridad sin contrato aprobado."
);


// ============================================================
// 16. RELACIÓN FUTURA CON metricas_albergue
// ============================================================
//
// Ya existe estructuralmente:
//
// metricas_albergue
//     .estado_actual
//     .alertas_activas
//     .ids[]
//         → alertas._id
//
// Esta migración NO modifica:
//   008_create_metricas_albergue.js
//
// Tampoco modifica documentos de metricas_albergue.
//
// La integridad de esta relación será endurecida mediante
// migración o checkpoint posterior.
//
// ============================================================

print(
    "✓ alertas queda preparada para referencias desde metricas_albergue."
);


// ============================================================
// 17. RELACIÓN FUTURA CON estados_semaforo
// ============================================================
//
// alertas.nivel_riesgo representa el nivel asociado al evento.
//
// NO constituye la fuente histórica oficial del Semáforo Vital.
//
// La futura colección:
//
//   estados_semaforo
//
// tendrá esa responsabilidad.
//
// ============================================================

print(
    "✓ alertas permanece separada del futuro historial estados_semaforo."
);


// ============================================================
// 18. REGISTRAR MIGRACIÓN
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
                "Crear alertas históricas con nivel de riesgo, ciclo de vida, visibilidad y trazabilidad de origen",

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
// 19. VERIFICAR REGISTRO ÚNICO
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
        "La migración 012 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 20. VERIFICAR ÍNDICES
// ============================================================

const indicesAlertas =
    db.alertas
        .getIndexes();


// ------------------------------------------------------------
// 20.1 albergue + fecha
// ------------------------------------------------------------

const indiceAlbergueFecha =
    indicesAlertas.find(

        function (indice) {

            return (
                indice.name ===
                "ix_alertas_albergue_fecha"
            );
        }
    );


if (
    !indiceAlbergueFecha
) {

    throw new Error(
        "No existe ix_alertas_albergue_fecha."
    );
}


if (
    indiceAlbergueFecha.unique === true
) {

    throw new Error(
        "ix_alertas_albergue_fecha no debe ser UNIQUE."
    );
}


if (
    indiceAlbergueFecha.key.albergue_id !== 1 ||
    indiceAlbergueFecha.key.fecha_alerta !== -1
) {

    throw new Error(
        "La definición de ix_alertas_albergue_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_alertas_albergue_fecha confirmado."
);


// ------------------------------------------------------------
// 20.2 albergue + activa + fecha
// ------------------------------------------------------------

const indiceAlbergueActivaFecha =
    indicesAlertas.find(

        function (indice) {

            return (
                indice.name ===
                "ix_alertas_albergue_activa_fecha"
            );
        }
    );


if (
    !indiceAlbergueActivaFecha
) {

    throw new Error(
        "No existe ix_alertas_albergue_activa_fecha."
    );
}


if (
    indiceAlbergueActivaFecha.unique === true
) {

    throw new Error(
        "ix_alertas_albergue_activa_fecha no debe ser UNIQUE."
    );
}


if (
    indiceAlbergueActivaFecha.key.albergue_id !== 1 ||
    indiceAlbergueActivaFecha.key.activa !== 1 ||
    indiceAlbergueActivaFecha.key.fecha_alerta !== -1
) {

    throw new Error(
        "La definición de ix_alertas_albergue_activa_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_alertas_albergue_activa_fecha confirmado."
);


// ------------------------------------------------------------
// 20.3 nivel_riesgo + activa
// ------------------------------------------------------------

const indiceNivelActiva =
    indicesAlertas.find(

        function (indice) {

            return (
                indice.name ===
                "ix_alertas_nivel_activa"
            );
        }
    );


if (
    !indiceNivelActiva
) {

    throw new Error(
        "No existe ix_alertas_nivel_activa."
    );
}


if (
    indiceNivelActiva.unique === true
) {

    throw new Error(
        "ix_alertas_nivel_activa no debe ser UNIQUE."
    );
}


if (
    indiceNivelActiva.key.nivel_riesgo !== 1 ||
    indiceNivelActiva.key.activa !== 1
) {

    throw new Error(
        "La definición de ix_alertas_nivel_activa " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_alertas_nivel_activa confirmado."
);


// ============================================================
// 21. CONTRATO IMPLEMENTADO
// ============================================================

print("");

print("----------------------------------------------------");
print(" CONTRATO IMPLEMENTADO");
print("----------------------------------------------------");


print(
    "✓ Historial de alertas persistente"
);


print(
    "✓ Alertas activas e inactivas conservadas"
);


print(
    "✓ nivel_riesgo verde/amarillo/rojo"
);


print(
    "✓ tipo_alerta sin catálogo artificial"
);


print(
    "✓ Mensaje obligatorio"
);


print(
    "✓ Visibilidad pública explícita"
);


print(
    "✓ Trazabilidad hacia condiciones_sanitarias"
);


print(
    "✓ Trazabilidad hacia casos_enfermedades"
);


print(
    "✓ Trazabilidad hacia predicciones_sir"
);


print(
    "✓ Coherencia de albergue verificada"
);


print(
    "✓ Trazabilidad de creación y actualización"
);


print(
    "✓ Tres índices históricos no únicos"
);


// ============================================================
// 22. RESULTADO
// ============================================================

print("");

print("====================================================");
print(" MIGRACIÓN 012 FINALIZADA");
print("====================================================");


print(
    "✓ Colección alertas disponible"
);


print(
    "✓ Validator $jsonSchema strict"
);


print(
    "✓ additionalProperties deshabilitado"
);


print(
    "✓ nivel_riesgo validado"
);


print(
    "✓ Ciclo de vida activa/inactiva disponible"
);


print(
    "✓ Marcador publica disponible"
);


print(
    "✓ Referencia hacia albergues controlada"
);


print(
    "✓ Referencia hacia usuarios controlada"
);


print(
    "✓ Referencia updated_by controlada cuando existe"
);


print(
    "✓ Referencia hacia condiciones_sanitarias controlada"
);


print(
    "✓ Referencias hacia casos_enfermedades controladas"
);


print(
    "✓ Referencia hacia predicciones_sir controlada"
);


print(
    "✓ Coherencia de albergue de datos_origen controlada"
);


print(
    "✓ Índices configurados"
);


print(
    "✓ Migración registrada"
);


print("");