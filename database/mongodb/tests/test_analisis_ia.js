// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - analisis_ia
//
// Migración asociada:
//   009_create_analisis_ia
//
// Verifica:
//   - documento válido
//   - campos obligatorios
//   - modelo y versión
//   - rango de probabilidad 0..1
//   - preprocesamiento
//   - arrays de referencias
//   - uniqueItems
//   - escenario_id opcional
//   - rechazo de propiedades adicionales
//   - ausencia de campos de actualización
//   - comportamiento histórico
//   - índices no únicos
//   - referencias lógicas
//   - coherencia temporal mediante control DBA
//
// IMPORTANTE:
//
// analisis_ia es una colección histórica.
//
// Cada ejecución:
//     → nuevo documento
//
// No debe utilizarse updated_at / updated_by para modificar
// resultados históricos.
//
// $jsonSchema valida estructura y tipos.
//
// Reglas como:
//     fecha_inicio <= fecha_fin
//
// requieren controles adicionales porque $jsonSchema no
// compara directamente campos entre sí.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" PRUEBAS DBA - ANALISIS_IA");
print("====================================================");
print("");

let pruebasExitosas = 0;
let pruebasFallidas = 0;


// ============================================================
// 1. FUNCIONES AUXILIARES
// ============================================================

function pruebaDebeFuncionar(
    nombre,
    operacion
) {

    try {

        operacion();

        print(
            "✓ OK: " +
            nombre
        );

        pruebasExitosas++;

    } catch (e) {

        print(
            "✗ FALLÓ: " +
            nombre +
            " - " +
            e.message
        );

        pruebasFallidas++;
    }
}


function pruebaDebeFallar(
    nombre,
    operacion,
    codigoEsperado
) {

    try {

        operacion();

        print(
            "✗ FALLÓ: " +
            nombre +
            " - la operación fue aceptada."
        );

        pruebasFallidas++;

    } catch (e) {

        if (
            e.code === codigoEsperado
        ) {

            print(
                "✓ OK: " +
                nombre +
                " - código " +
                e.code
            );

            pruebasExitosas++;

        } else {

            print(
                "✗ FALLÓ: " +
                nombre +
                " - código recibido: " +
                e.code +
                ", esperado: " +
                codigoEsperado
            );

            pruebasFallidas++;
        }
    }
}


// ============================================================
// 2. OBTENER REFERENCIAS REALES
// ============================================================

const albergueTest =
    db.albergues.findOne({
        activo:
            true
    });


if (!albergueTest) {

    throw new Error(
        "No existe un albergue activo para ejecutar las pruebas."
    );
}


const usuarioTest =
    db.usuarios.findOne({
        active:
            true
    });


if (!usuarioTest) {

    throw new Error(
        "No existe un usuario activo para ejecutar las pruebas."
    );
}


const ALBERGUE_TEST_ID =
    albergueTest._id;


const USUARIO_TEST_ID =
    usuarioTest._id;


const MODELO_TEST =
    "prueba_dba_analisis_ia";


print(
    "✓ Albergue de prueba disponible."
);


print(
    "✓ Usuario de prueba disponible."
);


// ============================================================
// 3. LIMPIEZA PREVIA
// ============================================================

db.analisis_ia.deleteMany({

    "modelo.nombre":
        MODELO_TEST
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// 4. CONSTRUCTOR DE DOCUMENTO VÁLIDO
// ============================================================

function crearAnalisisValido(
    fechaEjecucion
) {

    return {

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha_ejecucion:
            fechaEjecucion,

        periodo_analizado: {

            fecha_inicio:
                ISODate(
                    "2099-09-01T05:00:00.000Z"
                ),

            fecha_fin:
                ISODate(
                    "2099-09-30T05:00:00.000Z"
                )
        },

        modelo: {

            nombre:
                MODELO_TEST,

            version:
                "1.0.0"
        },

        datos_entrada: {

            registros_diarios_ids:
                [],

            condiciones_sanitarias_ids:
                [],

            casos_enfermedades_ids:
                [],

            intervenciones_ids:
                [],

            metricas_albergue_ids:
                []
        },

        preprocesamiento: {

            registros_considerados:
                NumberInt(100),

            registros_descartados:
                NumberInt(2),

            datos_faltantes: [

                {
                    campo:
                        "cloro_residual",

                    cantidad:
                        NumberInt(2),

                    tratamiento:
                        "imputacion_media"
                }
            ]
        },

        resultado: {

            probabilidad_riesgo:
                0.73
        },

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
            new Date()
    };
}


// ============================================================
// 5. PRUEBAS
// ============================================================


// ------------------------------------------------------------
// PRUEBA 1
// Documento válido
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Documento analisis_ia válido",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-01T13:00:00.000Z"
                )
            );


        const resultado =
            db.analisis_ia.insertOne(
                documento
            );


        if (
            !resultado.acknowledged
        ) {

            throw new Error(
                "MongoDB no confirmó la inserción."
            );
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 2
// albergue_id obligatorio
// ------------------------------------------------------------

pruebaDebeFallar(
    "albergue_id es obligatorio",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-02T13:00:00.000Z"
                )
            );


        delete documento.albergue_id;


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 3
// fecha_ejecucion obligatoria
// ------------------------------------------------------------

