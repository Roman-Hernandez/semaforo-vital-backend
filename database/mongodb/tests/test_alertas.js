// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - alertas
//
// Migración asociada:
//   012_create_alertas
//
// Cobertura:
//   - documento válido
//   - campos obligatorios
//   - nivel_riesgo
//   - tipo_alerta
//   - mensaje
//   - ciclo de vida activa / inactiva
//   - visibilidad publica
//   - datos_origen
//   - uniqueItems
//   - additionalProperties false
//   - trazabilidad
//   - referencias huérfanas
//   - coherencia de albergue
//   - índices históricos
//   - migración registrada
//   - decisiones funcionales deliberadamente abiertas
//
// IMPORTANTE:
//
// alertas conserva histórico.
//
// Una alerta puede actualizar:
//
//   activa
//   updated_at
//   updated_by
//
// pero NO debe eliminarse como operación funcional ordinaria.
//
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" SEMÁFORO VITAL");
print(" PRUEBAS DBA - alertas");
print("====================================================");
print("");

let pruebasExitosas = 0;
let pruebasFallidas = 0;


// ============================================================
// 1. UTILIDADES
// ============================================================

function prueba(
    nombre,
    funcion
) {

    try {

        funcion();

        pruebasExitosas++;

        print(
            "✓ " +
            nombre
        );

    } catch (error) {

        pruebasFallidas++;

        print(
            "✗ " +
            nombre
        );

        print(
            "  " +
            error.message
        );
    }
}


function assertTrue(
    condicion,
    mensaje
) {

    if (!condicion) {

        throw new Error(
            mensaje
        );
    }
}


function esperarErrorValidacion(
    funcion
) {

    let errorDetectado =
        false;

    try {

        funcion();

    } catch (error) {

        if (
            error.code === 121
        ) {

            errorDetectado =
                true;

        } else {

            throw error;
        }
    }


    if (!errorDetectado) {

        throw new Error(
            "Se esperaba error de validación MongoDB 121."
        );
    }
}


// ============================================================
// 2. PRECONDICIONES
// ============================================================

const coleccionesRequeridas = [

    "alertas",
    "usuarios",
    "albergues",
    "condiciones_sanitarias",
    "casos_enfermedades",
    "predicciones_sir",
    "schema_migrations"
];


coleccionesRequeridas.forEach(

    function (coleccion) {

        assertTrue(
            db
                .getCollectionNames()
                .includes(
                    coleccion
                ),
            "No existe la colección requerida: " +
            coleccion
        );
    }
);


const alberguePrueba =
    db.albergues.findOne({});


assertTrue(
    alberguePrueba !== null,
    "Se requiere al menos un albergue."
);


const usuarioPrueba =
    db.usuarios.findOne({});


assertTrue(
    usuarioPrueba !== null,
    "Se requiere al menos un usuario."
);


const ALBERGUE_TEST_ID =
    alberguePrueba._id;


const USUARIO_TEST_ID =
    usuarioPrueba._id;


// ObjectId intencionalmente diferente.
//
// Se utiliza para construir documentos de origen pertenecientes
// a otro albergue y validar la detección DBA.
//
// No es necesario que exista físicamente en albergues.

const ALBERGUE_OTRO_ID =
    new ObjectId();


const MARCADOR =
    "DBA_TEST_ALERTAS";


const PREFIJO_MENSAJE =
    "[DBA-TEST-ALERTAS]";


// ============================================================
// 3. LIMPIEZA PREVIA
// ============================================================

db.alertas.deleteMany({

    mensaje: {

        $regex:
            "^\\[DBA-TEST-ALERTAS\\]"
    }
});


db.condiciones_sanitarias.deleteMany({

    fuente_datos:
        MARCADOR
});


db.casos_enfermedades.deleteMany({

    fuente_datos:
        MARCADOR
});


