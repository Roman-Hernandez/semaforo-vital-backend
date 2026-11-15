// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - predicciones_sir
//
// Migración asociada:
//   011_create_predicciones_sir
//
// Cobertura:
//   - documento válido
//   - campos obligatorios
//   - parámetros beta / gamma
//   - condiciones iniciales
//   - horizonte temporal
//   - método numérico
//   - trayectoria SIR
//   - uniqueItems en referencias
//   - additionalProperties false
//   - naturaleza histórica
//   - escenario_id opcional
//   - analisis_ia_id opcional
//   - índices no únicos
//   - migración registrada
//   - referencias huérfanas detectables
//
// IMPORTANTE:
//
// predicciones_sir es histórica:
//
//   1 ejecución SIR
//   =
//   1 documento nuevo
//
// No utiliza updated_at / updated_by.
//
// Las reglas matemáticas avanzadas del modelo SIR no forman
// todavía parte del validator.
//
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" SEMÁFORO VITAL");
print(" PRUEBAS DBA - predicciones_sir");
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

    let errorDetectado = false;

    try {

        funcion();

    } catch (error) {

        if (
            error.code === 121
        ) {

            errorDetectado = true;

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

assertTrue(
    db
        .getCollectionNames()
        .includes(
            "predicciones_sir"
        ),
    "No existe la colección predicciones_sir."
);


assertTrue(
    db
        .getCollectionNames()
        .includes(
            "historial_poblacion"
        ),
    "No existe la colección historial_poblacion."
);


assertTrue(
    db
        .getCollectionNames()
        .includes(
            "casos_enfermedades"
        ),
    "No existe la colección casos_enfermedades."
);


assertTrue(
    db
        .getCollectionNames()
        .includes(
            "analisis_ia"
        ),
    "No existe la colección analisis_ia."
);


// ============================================================
// 3. OBTENER REFERENCIAS REALES
// ============================================================

const alberguePrueba =
    db.albergues.findOne({});


assertTrue(
    alberguePrueba !== null,
    "Se requiere al menos un albergue para ejecutar las pruebas."
);


const usuarioPrueba =
    db.usuarios.findOne({});


assertTrue(
    usuarioPrueba !== null,
    "Se requiere al menos un usuario para ejecutar las pruebas."
);


const ALBERGUE_TEST_ID =
    alberguePrueba._id;


const USUARIO_TEST_ID =
    usuarioPrueba._id;


const MODELO_TEST =
    "prueba_dba_predicciones_sir";


print(
    "✓ Albergue de prueba disponible."
);


print(
    "✓ Usuario de prueba disponible."
);


// ============================================================
// 4. LIMPIEZA PREVIA
// ============================================================

db.predicciones_sir.deleteMany({

    "modelo.nombre":
        MODELO_TEST
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// 5. FACTORÍA DE DOCUMENTO VÁLIDO
// ============================================================

function documentoValido(
    fechaEjecucion
) {

    return {

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha_ejecucion:
            fechaEjecucion,

        enfermedad:
            "EDA",

        publica:
            false,

        modelo: {

            nombre:
                MODELO_TEST,

            version:
                "1.0.0"
        },

        parametros: {

            beta:
                0.35,

            gamma:
                0.10,

            condiciones_iniciales: {

                susceptibles:
                    NumberInt(
                        90
                    ),

                infectados:
                    NumberInt(
                        10
                    ),

                recuperados:
                    NumberInt(
                        0
                    )
            },

            horizonte_dias:
                NumberInt(
                    30
                ),

            metodo_numerico:
                "euler"
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
                    10
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
                    90,

                infectados:
                    10,

                recuperados:
                    0
            },

            {

                dia:
                    NumberInt(
                        1
                    ),

                susceptibles:
                    87.5,

                infectados:
                    11.5,

                recuperados:
                    1
            }
        ],

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
    "1. Permite insertar un documento SIR válido",

    function () {

        const resultado =
            db.predicciones_sir.insertOne(

                documentoValido(

                    ISODate(
                        "2099-11-01T13:00:00.000Z"
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
    "2. Rechaza documento sin albergue_id",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-02T13:00:00.000Z"
                )
            );


        delete documento.albergue_id;


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 3. fecha_ejecucion OBLIGATORIA
// ============================================================

prueba(
    "3. Rechaza documento sin fecha_ejecucion",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-03T13:00:00.000Z"
                )
            );


        delete documento.fecha_ejecucion;


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 4. enfermedad OBLIGATORIA
// ============================================================

prueba(
    "4. Rechaza documento sin enfermedad",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-04T13:00:00.000Z"
                )
            );


        delete documento.enfermedad;


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 5. enfermedad NO VACÍA
// ============================================================

prueba(
    "5. Rechaza enfermedad vacía",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-05T13:00:00.000Z"
                )
            );


        documento.enfermedad =
            "";


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 6. publica OBLIGATORIO Y BOOLEAN
// ============================================================

prueba(
    "6. Rechaza publica con tipo diferente a Boolean",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-06T13:00:00.000Z"
                )
            );


        documento.publica =
            "false";


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 7. beta NO NEGATIVO
// ============================================================

prueba(
    "7. Rechaza beta negativo",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-07T13:00:00.000Z"
                )
            );


        documento.parametros.beta =
            -0.01;


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 8. gamma NO NEGATIVO
// ============================================================

prueba(
    "8. Rechaza gamma negativo",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-08T13:00:00.000Z"
                )
            );


        documento.parametros.gamma =
            -0.01;


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 9. CONDICIONES INICIALES Int32
// ============================================================

prueba(
    "9. Rechaza infectados iniciales Double",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-09T13:00:00.000Z"
                )
            );


        documento
            .parametros
            .condiciones_iniciales
            .infectados =
                10.5;


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 10. CONDICIONES INICIALES NO NEGATIVAS
// ============================================================

