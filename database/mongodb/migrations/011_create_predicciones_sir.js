// ============================================================
// SEMÁFORO VITAL
// Migración:
//   011_create_predicciones_sir
//
// Colección histórica de resultados de simulaciones SIR.
//
// Cada ejecución del modelo genera un documento nuevo.
// No se deben sobrescribir simulaciones anteriores.
//
// FUENTES PRINCIPALES:
//
// historial_poblacion
//     → población diaria oficial
//
// casos_enfermedades
//     → casos activos registrados
//
// analisis_ia
//     → análisis previo opcional
//
// escenario_id queda opcional hasta implementar escenarios.
//
// IMPORTANTE:
//
// Esta migración define el contrato persistente del resultado
// SIR.
//
// MongoDB NO ejecuta el modelo matemático.
// MongoDB NO calcula beta, gamma ni la trayectoria.
// MongoDB persiste, valida estructura y conserva trazabilidad.
//
// Reglas matemáticas como:
//
//   S + I + R = población
//   trayectoria.length = horizonte_dias + 1
//   conservación de población
//   secuencia exacta de días
//
// NO se imponen todavía en $jsonSchema.
// ============================================================

db = db.getSiblingDB("semaforo_vital");


const MIGRATION_VERSION =
    "011_create_predicciones_sir";


print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 011");
print(" PREDICCIONES SIR");
print("====================================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES REQUERIDAS
// ============================================================

const coleccionesRequeridas = [

    "usuarios",
    "albergues",
    "historial_poblacion",
    "casos_enfermedades",
    "analisis_ia",
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
//   010_create_historial_poblacion
//
// Debe existir exactamente una vez.
// ============================================================

const migracionAnterior =
    db.schema_migrations.countDocuments({

        version:
            "010_create_historial_poblacion"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 010_create_historial_poblacion " +
        "debe estar aplicada exactamente una vez antes " +
        "de ejecutar la 011."
    );
}


print(
    "✓ Migración 010 verificada."
);


// ============================================================
// 3. VALIDADOR
// ============================================================

const validatorPrediccionesSIR = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de predicciones SIR",

        additionalProperties:
            false,

        required: [

            "albergue_id",
            "fecha_ejecucion",
            "enfermedad",
            "publica",
            "modelo",
            "parametros",
            "datos_entrada",
            "preprocesamiento",
            "trayectoria",
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


            escenario_id: {

                bsonType:
                    "objectId",

                description:
                    "Referencia lógica futura hacia escenarios._id"
            },


            fecha_ejecucion: {

                bsonType:
                    "date",

                description:
                    "Instante en el que se ejecutó la simulación SIR"
            },


            enfermedad: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Enfermedad o evento epidemiológico modelado"
            },


            publica: {

                bsonType:
                    "bool",

                description:
                    "Indica si la ejecución está marcada funcionalmente para exposición"
            },


            // =================================================
            // MODELO
            // =================================================

            modelo: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [

                    "nombre",
                    "version"
                ],

                properties: {

                    nombre: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    },


                    version: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    }
                }
            },


            // =================================================
            // PARÁMETROS SIR
            // =================================================

            parametros: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [

                    "beta",
                    "gamma",
                    "condiciones_iniciales",
                    "horizonte_dias",
                    "metodo_numerico"
                ],

                properties: {

                    beta: {

                        bsonType: [

                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        description:
                            "Parámetro beta utilizado por el modelo SIR"
                    },


                    gamma: {

                        bsonType: [

                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        description:
                            "Parámetro gamma utilizado por el modelo SIR"
                    },


                    condiciones_iniciales: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [

                            "susceptibles",
                            "infectados",
                            "recuperados"
                        ],

                        properties: {

                            susceptibles: {

                                bsonType:
                                    "int",

                                minimum:
                                    0
                            },


                            infectados: {

                                bsonType:
                                    "int",

                                minimum:
                                    0
                            },


                            recuperados: {

                                bsonType:
                                    "int",

                                minimum:
                                    0
                            }
                        }
                    },


                    horizonte_dias: {

                        bsonType:
                            "int",

                        minimum:
                            1,

                        description:
                            "Horizonte temporal de la simulación expresado en días"
                    },


                    metodo_numerico: {

                        bsonType:
                            "string",

                        minLength:
                            1,

                        description:
                            "Método numérico utilizado por el componente SIR"
                    }
                }
            },


            // =================================================
            // DATOS DE ENTRADA
            // =================================================

            datos_entrada: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [

                    "historial_poblacion_ids",
                    "casos_enfermedades_ids"
                ],

                properties: {

                    analisis_ia_id: {

                        bsonType:
                            "objectId",

                        description:
                            "Referencia opcional hacia analisis_ia._id"
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
                            "Documentos de historial poblacional utilizados como entrada"
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
                            "Documentos de casos activos utilizados como entrada"
                    }
                }
            },


            // =================================================
            // PREPROCESAMIENTO
            // =================================================

            preprocesamiento: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [

                    "registros_considerados",
                    "registros_descartados"
                ],

                properties: {

                    registros_considerados: {

                        bsonType:
                            "int",

                        minimum:
                            0
                    },


                    registros_descartados: {

                        bsonType:
                            "int",

                        minimum:
                            0
                    },


                    observaciones: {

                        bsonType:
                            "string",

                        description:
                            "Observaciones opcionales sobre preparación o calidad de datos"
                    }
                }
            },


            // =================================================
            // TRAYECTORIA DEL MODELO
            // =================================================

            trayectoria: {

                bsonType:
                    "array",

                minItems:
                    1,

                description:
                    "Serie temporal calculada por el modelo SIR",

                items: {

                    bsonType:
                        "object",

                    additionalProperties:
                        false,

                    required: [

                        "dia",
                        "susceptibles",
                        "infectados",
                        "recuperados"
                    ],

                    properties: {

                        dia: {

                            bsonType:
                                "int",

                            minimum:
                                0
                        },


                        susceptibles: {

                            bsonType: [

                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0
                        },


                        infectados: {

                            bsonType: [

                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0
                        },


                        recuperados: {

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
                }
            },


            // =================================================
            // TRAZABILIDAD
            // =================================================

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
                    "Fecha técnica de persistencia de la ejecución"
            }
        }
    }
};


