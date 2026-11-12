// ============================================================
// SEMÁFORO VITAL
// Migración:
//   009_create_analisis_ia
//
// Colección histórica de resultados de análisis IA.
//
// Cada ejecución genera un documento nuevo.
// No se deben sobrescribir resultados anteriores.
//
// escenario_id queda opcional hasta implementar escenarios.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

const MIGRATION_VERSION =
    "009_create_analisis_ia";


print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 009");
print(" ANALISIS IA");
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
    "condiciones_sanitarias",
    "casos_enfermedades",
    "intervenciones",
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

const migracionAnterior =
    db.schema_migrations.countDocuments({
        version:
            "008_create_metricas_albergue"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 008_create_metricas_albergue " +
        "debe estar aplicada exactamente una vez antes " +
        "de ejecutar la 009."
    );
}


print(
    "✓ Migración 008 verificada."
);


// ============================================================
// 3. VALIDADOR
// ============================================================

const validatorAnalisisIA = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de análisis IA",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha_ejecucion",
            "periodo_analizado",
            "modelo",
            "datos_entrada",
            "preprocesamiento",
            "resultado",
            "registrado_por",
            "created_at"
        ],

        properties: {

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
                    "Fecha y hora de ejecución del modelo"
            },


            // =================================================
            // PERIODO ANALIZADO
            // =================================================

            periodo_analizado: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "fecha_inicio",
                    "fecha_fin"
                ],

                properties: {

                    fecha_inicio: {

                        bsonType:
                            "date"
                    },


                    fecha_fin: {

                        bsonType:
                            "date"
                    }
                }
            },


            // =================================================
            // MODELO IA
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
            // DATOS DE ENTRADA
            // =================================================

            datos_entrada: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "registros_diarios_ids",
                    "condiciones_sanitarias_ids",
                    "casos_enfermedades_ids",
                    "intervenciones_ids",
                    "metricas_albergue_ids"
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
                        }
                    },


                    condiciones_sanitarias_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        }
                    },


                    casos_enfermedades_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        }
                    },


                    intervenciones_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        }
                    },


                    metricas_albergue_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        }
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
                    "registros_descartados",
                    "datos_faltantes"
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


                    datos_faltantes: {

                        bsonType:
                            "array",

                        items: {

                            bsonType:
                                "object",

                            additionalProperties:
                                false,

                            required: [
                                "campo",
                                "cantidad",
                                "tratamiento"
                            ],

                            properties: {

                                campo: {

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


                                tratamiento: {

                                    bsonType:
                                        "string",

                                    minLength:
                                        1
                                }
                            }
                        }
                    }
                }
            },


            // =================================================
            // RESULTADO
            // =================================================

            resultado: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "probabilidad_riesgo"
                ],

                properties: {

                    probabilidad_riesgo: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        maximum:
                            1
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
                    "date"
            }
        }
    }
};


// ============================================================
// 4. CREAR O ACTUALIZAR COLECCIÓN
// ============================================================

const existeAnalisisIA =
    db
        .getCollectionNames()
        .includes(
            "analisis_ia"
        );


if (
    !existeAnalisisIA
) {

    db.createCollection(
        "analisis_ia",
        {

            validator:
                validatorAnalisisIA,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );


    print(
        "✓ Colección creada: analisis_ia"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "analisis_ia",

            validator:
                validatorAnalisisIA,

            validationLevel:
                "strict",

            validationAction:
                "error"
        });


    if (
        resultadoCollMod.ok !== 1
    ) {

        throw new Error(
            "No fue posible actualizar el validator de analisis_ia."
        );
    }


    print(
        "✓ Validador actualizado: analisis_ia"
    );
}


// ============================================================
// 5. VERIFICAR COHERENCIA TEMPORAL
// ============================================================
//
// REGLA:
//
// periodo_analizado.fecha_inicio
//     <=
// periodo_analizado.fecha_fin
//
// CORRECCIÓN:
//
// La proyección se pasa como segundo parámetro de find().
// Esto mantiene compatibilidad con mongosh 2.13.0.
// ============================================================

const periodosInvalidos =
    db.analisis_ia.find(

        {

            $expr: {

                $gt: [

                    "$periodo_analizado.fecha_inicio",
                    "$periodo_analizado.fecha_fin"
                ]
            }
        },

        {

            _id:
                1,

            albergue_id:
                1,

            periodo_analizado:
                1
        }

    ).toArray();


if (
    periodosInvalidos.length > 0
) {

    print("");
    print(
        "Se detectaron análisis con periodos inválidos:"
    );

    printjson(
        periodosInvalidos
    );


    throw new Error(
        "Existen documentos en analisis_ia con " +
        "fecha_inicio posterior a fecha_fin."
    );
}


print(
    "✓ Coherencia temporal existente verificada."
);


// ============================================================
// 6. ÍNDICES
// ============================================================


// ------------------------------------------------------------
// 6.1 Albergue + fecha de ejecución
// ------------------------------------------------------------