prueba(
    "10. Rechaza susceptibles iniciales negativos",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-10T13:00:00.000Z"
                )
            );


        documento
            .parametros
            .condiciones_iniciales
            .susceptibles =
                NumberInt(
                    -1
                );


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 11. horizonte_dias >= 1
// ============================================================

prueba(
    "11. Rechaza horizonte_dias igual a cero",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-11T13:00:00.000Z"
                )
            );


        documento
            .parametros
            .horizonte_dias =
                NumberInt(
                    0
                );


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 12. metodo_numerico NO VACÍO
// ============================================================

prueba(
    "12. Rechaza metodo_numerico vacío",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-12T13:00:00.000Z"
                )
            );


        documento
            .parametros
            .metodo_numerico =
                "";


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 13. TRAYECTORIA NO VACÍA
// ============================================================

prueba(
    "13. Rechaza trayectoria vacía",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-13T13:00:00.000Z"
                )
            );


        documento.trayectoria =
            [];


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 14. DÍA DE TRAYECTORIA Int32 Y NO NEGATIVO
// ============================================================

prueba(
    "14. Rechaza día negativo en trayectoria",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-14T13:00:00.000Z"
                )
            );


        documento
            .trayectoria[0]
            .dia =
                NumberInt(
                    -1
                );


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 15. VALORES SIR NO NEGATIVOS
// ============================================================

prueba(
    "15. Rechaza infectados negativos en trayectoria",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-15T13:00:00.000Z"
                )
            );


        documento
            .trayectoria[0]
            .infectados =
                -1;


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 16. TRAYECTORIA ADMITE DECIMALES
// ============================================================

prueba(
    "16. Permite valores decimales en trayectoria",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-16T13:00:00.000Z"
                )
            );


        documento
            .trayectoria[0]
            .susceptibles =
                89.75;


        documento
            .trayectoria[0]
            .infectados =
                9.75;


        documento
            .trayectoria[0]
            .recuperados =
                0.50;


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "No se aceptaron valores decimales en trayectoria."
        );
    }
);


// ============================================================
// 17. uniqueItems EN historial_poblacion_ids
// ============================================================

prueba(
    "17. Rechaza referencias poblacionales duplicadas",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-17T13:00:00.000Z"
                )
            );


        const idDuplicado =
            new ObjectId();


        documento
            .datos_entrada
            .historial_poblacion_ids =
                [

                    idDuplicado,
                    idDuplicado
                ];


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 18. uniqueItems EN casos_enfermedades_ids
// ============================================================