pruebaDebeFallar(
    "fecha_ejecucion es obligatoria",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-03T13:00:00.000Z"
                )
            );


        delete documento.fecha_ejecucion;


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 4
// periodo_analizado obligatorio
// ------------------------------------------------------------

pruebaDebeFallar(
    "periodo_analizado es obligatorio",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-04T13:00:00.000Z"
                )
            );


        delete documento.periodo_analizado;


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 5
// nombre de modelo no vacío
// ------------------------------------------------------------

pruebaDebeFallar(
    "modelo.nombre no puede estar vacío",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-05T13:00:00.000Z"
                )
            );


        documento.modelo.nombre =
            "";


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 6
// probabilidad menor que cero
// ------------------------------------------------------------

pruebaDebeFallar(
    "probabilidad_riesgo menor que 0 es rechazada",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-06T13:00:00.000Z"
                )
            );


        documento.resultado
            .probabilidad_riesgo =
                -0.01;


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 7
// probabilidad mayor que uno
// ------------------------------------------------------------

pruebaDebeFallar(
    "probabilidad_riesgo mayor que 1 es rechazada",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-07T13:00:00.000Z"
                )
            );


        documento.resultado
            .probabilidad_riesgo =
                1.01;


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 8
// registrado_por debe ser ObjectId
// ------------------------------------------------------------

pruebaDebeFallar(
    "registrado_por debe ser ObjectId",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-08T13:00:00.000Z"
                )
            );


        documento.registrado_por =
            "usuario_invalido";


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 9
// registros_descartados no negativo
// ------------------------------------------------------------

pruebaDebeFallar(
    "registros_descartados negativo es rechazado",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-09T13:00:00.000Z"
                )
            );


        documento.preprocesamiento
            .registros_descartados =
                NumberInt(-1);


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 10
// uniqueItems en referencias
// ------------------------------------------------------------

pruebaDebeFallar(
    "No permite ObjectId duplicados en arrays de entrada",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-10T13:00:00.000Z"
                )
            );


        const idDuplicado =
            new ObjectId();


        documento.datos_entrada
            .metricas_albergue_ids =
                [
                    idDuplicado,
                    idDuplicado
                ];


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 11
// additionalProperties false
// ------------------------------------------------------------

pruebaDebeFallar(
    "Propiedades adicionales son rechazadas",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-11T13:00:00.000Z"
                )
            );


        documento.campo_no_permitido =
            "valor";


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 12
// updated_at no pertenece al contrato histórico
// ------------------------------------------------------------

pruebaDebeFallar(
    "updated_at es rechazado por el modelo histórico",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-12T13:00:00.000Z"
                )
            );


        documento.updated_at =
            new Date();


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 13
// escenario_id opcional
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "escenario_id es opcional",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-13T13:00:00.000Z"
                )
            );


        if (
            documento.escenario_id !==
            undefined
        ) {

            throw new Error(
                "El documento base no debería incluir escenario_id."
            );
        }


        db.analisis_ia.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 14
// escenario_id debe ser ObjectId si existe
// ------------------------------------------------------------

pruebaDebeFallar(
    "escenario_id debe ser ObjectId",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-14T13:00:00.000Z"
                )
            );


        documento.escenario_id =
            "escenario_invalido";


        db.analisis_ia.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 15