db.predicciones_sir.deleteMany({

    "modelo.nombre":
        MARCADOR
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// 4. CREAR DATOS DE ORIGEN CONTROLADOS
// ============================================================
//
// Se crean documentos válidos para:
//
// A. mismo albergue de la alerta
// B. albergue diferente
//
// Esto permite probar integridad y coherencia sin depender
// del contenido funcional actual de Atlas.
//
// ============================================================


// ------------------------------------------------------------
// 4.1 Condiciones sanitarias
// ------------------------------------------------------------

function crearCondicionSanitaria(
    albergueId,
    fecha
) {

    return {

        albergue_id:
            albergueId,

        fecha:
            fecha,

        agua_potable_disponible:
            true,

        banos_disponibles:
            NumberInt(
                5
            ),

        estado_higiene:
            "prueba_dba",

        estado_saneamiento:
            "prueba_dba",

        fuente_datos:
            MARCADOR,

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
            new Date()
    };
}


const condicionMismoAlbergue =
    db.condiciones_sanitarias.insertOne(

        crearCondicionSanitaria(

            ALBERGUE_TEST_ID,

            ISODate(
                "2099-08-01T05:00:00.000Z"
            )
        )
    );


const condicionOtroAlbergue =
    db.condiciones_sanitarias.insertOne(

        crearCondicionSanitaria(

            ALBERGUE_OTRO_ID,

            ISODate(
                "2099-08-02T05:00:00.000Z"
            )
        )
    );


// ------------------------------------------------------------
// 4.2 Casos de enfermedades
// ------------------------------------------------------------

function crearCasoEnfermedad(
    albergueId,
    fecha
) {

    return {

        albergue_id:
            albergueId,

        fecha:
            fecha,

        enfermedad:
            "EDA",

        cantidad_casos_activos:
            NumberInt(
                5
            ),

        fuente_datos:
            MARCADOR,

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
            new Date()
    };
}


const casoMismoAlbergue =
    db.casos_enfermedades.insertOne(

        crearCasoEnfermedad(

            ALBERGUE_TEST_ID,

            ISODate(
                "2099-08-01T05:00:00.000Z"
            )
        )
    );


const casoOtroAlbergue =
    db.casos_enfermedades.insertOne(

        crearCasoEnfermedad(

            ALBERGUE_OTRO_ID,

            ISODate(
                "2099-08-02T05:00:00.000Z"
            )
        )
    );


// ------------------------------------------------------------
// 4.3 Predicciones SIR
// ------------------------------------------------------------

function crearPrediccionSIR(
    albergueId,
    fecha,
    version
) {

    return {

        albergue_id:
            albergueId,

        fecha_ejecucion:
            fecha,

        enfermedad:
            "EDA",

        publica:
            false,

        modelo: {

            nombre:
                MARCADOR,

            version:
                version
        },

        parametros: {

            beta:
                0.35,

            gamma:
                0.10,

            condiciones_iniciales: {

                susceptibles:
                    NumberInt(
                        95
                    ),

                infectados:
                    NumberInt(
                        5
                    ),

                recuperados:
                    NumberInt(
                        0
                    )
            },

            horizonte_dias:
                NumberInt(
                    10
                ),

            metodo_numerico:
                "prueba_dba"
        },

        datos_entrada: {

            historial_poblacion_ids:
                [],

            casos_enfermedades_ids:
                []
        },

        preprocesamiento: {

            registros_considerados:
                NumberInt(
                    0
                ),

            registros_descartados:
                NumberInt(
                    0
                )
        },

        trayectoria: [

            {

                dia:
                    NumberInt(
                        0
                    ),

                susceptibles:
                    95,

                infectados:
                    5,

                recuperados:
                    0
            }
        ],

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
            new Date()
    };
}


const prediccionMismoAlbergue =
    db.predicciones_sir.insertOne(

        crearPrediccionSIR(

            ALBERGUE_TEST_ID,

            ISODate(
                "2099-08-01T13:00:00.000Z"
            ),

            "alertas-test-a"
        )
    );


const prediccionOtroAlbergue =
    db.predicciones_sir.insertOne(

        crearPrediccionSIR(

            ALBERGUE_OTRO_ID,

            ISODate(
                "2099-08-02T13:00:00.000Z"
            ),

            "alertas-test-b"
        )
    );


print(
    "✓ Datos auxiliares de origen creados."
);


// ============================================================
// 5. FACTORÍA DE ALERTA VÁLIDA
// ============================================================

function documentoValido(
    fecha
) {

    return {

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha_alerta:
            fecha,

        nivel_riesgo:
            "amarillo",

        tipo_alerta:
            MARCADOR,

        mensaje:
            PREFIJO_MENSAJE +
            " Alerta temporal de prueba DBA.",

        activa:
            true,

        publica:
            false,

        datos_origen:
            {},

        fuente_datos:
            MARCADOR,

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
            new Date()
    };
}


// ============================================================
// 6. PRUEBAS
// ============================================================


// ============================================================
// 1. DOCUMENTO VÁLIDO
// ============================================================

prueba(
    "1. Permite insertar una alerta válida",

    function () {

        const resultado =
            db.alertas.insertOne(

                documentoValido(

                    ISODate(
                        "2099-08-03T13:00:00.000Z"
                    )
                )
            );


        assertTrue(
            resultado.acknowledged === true,
            "MongoDB no confirmó la inserción."
        );
    }
);


// ============================================================
// 2. albergue_id OBLIGATORIO
// ============================================================

prueba(
    "2. Rechaza alerta sin albergue_id",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-04T13:00:00.000Z"
                )
            );


        delete documento.albergue_id;


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 3. fecha_alerta OBLIGATORIA
// ============================================================

prueba(
    "3. Rechaza alerta sin fecha_alerta",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-05T13:00:00.000Z"
                )
            );


        delete documento.fecha_alerta;


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 4. nivel_riesgo OBLIGATORIO
// ============================================================