db.analisis_ia.createIndex(
    {

        albergue_id:
            1,

        fecha_ejecucion:
            -1
    },

    {

        name:
            "ix_analisis_ia_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_analisis_ia_albergue_fecha"
);


// ------------------------------------------------------------
// 6.2 Modelo + versión + fecha
// ------------------------------------------------------------

db.analisis_ia.createIndex(
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
            "ix_analisis_ia_modelo_version_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_analisis_ia_modelo_version_fecha"
);


// ============================================================
// 7. REFERENCIA albergue_id
// ============================================================

const analisisConAlbergueHuerfano =
    db.analisis_ia.aggregate([

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
    analisisConAlbergueHuerfano.length > 0
) {

    print("");
    print(
        "Se detectaron referencias huérfanas hacia albergues:"
    );

    printjson(
        analisisConAlbergueHuerfano
    );


    throw new Error(
        "Existen documentos analisis_ia asociados " +
        "a albergues inexistentes."
    );
}


print(
    "✓ Sin referencias huérfanas en albergue_id."
);


// ============================================================
// 8. REFERENCIA registrado_por
// ============================================================

const analisisConUsuarioHuerfano =
    db.analisis_ia.aggregate([

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
    analisisConUsuarioHuerfano.length > 0
) {

    print("");
    print(
        "Se detectaron referencias huérfanas hacia usuarios:"
    );

    printjson(
        analisisConUsuarioHuerfano
    );


    throw new Error(
        "Existen documentos analisis_ia con " +
        "registrado_por inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en registrado_por."
);


// ============================================================
// 9. FUNCIÓN DE VALIDACIÓN REFERENCIAL
// ============================================================

function validarReferenciasArray(
    rutaCampo,
    coleccionDestino
) {

    const referenciasHuerfanas =
        db.analisis_ia.aggregate([

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
// 10. REFERENCIAS DE DATOS DE ENTRADA
// ============================================================

validarReferenciasArray(
    "datos_entrada.registros_diarios_ids",
    "registros_diarios"
);


validarReferenciasArray(
    "datos_entrada.condiciones_sanitarias_ids",
    "condiciones_sanitarias"
);


validarReferenciasArray(
    "datos_entrada.casos_enfermedades_ids",
    "casos_enfermedades"
);


validarReferenciasArray(
    "datos_entrada.intervenciones_ids",
    "intervenciones"
);


validarReferenciasArray(
    "datos_entrada.metricas_albergue_ids",
    "metricas_albergue"
);


// ============================================================
// 11. escenario_id
// ============================================================
//
// La colección escenarios todavía no existe.
//
// Actualmente solo se controla:
//
// escenario_id → ObjectId
//
// Posteriormente:
//
// analisis_ia.escenario_id
//     → escenarios._id
//
// ============================================================

print(
    "✓ escenario_id preparado como referencia futura opcional."
);


// ============================================================
// 12. REGISTRAR MIGRACIÓN
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
                "Crear colección analisis_ia con trazabilidad de modelo, entradas y preprocesamiento",

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
// 13. VERIFICAR REGISTRO ÚNICO
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
        "La migración 009 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 14. VERIFICAR ÍNDICES
// ============================================================

const indicesAnalisisIA =
    db.analisis_ia
        .getIndexes();


// ------------------------------------------------------------
// Índice albergue + fecha
// ------------------------------------------------------------

const indiceAlbergueFecha =
    indicesAnalisisIA.find(
        function (indice) {

            return (
                indice.name ===
                "ix_analisis_ia_albergue_fecha"
            );
        }
    );


if (
    !indiceAlbergueFecha
) {

    throw new Error(
        "No existe el índice ix_analisis_ia_albergue_fecha."
    );
}


if (
    indiceAlbergueFecha.unique === true
) {

    throw new Error(
        "ix_analisis_ia_albergue_fecha no debe ser UNIQUE."
    );
}


if (
    indiceAlbergueFecha.key.albergue_id !== 1 ||
    indiceAlbergueFecha.key.fecha_ejecucion !== -1
) {

    throw new Error(
        "La definición de ix_analisis_ia_albergue_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_analisis_ia_albergue_fecha confirmado."
);


// ------------------------------------------------------------
// Índice modelo + versión + fecha
// ------------------------------------------------------------

const indiceModeloVersionFecha =
    indicesAnalisisIA.find(
        function (indice) {

            return (
                indice.name ===
                "ix_analisis_ia_modelo_version_fecha"
            );
        }
    );


if (
    !indiceModeloVersionFecha
) {

    throw new Error(
        "No existe el índice " +
        "ix_analisis_ia_modelo_version_fecha."
    );
}


if (
    indiceModeloVersionFecha.unique === true
) {

    throw new Error(
        "ix_analisis_ia_modelo_version_fecha " +
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
        "ix_analisis_ia_modelo_version_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_analisis_ia_modelo_version_fecha confirmado."
);


// ============================================================
// 15. CONTRATO IMPLEMENTADO
// ============================================================

print("");
print("----------------------------------------------------");
print(" CONTRATO IMPLEMENTADO");
print("----------------------------------------------------");

print(
    "✓ Cada ejecución IA genera un documento histórico"
);

print(
    "✓ Modelo identificado por nombre y versión"
);

print(
    "✓ Periodo analizado registrado"
);

print(
    "✓ Trazabilidad de documentos de entrada"
);

print(
    "✓ Información de preprocesamiento registrada"
);

print(
    "✓ Probabilidad de riesgo entre 0 y 1"
);

print(
    "✓ escenario_id opcional"
);


// ============================================================
// 16. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" MIGRACIÓN 009 FINALIZADA");
print("====================================================");

print(
    "✓ Colección analisis_ia disponible"
);

print(
    "✓ Validator $jsonSchema strict"
);

print(
    "✓ Modelo y versión registrados"
);

print(
    "✓ Periodo analizado registrado"
);

print(
    "✓ Trazabilidad de datos de entrada"
);

print(
    "✓ Preprocesamiento documentado"
);

print(
    "✓ Probabilidad de riesgo limitada entre 0 y 1"
);

print(
    "✓ Referencia hacia albergues controlada"
);

print(
    "✓ Referencia hacia usuarios controlada"
);

print(
    "✓ Referencias de entrada controladas"
);

print(
    "✓ escenario_id preparado para integración futura"
);

print(
    "✓ Índices configurados"
);

print(
    "✓ Migración registrada"
);

print("");