// Colección histórica
// ------------------------------------------------------------
//
// Deben poder existir varias ejecuciones del mismo modelo,
// mismo albergue e incluso misma fecha de ejecución.
//
// No existe índice UNIQUE para estas combinaciones.
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Permite múltiples ejecuciones históricas del mismo modelo",
    function () {

        const fecha =
            ISODate(
                "2099-10-15T13:00:00.000Z"
            );


        const documento1 =
            crearAnalisisValido(
                fecha
            );


        const documento2 =
            crearAnalisisValido(
                fecha
            );


        documento1.resultado
            .probabilidad_riesgo =
                0.65;


        documento2.resultado
            .probabilidad_riesgo =
                0.71;


        const resultado =
            db.analisis_ia.insertMany(
                [
                    documento1,
                    documento2
                ]
            );


        if (
            Object.keys(
                resultado.insertedIds
            ).length !== 2
        ) {

            throw new Error(
                "No se insertaron las dos ejecuciones históricas."
            );
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 16
// Índices
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Índices de analisis_ia son correctos y no únicos",
    function () {

        const indices =
            db.analisis_ia
                .getIndexes();


        const indiceAlbergue =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_analisis_ia_albergue_fecha"
                    );
                }
            );


        if (!indiceAlbergue) {

            throw new Error(
                "No existe ix_analisis_ia_albergue_fecha."
            );
        }


        if (
            indiceAlbergue.unique === true
        ) {

            throw new Error(
                "ix_analisis_ia_albergue_fecha no debe ser UNIQUE."
            );
        }


        if (
            indiceAlbergue.key.albergue_id !== 1 ||
            indiceAlbergue.key.fecha_ejecucion !== -1
        ) {

            throw new Error(
                "Definición incorrecta de ix_analisis_ia_albergue_fecha."
            );
        }


        const indiceModelo =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_analisis_ia_modelo_version_fecha"
                    );
                }
            );


        if (!indiceModelo) {

            throw new Error(
                "No existe ix_analisis_ia_modelo_version_fecha."
            );
        }


        if (
            indiceModelo.unique === true
        ) {

            throw new Error(
                "ix_analisis_ia_modelo_version_fecha no debe ser UNIQUE."
            );
        }


        if (
            indiceModelo.key["modelo.nombre"] !== 1 ||
            indiceModelo.key["modelo.version"] !== 1 ||
            indiceModelo.key.fecha_ejecucion !== -1
        ) {

            throw new Error(
                "Definición incorrecta de ix_analisis_ia_modelo_version_fecha."
            );
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 17
// Detección de albergue huérfano
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Detección de albergue_id huérfano mediante $lookup",
    function () {

        let albergueHuerfanoId =
            new ObjectId();


        while (
            db.albergues.countDocuments({
                _id:
                    albergueHuerfanoId
            }) > 0
        ) {

            albergueHuerfanoId =
                new ObjectId();
        }


        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-17T13:00:00.000Z"
                )
            );


        documento.albergue_id =
            albergueHuerfanoId;


        let insertedId =
            null;


        try {

            const insercion =
                db.analisis_ia.insertOne(
                    documento
                );


            insertedId =
                insercion.insertedId;


            const huerfanos =
                db.analisis_ia.aggregate([

                    {
                        $match: {

                            _id:
                                insertedId
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


            if (
                huerfanos.length !== 1
            ) {

                throw new Error(
                    "No se detectó el albergue huérfano."
                );
            }

        } finally {

            if (insertedId) {

                db.analisis_ia.deleteOne({
                    _id:
                        insertedId
                });
            }
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 18
// Detección de usuario huérfano
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Detección de registrado_por huérfano mediante $lookup",
    function () {

        let usuarioHuerfanoId =
            new ObjectId();


        while (
            db.usuarios.countDocuments({
                _id:
                    usuarioHuerfanoId
            }) > 0
        ) {

            usuarioHuerfanoId =
                new ObjectId();
        }


        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-18T13:00:00.000Z"
                )
            );


        documento.registrado_por =
            usuarioHuerfanoId;


        let insertedId =
            null;


        try {

            const insercion =
                db.analisis_ia.insertOne(
                    documento
                );


            insertedId =
                insercion.insertedId;


            const huerfanos =
                db.analisis_ia.aggregate([

                    {
                        $match: {

                            _id:
                                insertedId
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


            if (
                huerfanos.length !== 1
            ) {

                throw new Error(
                    "No se detectó el usuario huérfano."
                );
            }

        } finally {

            if (insertedId) {

                db.analisis_ia.deleteOne({
                    _id:
                        insertedId
                });
            }
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 19
// Detección de referencia de entrada huérfana
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Detección de referencia huérfana en metricas_albergue_ids",
    function () {

        let referenciaHuerfanaId =
            new ObjectId();


        while (
            db.metricas_albergue.countDocuments({
                _id:
                    referenciaHuerfanaId
            }) > 0
        ) {

            referenciaHuerfanaId =
                new ObjectId();
        }


        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-19T13:00:00.000Z"
                )
            );


        documento.datos_entrada
            .metricas_albergue_ids =
                [
                    referenciaHuerfanaId
                ];


        let insertedId =
            null;


        try {

            const insercion =
                db.analisis_ia.insertOne(
                    documento
                );


            insertedId =
                insercion.insertedId;


            const referenciasHuerfanas =
                db.analisis_ia.aggregate([

                    {
                        $match: {

                            _id:
                                insertedId
                        }
                    },

                    {
                        $unwind: {

                            path:
                                "$datos_entrada.metricas_albergue_ids"
                        }
                    },

                    {
                        $lookup: {

                            from:
                                "metricas_albergue",

                            localField:
                                "datos_entrada.metricas_albergue_ids",

                            foreignField:
                                "_id",

                            as:
                                "metrica_ref"
                        }
                    },

                    {
                        $match: {

                            "metrica_ref.0": {

                                $exists:
                                    false
                            }
                        }
                    }

                ]).toArray();


            if (
                referenciasHuerfanas.length !== 1
            ) {

                throw new Error(
                    "No se detectó la referencia huérfana."
                );
            }

        } finally {

            if (insertedId) {

                db.analisis_ia.deleteOne({
                    _id:
                        insertedId
                });
            }
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 20
// Coherencia temporal
// ------------------------------------------------------------
//
// $jsonSchema acepta estructuralmente dos campos Date.
//
// El control DBA debe detectar:
//
// fecha_inicio > fecha_fin
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Detección de periodo_analizado temporalmente inválido",
    function () {

        const documento =
            crearAnalisisValido(
                ISODate(
                    "2099-10-20T13:00:00.000Z"
                )
            );


        documento.periodo_analizado = {

            fecha_inicio:
                ISODate(
                    "2099-09-30T05:00:00.000Z"
                ),

            fecha_fin:
                ISODate(
                    "2099-09-01T05:00:00.000Z"
                )
        };


        let insertedId =
            null;


        try {

            const insercion =
                db.analisis_ia.insertOne(
                    documento
                );


            insertedId =
                insercion.insertedId;


            const invalidos =
                db.analisis_ia.find(

                    {

                        _id:
                            insertedId,

                        $expr: {

                            $gt: [

                                "$periodo_analizado.fecha_inicio",
                                "$periodo_analizado.fecha_fin"
                            ]
                        }
                    }

                ).toArray();


            if (
                invalidos.length !== 1
            ) {

                throw new Error(
                    "El control temporal no detectó el periodo inválido."
                );
            }

        } finally {

            if (insertedId) {

                db.analisis_ia.deleteOne({
                    _id:
                        insertedId
                });
            }
        }
    }
);


// ============================================================
// 6. LIMPIEZA FINAL
// ============================================================

try {

    db.analisis_ia.deleteMany({

        "modelo.nombre":
            MODELO_TEST
    });


    print("");
    print(
        "✓ OK: limpieza de análisis IA temporales"
    );

} catch (e) {

    print("");
    print(
        "✗ ERROR DURANTE LIMPIEZA: " +
        e.message
    );

    pruebasFallidas++;
}


// ============================================================
// 7. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" RESULTADO");
print("====================================================");

print(
    "Pruebas exitosas: " +
    pruebasExitosas
);

print(
    "Pruebas fallidas: " +
    pruebasFallidas
);


if (
    pruebasFallidas > 0
) {

    throw new Error(
        "Existen pruebas fallidas en analisis_ia."
    );
}


print("");
print(
    "✓ TODAS LAS PRUEBAS DE ANALISIS_IA " +
    "FINALIZARON CORRECTAMENTE."
);

print("");