prueba(
    "4. Rechaza alerta sin nivel_riesgo",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-06T13:00:00.000Z"
                )
            );


        delete documento.nivel_riesgo;


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 5. NIVEL DE RIESGO FUERA DEL ENUM
// ============================================================

prueba(
    "5. Rechaza nivel_riesgo fuera de verde/amarillo/rojo",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-07T13:00:00.000Z"
                )
            );


        documento.nivel_riesgo =
            "naranja";


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 6. tipo_alerta NO VACÍO
// ============================================================

prueba(
    "6. Rechaza tipo_alerta vacío",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-08T13:00:00.000Z"
                )
            );


        documento.tipo_alerta =
            "";


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 7. mensaje NO VACÍO
// ============================================================

prueba(
    "7. Rechaza mensaje vacío",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-09T13:00:00.000Z"
                )
            );


        documento.mensaje =
            "";


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 8. activa DEBE SER Boolean
// ============================================================

prueba(
    "8. Rechaza activa con tipo diferente a Boolean",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-10T13:00:00.000Z"
                )
            );


        documento.activa =
            "true";


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 9. publica OBLIGATORIA
// ============================================================

prueba(
    "9. Rechaza alerta sin publica",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-11T13:00:00.000Z"
                )
            );


        delete documento.publica;


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 10. publica DEBE SER Boolean
// ============================================================

prueba(
    "10. Rechaza publica con tipo diferente a Boolean",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-12T13:00:00.000Z"
                )
            );


        documento.publica =
            "false";


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 11. datos_origen OBLIGATORIO
// ============================================================

prueba(
    "11. Rechaza alerta sin datos_origen",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-13T13:00:00.000Z"
                )
            );


        delete documento.datos_origen;


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 12. fuente_datos NO VACÍA
// ============================================================

prueba(
    "12. Rechaza fuente_datos vacía",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-14T13:00:00.000Z"
                )
            );


        documento.fuente_datos =
            "";


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 13. registrado_por DEBE SER ObjectId
// ============================================================

prueba(
    "13. Rechaza registrado_por que no sea ObjectId",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-15T13:00:00.000Z"
                )
            );


        documento.registrado_por =
            "usuario_invalido";


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 14. created_at OBLIGATORIO
// ============================================================

prueba(
    "14. Rechaza alerta sin created_at",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-16T13:00:00.000Z"
                )
            );


        delete documento.created_at;


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 15. additionalProperties FALSE
// ============================================================

prueba(
    "15. Rechaza propiedades adicionales en alerta",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-17T13:00:00.000Z"
                )
            );


        documento.campo_no_permitido =
            "NO DEBE EXISTIR";


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 16. additionalProperties FALSE EN datos_origen
// ============================================================