prueba(
    "18. Rechaza referencias de casos duplicadas",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-18T13:00:00.000Z"
                )
            );


        const idDuplicado =
            new ObjectId();


        documento
            .datos_entrada
            .casos_enfermedades_ids =
                [

                    idDuplicado,
                    idDuplicado
                ];


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 19. PROPIEDADES ADICIONALES
// ============================================================

prueba(
    "19. Rechaza propiedades adicionales",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-19T13:00:00.000Z"
                )
            );


        documento.campo_no_permitido =
            "NO DEBE EXISTIR";


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 20. updated_at NO FORMA PARTE DEL MODELO HISTÓRICO
// ============================================================

prueba(
    "20. Rechaza updated_at en predicción histórica",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-20T13:00:00.000Z"
                )
            );


        documento.updated_at =
            new Date();


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 21. escenario_id OPCIONAL
// ============================================================

prueba(
    "21. escenario_id es opcional",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-21T13:00:00.000Z"
                )
            );


        assertTrue(
            documento.escenario_id === undefined,
            "El documento base no debería incluir escenario_id."
        );


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "No fue posible insertar sin escenario_id."
        );
    }
);


// ============================================================
// 22. escenario_id DEBE SER ObjectId
// ============================================================

prueba(
    "22. Rechaza escenario_id que no sea ObjectId",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-22T13:00:00.000Z"
                )
            );


        documento.escenario_id =
            "escenario_invalido";


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 23. analisis_ia_id OPCIONAL
// ============================================================

prueba(
    "23. analisis_ia_id es opcional",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-23T13:00:00.000Z"
                )
            );


        assertTrue(
            documento
                .datos_entrada
                .analisis_ia_id === undefined,
            "El documento base no debería incluir analisis_ia_id."
        );


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "No fue posible insertar sin analisis_ia_id."
        );
    }
);


// ============================================================
// 24. analisis_ia_id DEBE SER ObjectId
// ============================================================

prueba(
    "24. Rechaza analisis_ia_id que no sea ObjectId",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-11-24T13:00:00.000Z"
                )
            );


        documento
            .datos_entrada
            .analisis_ia_id =
                "analisis_invalido";


        esperarErrorValidacion(
            function () {

                db.predicciones_sir.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 25. NATURALEZA HISTÓRICA
// ============================================================
//
// Deben poder persistirse dos ejecuciones independientes con:
//
// mismo albergue
// misma enfermedad
// mismo modelo
// misma versión
// misma fecha_ejecucion
//
// porque no existe un índice UNIQUE para la ejecución.
// ============================================================

prueba(
    "25. Permite múltiples ejecuciones históricas equivalentes",

    function () {

        const fecha =
            ISODate(
                "2099-11-25T13:00:00.000Z"
            );


        const documentoA =
            documentoValido(
                fecha
            );


        const documentoB =
            documentoValido(
                fecha
            );


        documentoA.parametros.beta =
            0.30;


        documentoB.parametros.beta =
            0.40;


        const resultado =
            db.predicciones_sir.insertMany([

                documentoA,
                documentoB
            ]);


        assertTrue(
            Object.keys(
                resultado.insertedIds
            ).length === 2,
            "No se insertaron las dos ejecuciones históricas."
        );
    }
);


// ============================================================
// 26. ÍNDICES
// ============================================================

prueba(
    "26. Los tres índices SIR son correctos y no únicos",

    function () {

        const indices =
            db.predicciones_sir
                .getIndexes();


        const indiceAlbergueFecha =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_predicciones_sir_albergue_fecha"
                    );
                }
            );


        assertTrue(
            indiceAlbergueFecha !== undefined,
            "No existe ix_predicciones_sir_albergue_fecha."
        );


        assertTrue(
            indiceAlbergueFecha.unique !== true,
            "ix_predicciones_sir_albergue_fecha no debe ser UNIQUE."
        );


        assertTrue(
            indiceAlbergueFecha.key.albergue_id === 1 &&
            indiceAlbergueFecha.key.fecha_ejecucion === -1,
            "Definición incorrecta de ix_predicciones_sir_albergue_fecha."
        );


        const indiceEnfermedad =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_predicciones_sir_albergue_enfermedad_fecha"
                    );
                }
            );


        assertTrue(
            indiceEnfermedad !== undefined,
            "No existe ix_predicciones_sir_albergue_enfermedad_fecha."
        );


        assertTrue(
            indiceEnfermedad.unique !== true,
            "ix_predicciones_sir_albergue_enfermedad_fecha no debe ser UNIQUE."
        );


        assertTrue(
            indiceEnfermedad.key.albergue_id === 1 &&
            indiceEnfermedad.key.enfermedad === 1 &&
            indiceEnfermedad.key.fecha_ejecucion === -1,
            "Definición incorrecta del índice por enfermedad."
        );


        const indiceModelo =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_predicciones_sir_modelo_version_fecha"
                    );
                }
            );


        assertTrue(
            indiceModelo !== undefined,
            "No existe ix_predicciones_sir_modelo_version_fecha."
        );


        assertTrue(
            indiceModelo.unique !== true,
            "ix_predicciones_sir_modelo_version_fecha no debe ser UNIQUE."
        );


        assertTrue(
            indiceModelo.key["modelo.nombre"] === 1 &&
            indiceModelo.key["modelo.version"] === 1 &&
            indiceModelo.key.fecha_ejecucion === -1,
            "Definición incorrecta del índice por modelo."
        );
    }
);