// ============================================================
// 4. CREAR O ACTUALIZAR COLECCIÓN
// ============================================================

const existePrediccionesSIR =
    db
        .getCollectionNames()
        .includes(
            "predicciones_sir"
        );


if (
    !existePrediccionesSIR
) {

    db.createCollection(

        "predicciones_sir",

        {

            validator:
                validatorPrediccionesSIR,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );


    print(
        "✓ Colección creada: predicciones_sir"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "predicciones_sir",

            validator:
                validatorPrediccionesSIR,

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
            "de predicciones_sir."
        );
    }


    print(
        "✓ Validador actualizado: predicciones_sir"
    );
}


// ============================================================
// 5. ÍNDICES
// ============================================================


// ------------------------------------------------------------
// 5.1 ALBERGUE + FECHA
// ------------------------------------------------------------

db.predicciones_sir.createIndex(

    {

        albergue_id:
            1,

        fecha_ejecucion:
            -1
    },

    {

        name:
            "ix_predicciones_sir_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_predicciones_sir_albergue_fecha"
);


// ------------------------------------------------------------
// 5.2 ALBERGUE + ENFERMEDAD + FECHA
// ------------------------------------------------------------

db.predicciones_sir.createIndex(

    {

        albergue_id:
            1,

        enfermedad:
            1,

        fecha_ejecucion:
            -1
    },

    {

        name:
            "ix_predicciones_sir_albergue_enfermedad_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_predicciones_sir_albergue_enfermedad_fecha"
);


// ------------------------------------------------------------
// 5.3 MODELO + VERSIÓN + FECHA
// ------------------------------------------------------------

db.predicciones_sir.createIndex(

    {

        "modelo.nombre":
            1,

        "modelo.version":
            1,

        fecha_ejecucion:
            -1
    },

    {

        name:
            "ix_predicciones_sir_modelo_version_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_predicciones_sir_modelo_version_fecha"
);


// ============================================================
// 6. REFERENCIA albergue_id
// ============================================================

const prediccionesConAlbergueHuerfano =
    db.predicciones_sir.aggregate([

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
    prediccionesConAlbergueHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron predicciones SIR con " +
        "albergue_id huérfano:"
    );


    printjson(
        prediccionesConAlbergueHuerfano
    );


    throw new Error(
        "Existen documentos predicciones_sir asociados " +
        "a albergues inexistentes."
    );
}


print(
    "✓ Sin referencias huérfanas en albergue_id."
);


// ============================================================
// 7. REFERENCIA registrado_por
// ============================================================

const prediccionesConUsuarioHuerfano =
    db.predicciones_sir.aggregate([

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
    prediccionesConUsuarioHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron predicciones SIR con " +
        "registrado_por huérfano:"
    );


    printjson(
        prediccionesConUsuarioHuerfano
    );


    throw new Error(
        "Existen documentos predicciones_sir con " +
        "registrado_por inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en registrado_por."
);


// ============================================================
// 8. FUNCIÓN PARA VALIDAR ARRAYS DE REFERENCIAS
// ============================================================

function validarReferenciasArray(
    rutaCampo,
    coleccionDestino
) {

    const referenciasHuerfanas =
        db.predicciones_sir.aggregate([

            {

                $unwind: {

                    path:
                        "$" + rutaCampo
                }
            },


            {

                $lookup: {

                    from:
                        coleccionDestino,

                    localField:
                        rutaCampo,

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

                    valor_referencia:
                        "$" + rutaCampo
                }
            }

        ]).toArray();


    if (
        referenciasHuerfanas.length > 0
    ) {

        print("");

        print(
            "Se detectaron referencias huérfanas en " +
            rutaCampo +
            ":"
        );


        printjson(
            referenciasHuerfanas
        );


        throw new Error(
            "Existen referencias inválidas en " +
            rutaCampo +
            "."
        );
    }


    print(
        "✓ Referencias válidas: " +
        rutaCampo +
        " → " +
        coleccionDestino +
        "._id"
    );
}


// ============================================================
// 9. REFERENCIAS DE DATOS DE ENTRADA
// ============================================================

validarReferenciasArray(

    "datos_entrada.historial_poblacion_ids",
    "historial_poblacion"
);


validarReferenciasArray(

    "datos_entrada.casos_enfermedades_ids",
    "casos_enfermedades"
);


// ============================================================
// 10. REFERENCIA OPCIONAL analisis_ia_id
// ============================================================
//
// analisis_ia_id no es obligatorio.
//
// Cuando exista:
//
// predicciones_sir.datos_entrada.analisis_ia_id
//     → analisis_ia._id
//
// ============================================================

const analisisIAHuerfanos =
    db.predicciones_sir.aggregate([

        {

            $match: {

                "datos_entrada.analisis_ia_id": {

                    $exists:
                        true
                }
            }
        },


        {

            $lookup: {

                from:
                    "analisis_ia",

                localField:
                    "datos_entrada.analisis_ia_id",

                foreignField:
                    "_id",

                as:
                    "analisis_ref"
            }
        },


        {

            $match: {

                "analisis_ref.0": {

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

                analisis_ia_id:
                    "$datos_entrada.analisis_ia_id"
            }
        }

    ]).toArray();


if (
    analisisIAHuerfanos.length > 0
) {

    print("");

    print(
        "Se detectaron referencias huérfanas hacia analisis_ia:"
    );


    printjson(
        analisisIAHuerfanos
    );


    throw new Error(
        "Existen documentos predicciones_sir con " +
        "analisis_ia_id inexistente."
    );
}


print(
    "✓ Referencia opcional analisis_ia_id verificada."
);


// ============================================================
// 11. escenario_id
// ============================================================
//
// escenarios todavía no existe.
//
// Actualmente solo se controla estructuralmente:
//
// escenario_id → ObjectId
//
// Posteriormente:
//
// predicciones_sir.escenario_id
//     → escenarios._id
//
// El control referencial se agregará cuando la colección
// escenarios exista.
//
// ============================================================

print(
    "✓ escenario_id preparado como referencia futura opcional."
);


// ============================================================
// 12. REGLAS MATEMÁTICAS NO IMPUESTAS EN JSONSCHEMA
// ============================================================
//
// Estas reglas pertenecen al componente matemático / Backend
// y deberán definirse formalmente antes de endurecerlas:
//
//   susceptibles + infectados + recuperados
//       == población inicial
//
//   trayectoria.length
//       == horizonte_dias + 1
//
//   dia
//       == secuencia 0, 1, 2, ...
//
//   S + I + R
//       == población total conservada
//
//   relación exacta entre enfermedad y documentos fuente
//
// No se implementan como restricciones estructurales todavía.
// ============================================================

print(
    "✓ Reglas matemáticas avanzadas quedan bajo contrato de aplicación."
);


// ============================================================
// 13. REGISTRAR MIGRACIÓN
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
                "Crear predicciones_sir con parámetros, trazabilidad de entradas y trayectoria epidemiológica",

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
// 14. VERIFICAR REGISTRO ÚNICO
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
        "La migración 011 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 15. VERIFICAR ÍNDICES
// ============================================================

const indicesPrediccionesSIR =
    db.predicciones_sir
        .getIndexes();


// ------------------------------------------------------------
// 15.1 Índice albergue + fecha
// ------------------------------------------------------------

const indiceAlbergueFecha =
    indicesPrediccionesSIR.find(

        function (indice) {

            return (
                indice.name ===
                "ix_predicciones_sir_albergue_fecha"
            );
        }
    );


if (
    !indiceAlbergueFecha
) {

    throw new Error(
        "No existe el índice " +
        "ix_predicciones_sir_albergue_fecha."
    );
}


if (
    indiceAlbergueFecha.unique === true
) {

    throw new Error(
        "ix_predicciones_sir_albergue_fecha " +
        "no debe ser UNIQUE."
    );
}


if (
    indiceAlbergueFecha.key.albergue_id !== 1 ||
    indiceAlbergueFecha.key.fecha_ejecucion !== -1
) {

    throw new Error(
        "La definición de " +
        "ix_predicciones_sir_albergue_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_predicciones_sir_albergue_fecha confirmado."
);


// ------------------------------------------------------------
// 15.2 Índice albergue + enfermedad + fecha
// ------------------------------------------------------------

const indiceAlbergueEnfermedadFecha =
    indicesPrediccionesSIR.find(

        function (indice) {

            return (
                indice.name ===
                "ix_predicciones_sir_albergue_enfermedad_fecha"
            );
        }
    );


if (
    !indiceAlbergueEnfermedadFecha
) {

    throw new Error(
        "No existe el índice " +
        "ix_predicciones_sir_albergue_enfermedad_fecha."
    );
}


if (
    indiceAlbergueEnfermedadFecha.unique === true
) {

    throw new Error(
        "ix_predicciones_sir_albergue_enfermedad_fecha " +
        "no debe ser UNIQUE."
    );
}


if (
    indiceAlbergueEnfermedadFecha.key.albergue_id !== 1 ||
    indiceAlbergueEnfermedadFecha.key.enfermedad !== 1 ||
    indiceAlbergueEnfermedadFecha.key.fecha_ejecucion !== -1
) {

    throw new Error(
        "La definición de " +
        "ix_predicciones_sir_albergue_enfermedad_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice " +
    "ix_predicciones_sir_albergue_enfermedad_fecha " +
    "confirmado."
);


// ------------------------------------------------------------
// 15.3 Índice modelo + versión + fecha
// ------------------------------------------------------------

const indiceModeloVersionFecha =
    indicesPrediccionesSIR.find(

        function (indice) {

            return (
                indice.name ===
                "ix_predicciones_sir_modelo_version_fecha"
            );
        }
    );


if (
    !indiceModeloVersionFecha
) {

    throw new Error(
        "No existe el índice " +
        "ix_predicciones_sir_modelo_version_fecha."
    );
}


if (
    indiceModeloVersionFecha.unique === true
) {

    throw new Error(
        "ix_predicciones_sir_modelo_version_fecha " +
        "no debe ser UNIQUE."
    );
}


if (
    indiceModeloVersionFecha.key["modelo.nombre"] !== 1 ||
    indiceModeloVersionFecha.key["modelo.version"] !== 1 ||
    indiceModeloVersionFecha.key.fecha_ejecucion !== -1
) {

    throw new Error(
        "La definición de " +
        "ix_predicciones_sir_modelo_version_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice " +
    "ix_predicciones_sir_modelo_version_fecha " +
    "confirmado."
);


// ============================================================
// 16. CONTRATO IMPLEMENTADO
// ============================================================

print("");

print("----------------------------------------------------");
print(" CONTRATO IMPLEMENTADO");
print("----------------------------------------------------");


print(
    "✓ Cada ejecución SIR genera un documento histórico"
);


print(
    "✓ Población trazada mediante historial_poblacion"
);


print(
    "✓ Casos trazados mediante casos_enfermedades"
);


print(
    "✓ analisis_ia_id disponible como referencia opcional"
);


print(
    "✓ Modelo identificado por nombre y versión"
);


print(
    "✓ beta y gamma registrados"
);


print(
    "✓ Condiciones iniciales S/I/R registradas"
);


print(
    "✓ Horizonte temporal registrado"
);


print(
    "✓ Método numérico registrado sin catálogo cerrado"
);


print(
    "✓ Trayectoria S/I/R persistida"
);


print(
    "✓ escenario_id opcional"
);


print(
    "✓ publica registrada como marcador funcional"
);


// ============================================================
// 17. RESULTADO
// ============================================================

print("");

print("====================================================");
print(" MIGRACIÓN 011 FINALIZADA");
print("====================================================");


print(
    "✓ Colección predicciones_sir disponible"
);


print(
    "✓ Validator $jsonSchema strict"
);


print(
    "✓ additionalProperties deshabilitado"
);


print(
    "✓ Parámetros SIR validados estructuralmente"
);


print(
    "✓ Condiciones iniciales validadas"
);


print(
    "✓ Trayectoria epidemiológica validada"
);


print(
    "✓ Referencia hacia albergues controlada"
);


print(
    "✓ Referencia hacia usuarios controlada"
);


print(
    "✓ Referencias hacia historial_poblacion controladas"
);


print(
    "✓ Referencias hacia casos_enfermedades controladas"
);


print(
    "✓ Referencia opcional hacia analisis_ia controlada"
);


print(
    "✓ escenario_id preparado para integración futura"
);


print(
    "✓ Índices históricos configurados"
);


print(
    "✓ Migración registrada"
);


print("");