prueba(
    "16. Rechaza propiedades adicionales en datos_origen",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-18T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .campo_no_permitido =
                new ObjectId();


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 17. uniqueItems EN casos_enfermedades_ids
// ============================================================

prueba(
    "17. Rechaza casos_enfermedades_ids duplicados",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-19T13:00:00.000Z"
                )
            );


        const idDuplicado =
            casoMismoAlbergue.insertedId;


        documento
            .datos_origen
            .casos_enfermedades_ids =
                [

                    idDuplicado,
                    idDuplicado
                ];


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 18. TRAZABILIDAD DE ACTUALIZACIÓN
// ============================================================

prueba(
    "18. Permite updated_at y updated_by",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-20T13:00:00.000Z"
                )
            );


        documento.updated_at =
            new Date();


        documento.updated_by =
            USUARIO_TEST_ID;


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const guardado =
            db.alertas.findOne({

                _id:
                    resultado.insertedId
            });


        assertTrue(
            guardado.updated_at instanceof Date,
            "updated_at no fue almacenado como Date."
        );


        assertTrue(
            guardado.updated_by.equals(
                USUARIO_TEST_ID
            ),
            "updated_by no fue almacenado correctamente."
        );
    }
);


// ============================================================
// 19. CICLO DE VIDA ACTIVA → INACTIVA
// ============================================================

prueba(
    "19. Permite cerrar una alerta sin eliminar el histórico",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-21T13:00:00.000Z"
                )
            );


        documento.mensaje =
            PREFIJO_MENSAJE +
            " Ciclo de vida activa/inactiva.";


        const resultado =
            db.alertas.insertOne(
                documento
            );


        db.alertas.updateOne(

            {

                _id:
                    resultado.insertedId
            },

            {

                $set: {

                    activa:
                        false,

                    updated_at:
                        new Date(),

                    updated_by:
                        USUARIO_TEST_ID
                }
            }
        );


        const guardado =
            db.alertas.findOne({

                _id:
                    resultado.insertedId
            });


        assertTrue(
            guardado !== null,
            "La alerta histórica desapareció."
        );


        assertTrue(
            guardado.activa === false,
            "La alerta no cambió a inactiva."
        );


        assertTrue(
            guardado.updated_at instanceof Date,
            "No quedó trazabilidad de actualización."
        );
    }
);


// ============================================================
// 20. ALERTA PÚBLICA
// ============================================================

prueba(
    "20. Permite marcar una alerta como pública",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-22T13:00:00.000Z"
                )
            );


        documento.publica =
            true;


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const guardado =
            db.alertas.findOne({

                _id:
                    resultado.insertedId
            });


        assertTrue(
            guardado.publica === true,
            "La alerta pública no fue almacenada correctamente."
        );
    }
);


// ============================================================
// 21. ORIGEN: CONDICIÓN SANITARIA VÁLIDA
// ============================================================

prueba(
    "21. Permite condicion_sanitaria_id del mismo albergue",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-23T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .condicion_sanitaria_id =
                condicionMismoAlbergue.insertedId;


        const resultado =
            db.alertas.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "No fue posible insertar la alerta."
        );
    }
);


// ============================================================
// 22. ORIGEN: CASOS VÁLIDOS
// ============================================================

prueba(
    "22. Permite casos_enfermedades_ids del mismo albergue",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-24T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .casos_enfermedades_ids =
                [

                    casoMismoAlbergue.insertedId
                ];


        const resultado =
            db.alertas.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "No fue posible insertar la alerta."
        );
    }
);


// ============================================================
// 23. ORIGEN: PREDICCIÓN SIR VÁLIDA
// ============================================================

prueba(
    "23. Permite prediccion_sir_id del mismo albergue",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-25T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .prediccion_sir_id =
                prediccionMismoAlbergue.insertedId;


        const resultado =
            db.alertas.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "No fue posible insertar la alerta."
        );
    }
);


// ============================================================
// 24. COMBINACIÓN DE ORÍGENES
// ============================================================

prueba(
    "24. Permite combinar los tres tipos de origen",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-26T13:00:00.000Z"
                )
            );


        documento.datos_origen = {

            condicion_sanitaria_id:
                condicionMismoAlbergue.insertedId,

            casos_enfermedades_ids: [

                casoMismoAlbergue.insertedId
            ],

            prediccion_sir_id:
                prediccionMismoAlbergue.insertedId
        };


        const resultado =
            db.alertas.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "No fue posible almacenar múltiples orígenes."
        );
    }
);