// ============================================================
// 27. MIGRACIÓN 011 REGISTRADA
// ============================================================

prueba(
    "27. Migración 011 registrada exactamente una vez",

    function () {

        const cantidad =
            db.schema_migrations.countDocuments({

                version:
                    "011_create_predicciones_sir"
            });


        assertTrue(
            cantidad === 1,
            "La migración 011 debe estar registrada exactamente una vez."
        );
    }
);


// ============================================================
// 28. ALBERGUE HUÉRFANO
// ============================================================

prueba(
    "28. Detecta albergue_id huérfano mediante $lookup",

    function () {

        const albergueHuerfano =
            new ObjectId();


        const documento =
            documentoValido(

                ISODate(
                    "2099-11-28T13:00:00.000Z"
                )
            );


        documento.albergue_id =
            albergueHuerfano;


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        const huerfanos =
            db.predicciones_sir.aggregate([

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
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó el albergue huérfano."
        );
    }
);


// ============================================================
// 29. USUARIO HUÉRFANO
// ============================================================

prueba(
    "29. Detecta registrado_por huérfano mediante $lookup",

    function () {

        const usuarioHuerfano =
            new ObjectId();


        const documento =
            documentoValido(

                ISODate(
                    "2099-11-29T13:00:00.000Z"
                )
            );


        documento.registrado_por =
            usuarioHuerfano;


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        const huerfanos =
            db.predicciones_sir.aggregate([

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
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó registrado_por huérfano."
        );
    }
);


// ============================================================
// 30. REFERENCIA historial_poblacion HUÉRFANA
// ============================================================

prueba(
    "30. Detecta historial_poblacion_id huérfano",

    function () {

        const referenciaHuerfana =
            new ObjectId();


        const documento =
            documentoValido(

                ISODate(
                    "2099-11-30T13:00:00.000Z"
                )
            );


        documento
            .datos_entrada
            .historial_poblacion_ids =
                [
                    referenciaHuerfana
                ];


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        const huerfanos =
            db.predicciones_sir.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
                    }
                },

                {

                    $unwind:
                        "$datos_entrada.historial_poblacion_ids"
                },

                {

                    $lookup: {

                        from:
                            "historial_poblacion",

                        localField:
                            "datos_entrada.historial_poblacion_ids",

                        foreignField:
                            "_id",

                        as:
                            "referencia_ref"
                    }
                },

                {

                    $match: {

                        "referencia_ref.0": {

                            $exists:
                                false
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó la referencia huérfana de historial_poblacion."
        );
    }
);


// ============================================================
// 31. REFERENCIA casos_enfermedades HUÉRFANA
// ============================================================

prueba(
    "31. Detecta casos_enfermedades_id huérfano",

    function () {

        const referenciaHuerfana =
            new ObjectId();


        const documento =
            documentoValido(

                ISODate(
                    "2099-12-01T13:00:00.000Z"
                )
            );


        documento
            .datos_entrada
            .casos_enfermedades_ids =
                [
                    referenciaHuerfana
                ];


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        const huerfanos =
            db.predicciones_sir.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
                    }
                },

                {

                    $unwind:
                        "$datos_entrada.casos_enfermedades_ids"
                },

                {

                    $lookup: {

                        from:
                            "casos_enfermedades",

                        localField:
                            "datos_entrada.casos_enfermedades_ids",

                        foreignField:
                            "_id",

                        as:
                            "referencia_ref"
                    }
                },

                {

                    $match: {

                        "referencia_ref.0": {

                            $exists:
                                false
                        }
                    }
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó la referencia huérfana de casos_enfermedades."
        );
    }
);