// ============================================================
// 25. condicion_sanitaria_id HUÉRFANO
// ============================================================

prueba(
    "25. Detecta condicion_sanitaria_id huérfano",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-27T13:00:00.000Z"
                )
            );


        const referenciaHuerfana =
            new ObjectId();


        documento
            .datos_origen
            .condicion_sanitaria_id =
                referenciaHuerfana;


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const huerfanos =
            db.alertas.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
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
                            "referencia"
                    }
                },

                {

                    $match: {

                        "referencia.0": {

                            $exists:
                                false
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó condicion_sanitaria_id huérfano."
        );
    }
);


// ============================================================
// 26. casos_enfermedades_ids HUÉRFANO
// ============================================================

prueba(
    "26. Detecta caso_enfermedad_id huérfano",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-28T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .casos_enfermedades_ids =
                [

                    new ObjectId()
                ];


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const huerfanos =
            db.alertas.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
                    }
                },

                {

                    $unwind:
                        "$datos_origen.casos_enfermedades_ids"
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
                            "referencia"
                    }
                },

                {

                    $match: {

                        "referencia.0": {

                            $exists:
                                false
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó referencia huérfana en casos_enfermedades_ids."
        );
    }
);


// ============================================================
// 27. prediccion_sir_id HUÉRFANO
// ============================================================

prueba(
    "27. Detecta prediccion_sir_id huérfano",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-29T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .prediccion_sir_id =
                new ObjectId();


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const huerfanos =
            db.alertas.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
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
                            "referencia"
                    }
                },

                {

                    $match: {

                        "referencia.0": {

                            $exists:
                                false
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó prediccion_sir_id huérfano."
        );
    }
);


// ============================================================
// 28. albergue_id HUÉRFANO
// ============================================================

prueba(
    "28. Detecta albergue_id huérfano",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-30T13:00:00.000Z"
                )
            );


        documento.albergue_id =
            new ObjectId();


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const huerfanos =
            db.alertas.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
                    }
                },

                {

                    $lookup: {

                        from:
                            "albergues",

                        localField:
                            "albergue_id",

                        foreignField:
                            "_id",

                        as:
                            "referencia"
                    }
                },

                {

                    $match: {

                        "referencia.0": {

                            $exists:
                                false
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó albergue_id huérfano."
        );
    }
);


// ============================================================
// 29. registrado_por HUÉRFANO
// ============================================================

prueba(
    "29. Detecta registrado_por huérfano",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-08-31T13:00:00.000Z"
                )
            );


        documento.registrado_por =
            new ObjectId();


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const huerfanos =
            db.alertas.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
                    }
                },

                {

                    $lookup: {

                        from:
                            "usuarios",

                        localField:
                            "registrado_por",

                        foreignField:
                            "_id",

                        as:
                            "referencia"
                    }
                },

                {

                    $match: {

                        "referencia.0": {

                            $exists:
                                false
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó registrado_por huérfano."
        );
    }
);


// ============================================================
// 30. updated_by HUÉRFANO
// ============================================================

prueba(
    "30. Detecta updated_by huérfano",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-09-01T13:00:00.000Z"
                )
            );


        documento.updated_at =
            new Date();


        documento.updated_by =
            new ObjectId();


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const huerfanos =
            db.alertas.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
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
                            "referencia"
                    }
                },

                {

                    $match: {

                        "referencia.0": {

                            $exists:
                                false
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó updated_by huérfano."
        );
    }
);


// ============================================================
// 31. CONDICIÓN SANITARIA DE OTRO ALBERGUE
// ============================================================

prueba(
    "31. Detecta condicion_sanitaria_id perteneciente a otro albergue",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-09-02T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .condicion_sanitaria_id =
                condicionOtroAlbergue.insertedId;


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const inconsistencias =
            db.alertas.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
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
                            "origen"
                    }
                },

                {

                    $unwind:
                        "$origen"
                },

                {

                    $match: {

                        $expr: {

                            $ne: [

                                "$albergue_id",
                                "$origen.albergue_id"
                            ]
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            inconsistencias.length === 1,
            "No se detectó la condición sanitaria de otro albergue."
        );
    }
);


// ============================================================
// 32. CASO DE ENFERMEDAD DE OTRO ALBERGUE
// ============================================================

prueba(
    "32. Detecta casos_enfermedades_ids pertenecientes a otro albergue",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-09-03T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .casos_enfermedades_ids =
                [

                    casoOtroAlbergue.insertedId
                ];


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const inconsistencias =
            db.alertas.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
                    }
                },

                {

                    $unwind:
                        "$datos_origen.casos_enfermedades_ids"
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
                            "origen"
                    }
                },

                {

                    $unwind:
                        "$origen"
                },

                {

                    $match: {

                        $expr: {

                            $ne: [

                                "$albergue_id",
                                "$origen.albergue_id"
                            ]
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            inconsistencias.length === 1,
            "No se detectó el caso de otro albergue."
        );
    }
);


// ============================================================
// 33. PREDICCIÓN SIR DE OTRO ALBERGUE
// ============================================================

prueba(
    "33. Detecta prediccion_sir_id perteneciente a otro albergue",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-09-04T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .prediccion_sir_id =
                prediccionOtroAlbergue.insertedId;


        const resultado =
            db.alertas.insertOne(
                documento
            );


        const inconsistencias =
            db.alertas.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
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
                            "origen"
                    }
                },

                {

                    $unwind:
                        "$origen"
                },

                {

                    $match: {

                        $expr: {

                            $ne: [

                                "$albergue_id",
                                "$origen.albergue_id"
                            ]
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            inconsistencias.length === 1,
            "No se detectó la predicción SIR de otro albergue."
        );
    }
);


// ============================================================
// 34. ÍNDICES
// ============================================================

prueba(
    "34. Los tres índices de alertas son correctos y no únicos",

    function () {

        const indices =
            db.alertas
                .getIndexes();


        const albergueFecha =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_alertas_albergue_fecha"
                    );
                }
            );


        assertTrue(
            albergueFecha !== undefined,
            "No existe ix_alertas_albergue_fecha."
        );


        assertTrue(
            albergueFecha.unique !== true,
            "ix_alertas_albergue_fecha no debe ser UNIQUE."
        );


        assertTrue(
            albergueFecha.key.albergue_id === 1 &&
            albergueFecha.key.fecha_alerta === -1,
            "Definición incorrecta de ix_alertas_albergue_fecha."
        );


        const albergueActivaFecha =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_alertas_albergue_activa_fecha"
                    );
                }
            );


        assertTrue(
            albergueActivaFecha !== undefined,
            "No existe ix_alertas_albergue_activa_fecha."
        );


        assertTrue(
            albergueActivaFecha.unique !== true,
            "ix_alertas_albergue_activa_fecha no debe ser UNIQUE."
        );


        assertTrue(
            albergueActivaFecha.key.albergue_id === 1 &&
            albergueActivaFecha.key.activa === 1 &&
            albergueActivaFecha.key.fecha_alerta === -1,
            "Definición incorrecta de ix_alertas_albergue_activa_fecha."
        );


        const nivelActiva =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_alertas_nivel_activa"
                    );
                }
            );


        assertTrue(
            nivelActiva !== undefined,
            "No existe ix_alertas_nivel_activa."
        );


        assertTrue(
            nivelActiva.unique !== true,
            "ix_alertas_nivel_activa no debe ser UNIQUE."
        );


        assertTrue(
            nivelActiva.key.nivel_riesgo === 1 &&
            nivelActiva.key.activa === 1,
            "Definición incorrecta de ix_alertas_nivel_activa."
        );
    }
);


// ============================================================
// 35. MIGRACIÓN 012
// ============================================================

prueba(
    "35. Migración 012 registrada exactamente una vez",

    function () {

        const cantidad =
            db.schema_migrations.countDocuments({

                version:
                    "012_create_alertas"
            });


        assertTrue(
            cantidad === 1,
            "La migración 012 debe estar registrada exactamente una vez."
        );
    }
);


// ============================================================
// 36. MÚLTIPLES ALERTAS MISMA FECHA
// ============================================================