// ============================================================
// 32. REFERENCIA analisis_ia HUÉRFANA
// ============================================================

prueba(
    "32. Detecta analisis_ia_id huérfano",

    function () {

        const referenciaHuerfana =
            new ObjectId();


        const documento =
            documentoValido(

                ISODate(
                    "2099-12-02T13:00:00.000Z"
                )
            );


        documento
            .datos_entrada
            .analisis_ia_id =
                referenciaHuerfana;


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        const huerfanos =
            db.predicciones_sir.aggregate([

                {

                    $match: {

                        _id:
                            resultado.insertedId
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
                }

            ]).toArray();


        assertTrue(
            huerfanos.length === 1,
            "No se detectó analisis_ia_id huérfano."
        );
    }
);


// ============================================================
// 33. observaciones DE PREPROCESAMIENTO OPCIONAL
// ============================================================

prueba(
    "33. Permite observaciones opcionales de preprocesamiento",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-12-03T13:00:00.000Z"
                )
            );


        documento
            .preprocesamiento
            .observaciones =
                "Datos normalizados antes de ejecutar el modelo.";


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "No se aceptaron observaciones de preprocesamiento."
        );
    }
);


// ============================================================
// 34. beta y gamma PUEDEN SUPERAR 1
// ============================================================
//
// El contrato únicamente exige:
//
// beta >= 0
// gamma >= 0
//
// No existe maximum: 1.
// ============================================================

prueba(
    "34. beta y gamma pueden superar 1",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-12-04T13:00:00.000Z"
                )
            );


        documento.parametros.beta =
            1.25;


        documento.parametros.gamma =
            1.10;


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "Se aplicó un límite máximo no definido para beta o gamma."
        );
    }
);


// ============================================================
// 35. NO SE IMPONE S + I + R = POBLACIÓN
// ============================================================
//
// Esta prueba documenta deliberadamente que el JSON Schema
// no impone todavía conservación matemática.
//
// No significa que la lógica del modelo deba ignorarla.
//
// ============================================================

prueba(
    "35. JSON Schema no impone todavía S + I + R = población",

    function () {

        const documento =
            documentoValido(

                ISODate(
                    "2099-12-05T13:00:00.000Z"
                )
            );


        documento
            .parametros
            .condiciones_iniciales
            .susceptibles =
                NumberInt(
                    200
                );


        documento
            .parametros
            .condiciones_iniciales
            .infectados =
                NumberInt(
                    50
                );


        documento
            .parametros
            .condiciones_iniciales
            .recuperados =
                NumberInt(
                    25
                );


        const resultado =
            db.predicciones_sir.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "El validator está imponiendo una regla matemática no aprobada."
        );
    }
);


// ============================================================
// LIMPIEZA FINAL
// ============================================================

db.predicciones_sir.deleteMany({

    "modelo.nombre":
        MODELO_TEST
});


print(
    "✓ Limpieza final completada."
);


// ============================================================
// RESULTADOS
// ============================================================

print("");
print("====================================================");
print(" RESULTADO PRUEBAS DBA - predicciones_sir");
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
        "La suite DBA de predicciones_sir presentó fallos."
    );
}


if (
    pruebasExitosas !== 35
) {

    throw new Error(
        "Se esperaban exactamente 35 pruebas exitosas."
    );
}


print(
    "✓ Suite DBA predicciones_sir finalizada correctamente."
);

print("");