prueba(
    "36. Permite múltiples alertas del mismo albergue y fecha",

    function () {

        const fecha =
            ISODate(
                "2099-09-05T13:00:00.000Z"
            );


        const documentoA =
            documentoValido(
                fecha
            );


        const documentoB =
            documentoValido(
                fecha
            );


        documentoA.mensaje =
            PREFIJO_MENSAJE +
            " Evento simultáneo A.";


        documentoB.mensaje =
            PREFIJO_MENSAJE +
            " Evento simultáneo B.";


        const resultado =
            db.alertas.insertMany([

                documentoA,
                documentoB
            ]);


        assertTrue(
            Object.keys(
                resultado.insertedIds
            ).length === 2,
            "No se insertaron las dos alertas."
        );
    }
);


// ============================================================
// 37. TRES NIVELES DE RIESGO
// ============================================================

prueba(
    "37. Acepta verde, amarillo y rojo",

    function () {

        const niveles = [

            "verde",
            "amarillo",
            "rojo"
        ];


        niveles.forEach(

            function (
                nivel,
                indice
            ) {

                const documento =
                    documentoValido(

                        ISODate(
                            "2099-09-0" +
                            String(
                                6 + indice
                            ) +
                            "T13:00:00.000Z"
                        )
                    );


                documento.nivel_riesgo =
                    nivel;


                documento.mensaje =
                    PREFIJO_MENSAJE +
                    " Nivel " +
                    nivel;


                db.alertas.insertOne(
                    documento
                );
            }
        );


        const cantidad =
            db.alertas.countDocuments({

                mensaje: {

                    $regex:
                        "^\\[DBA-TEST-ALERTAS\\] Nivel "
                }
            });


        assertTrue(
            cantidad === 3,
            "No se almacenaron los tres niveles de riesgo."
        );
    }
);


// ============================================================
// 38. NO EXISTE prioridad EN EL CONTRATO
// ============================================================

prueba(
    "38. Rechaza prioridad porque no pertenece al contrato aprobado",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-09-09T13:00:00.000Z"
                )
            );


        documento.prioridad =
            "alta";


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 39. analisis_ia_id NO EXISTE TODAVÍA EN datos_origen
// ============================================================

prueba(
    "39. Rechaza analisis_ia_id porque no pertenece al contrato actual",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-09-10T13:00:00.000Z"
                )
            );


        documento
            .datos_origen
            .analisis_ia_id =
                new ObjectId();


        esperarErrorValidacion(
            function () {

                db.alertas.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 40. CATÁLOGOS ABIERTOS
// ============================================================

prueba(
    "40. tipo_alerta y fuente_datos permanecen como String abierto",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-09-11T13:00:00.000Z"
                )
            );


        documento.tipo_alerta =
            "tipo_temporal_no_catalogado";


        documento.fuente_datos =
            "fuente_temporal_no_catalogada";


        documento.mensaje =
            PREFIJO_MENSAJE +
            " Validación de catálogos abiertos.";


        const resultado =
            db.alertas.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "Se aplicó un catálogo cerrado no aprobado."
        );
    }
);


// ============================================================
// 7. LIMPIEZA FINAL
// ============================================================

try {

    db.alertas.deleteMany({

        mensaje: {

            $regex:
                "^\\[DBA-TEST-ALERTAS\\]"
        }
    });


    db.condiciones_sanitarias.deleteMany({

        fuente_datos:
            MARCADOR
    });


    db.casos_enfermedades.deleteMany({

        fuente_datos:
            MARCADOR
    });


    db.predicciones_sir.deleteMany({

        "modelo.nombre":
            MARCADOR
    });


    print("");
    print(
        "✓ Limpieza final completada."
    );

} catch (error) {

    pruebasFallidas++;

    print("");
    print(
        "✗ Error durante limpieza: " +
        error.message
    );
}


// ============================================================
// 8. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" RESULTADO PRUEBAS DBA - alertas");
print("====================================================");


print(
    "Pruebas exitosas: " +
    pruebasExitosas
);


print(
    "Pruebas fallidas: " +
    pruebasFallidas
);


print("");


if (
    pruebasFallidas > 0
) {

    throw new Error(
        "La suite DBA de alertas presentó fallos."
    );
}


if (
    pruebasExitosas !== 40
) {

    throw new Error(
        "Se esperaban exactamente 40 pruebas exitosas."
    );
}


print(
    "✓ Suite DBA alertas finalizada correctamente."
);

print("");