// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - metricas_albergue
//
// Migración asociada:
//   008_create_metricas_albergue
//
// Verifica:
//   - documento válido
//   - Bucket Pattern
//   - Computed Pattern
//   - campos obligatorios
//   - tipos BSON
//   - rangos numéricos
//   - mediciones no vacías
//   - porcentaje de ocupación > 100 permitido
//   - additionalProperties: false
//   - índice único albergue + fecha_bucket
//   - estado_actual opcional
//   - estructura válida de estado_actual
//   - referencias lógicas hacia albergues
//   - consistencia del documento de prueba
//
// IMPORTANTE:
//
// 1 documento = 1 albergue + 1 fecha_bucket.
//
// registros_diarios:
//     consolidado oficial diario.
//
// metricas_albergue:
//     telemetría intradía + valores precalculados.
//
// estado_actual:
//     snapshot persistente opcional en esta etapa.
//
// Las referencias hacia alertas y estados_semaforo todavía
// no pueden verificarse referencialmente porque esas
// colecciones serán creadas posteriormente.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" PRUEBAS DBA - METRICAS_ALBERGUE");
print(" BUCKET PATTERN + COMPUTED PATTERN");
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
// 2. OBTENER ALBERGUE REAL
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


const ALBERGUE_TEST_ID =
    albergueTest._id;


print(
    "✓ Albergue de prueba disponible."
);


// ============================================================
// 3. FECHAS TEMPORALES
// ============================================================
//
// Se utilizan fechas de 2099 para evitar colisiones con
// información funcional real.
//
// El bucket representa medianoche operativa Colombia.
//
// Ejemplo:
// 2099-09-01 00:00 America/Bogota
// =
// 2099-09-01T05:00:00.000Z
// ============================================================

const FECHA_INICIO_PRUEBAS =
    ISODate(
        "2099-09-01T05:00:00.000Z"
    );


const FECHA_FIN_PRUEBAS =
    ISODate(
        "2099-10-01T05:00:00.000Z"
    );


// ============================================================
// 4. LIMPIEZA PREVIA
// ============================================================

db.metricas_albergue.deleteMany({

    albergue_id:
        ALBERGUE_TEST_ID,

    fecha_bucket: {

        $gte:
            FECHA_INICIO_PRUEBAS,

        $lt:
            FECHA_FIN_PRUEBAS
    }
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// 5. CONSTRUCTOR DE BUCKET VÁLIDO
// ============================================================

function crearBucketValido(
    fechaBucket
) {

    const fechaMedicion1 =
        new Date(
            fechaBucket.getTime() +
            (
                8 *
                60 *
                60 *
                1000
            )
        );


    const fechaMedicion2 =
        new Date(
            fechaBucket.getTime() +
            (
                8 *
                60 *
                60 *
                1000
            ) +
            (
                15 *
                60 *
                1000
            )
        );


    return {

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha_bucket:
            fechaBucket,

        mediciones: [

            {
                fecha_hora:
                    fechaMedicion1,

                ph:
                    7.1,

                cloro_residual:
                    0.5,

                personas_alojadas:
                    NumberInt(180),

                porcentaje_ocupacion:
                    72
            },

            {
                fecha_hora:
                    fechaMedicion2,

                ph:
                    7.2,

                cloro_residual:
                    0.48,

                personas_alojadas:
                    NumberInt(182),

                porcentaje_ocupacion:
                    72.8
            }
        ],

        calculados: {

            cantidad_mediciones:
                NumberInt(2),

            suma_ph:
                14.3,

            suma_cloro_residual:
                0.98,

            promedio_ph:
                7.15,

            promedio_cloro_residual:
                0.49,

            porcentaje_ocupacion:
                72.8
        },

        ultima_medicion: {

            fecha_hora:
                fechaMedicion2,

            ph:
                7.2,

            cloro_residual:
                0.48,

            personas_alojadas:
                NumberInt(182),

            porcentaje_ocupacion:
                72.8
        },

        created_at:
            new Date(),

        updated_at:
            new Date()
    };
}


// ============================================================
// 6. PRUEBAS
// ============================================================


// ------------------------------------------------------------
// PRUEBA 1
// Documento válido
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Bucket válido",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-01T05:00:00.000Z"
                )
            );


        const resultado =
            db.metricas_albergue.insertOne(
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
            crearBucketValido(
                ISODate(
                    "2099-09-02T05:00:00.000Z"
                )
            );


        delete documento.albergue_id;


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 3
// fecha_bucket obligatoria
// ------------------------------------------------------------

pruebaDebeFallar(
    "fecha_bucket es obligatoria",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-03T05:00:00.000Z"
                )
            );


        delete documento.fecha_bucket;


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 4
// mediciones obligatorio
// ------------------------------------------------------------

pruebaDebeFallar(
    "mediciones es obligatorio",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-04T05:00:00.000Z"
                )
            );


        delete documento.mediciones;


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 5
// mediciones no puede estar vacío
// ------------------------------------------------------------

pruebaDebeFallar(
    "mediciones no puede estar vacío",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-05T05:00:00.000Z"
                )
            );


        documento.mediciones =
            [];


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 6
// pH negativo
// ------------------------------------------------------------

pruebaDebeFallar(
    "ph negativo es rechazado",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-06T05:00:00.000Z"
                )
            );


        documento.mediciones[0].ph =
            -1;


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 7
// cloro residual negativo
// ------------------------------------------------------------

pruebaDebeFallar(
    "cloro_residual negativo es rechazado",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-07T05:00:00.000Z"
                )
            );


        documento.mediciones[0].cloro_residual =
            -0.1;


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 8
// personas_alojadas debe ser Int32
// ------------------------------------------------------------

pruebaDebeFallar(
    "personas_alojadas debe ser Int32",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-08T05:00:00.000Z"
                )
            );


        documento.mediciones[0].personas_alojadas =
            180.5;


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 9
// Sobreocupación > 100% permitida
// ------------------------------------------------------------
//
// Una situación de hacinamiento puede superar 100%.
// No se impone maximum: 100.
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "porcentaje_ocupacion puede superar 100",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-09T05:00:00.000Z"
                )
            );


        documento.mediciones[0]
            .porcentaje_ocupacion =
                118.5;


        documento.mediciones[1]
            .porcentaje_ocupacion =
                120;


        documento.calculados
            .porcentaje_ocupacion =
                120;


        documento.ultima_medicion
            .porcentaje_ocupacion =
                120;


        db.metricas_albergue.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 10
// cantidad_mediciones >= 1
// ------------------------------------------------------------

pruebaDebeFallar(
    "cantidad_mediciones debe ser mayor o igual a 1",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-10T05:00:00.000Z"
                )
            );


        documento.calculados
            .cantidad_mediciones =
                NumberInt(0);


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 11
// ultima_medicion obligatoria
// ------------------------------------------------------------

pruebaDebeFallar(
    "ultima_medicion es obligatoria",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-11T05:00:00.000Z"
                )
            );


        delete documento.ultima_medicion;


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 12
// additionalProperties false
// ------------------------------------------------------------

pruebaDebeFallar(
    "Propiedades adicionales son rechazadas",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-12T05:00:00.000Z"
                )
            );


        documento.campo_no_permitido =
            "valor";


        db.metricas_albergue.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 13
// Bucket único por albergue + fecha
// ------------------------------------------------------------

pruebaDebeFallar(
    "Solo permite un bucket por albergue y fecha_bucket",
    function () {

        const fecha =
            ISODate(
                "2099-09-13T05:00:00.000Z"
            );


        const documento1 =
            crearBucketValido(
                fecha
            );


        const documento2 =
            crearBucketValido(
                fecha
            );


        db.metricas_albergue.insertOne(
            documento1
        );


        db.metricas_albergue.insertOne(
            documento2
        );
    },
    11000
);


// ------------------------------------------------------------
// PRUEBA 14
// Índice único
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Índice único del Bucket Pattern",
    function () {

        const indices =
            db.metricas_albergue
                .getIndexes();


        const indice =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ux_metricas_albergue_albergue_fecha_bucket"
                    );
                }
            );


        if (!indice) {

            throw new Error(
                "No existe el índice del Bucket Pattern."
            );
        }


        if (
            indice.unique !== true
        ) {

            throw new Error(
                "El índice existe pero no es UNIQUE."
            );
        }


        if (
            indice.key.albergue_id !== 1 ||
            indice.key.fecha_bucket !== 1
        ) {

            throw new Error(
                "La definición del índice no corresponde al contrato."
            );
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 15
// estado_actual es opcional
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "estado_actual es opcional",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-15T05:00:00.000Z"
                )
            );


        if (
            documento.estado_actual !==
            undefined
        ) {

            throw new Error(
                "El constructor no debería incluir estado_actual."
            );
        }


        db.metricas_albergue.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 16
// estado_actual estructuralmente válido
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "estado_actual acepta estructura válida",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-16T05:00:00.000Z"
                )
            );


        documento.estado_actual = {

            agua: {

                nivel:
                    "normal"
            },

            hacinamiento: {

                nivel:
                    "alto"
            },

            semaforo_vital: {

                nivel:
                    "amarillo",

                codigo:
                    NumberInt(2),

                estado_semaforo_id:
                    new ObjectId(),

                fecha_calculo:
                    new Date()
            },

            alertas_activas: {

                cantidad:
                    NumberInt(2),

                ids: [
                    new ObjectId(),
                    new ObjectId()
                ]
            }
        };


        db.metricas_albergue.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 17
// Referencia huérfana albergue_id
// ------------------------------------------------------------
//
// El $jsonSchema acepta estructuralmente cualquier ObjectId.
// El control DBA debe ser capaz de detectar que el ObjectId
// no corresponde a un albergue existente.
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
            crearBucketValido(
                ISODate(
                    "2099-09-17T05:00:00.000Z"
                )
            );


        documento.albergue_id =
            albergueHuerfanoId;


        const insercion =
            db.metricas_albergue.insertOne(
                documento
            );


        const huerfanos =
            db.metricas_albergue.aggregate([

                {
                    $match: {

                        _id:
                            insercion.insertedId
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
                }

            ]).toArray();


        if (
            huerfanos.length !== 1
        ) {

            throw new Error(
                "El control DBA no detectó la referencia huérfana."
            );
        }


        db.metricas_albergue.deleteOne({
            _id:
                insercion.insertedId
        });
    }
);


// ------------------------------------------------------------
// PRUEBA 18
// Consistencia del Bucket + Computed de prueba
// ------------------------------------------------------------
//
// MongoDB $jsonSchema NO calcula estas relaciones.
//
// Esta prueba confirma que el documento generado para el
// contrato cumple:
//
// cantidad_mediciones = mediciones.length
// sumas correctas
// promedios correctos
// ultima_medicion = última medición temporal
//
// La aplicación deberá conservar estas reglas durante las
// actualizaciones reales.
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Consistencia Bucket + Computed del documento",
    function () {

        const documento =
            crearBucketValido(
                ISODate(
                    "2099-09-18T05:00:00.000Z"
                )
            );


        const cantidadReal =
            documento.mediciones.length;


        if (
            Number(
                documento.calculados
                    .cantidad_mediciones
            ) !==
            cantidadReal
        ) {

            throw new Error(
                "cantidad_mediciones no coincide con mediciones.length."
            );
        }

        const sumaPhReal =
            documento.mediciones.reduce(
                function (
                    acumulado,
                    medicion
                ) {

                    return (
                        acumulado +
                        Number(
                            medicion.ph
                        )
                    );
                },
                0
            );


        const sumaCloroReal =
            documento.mediciones.reduce(
                function (
                    acumulado,
                    medicion
                ) {

                    return (
                        acumulado +
                        Number(
                            medicion.cloro_residual
                        )
                    );
                },
                0
            );


        const tolerancia =
            0.000001;


        if (
            Math.abs(
                sumaPhReal -
                Number(
                    documento.calculados
                        .suma_ph
                )
            ) >
            tolerancia
        ) {

            throw new Error(
                "suma_ph no coincide con las mediciones."
            );
        }


        if (
            Math.abs(
                sumaCloroReal -
                Number(
                    documento.calculados
                        .suma_cloro_residual
                )
            ) >
            tolerancia
        ) {

            throw new Error(
                "suma_cloro_residual no coincide con las mediciones."
            );
        }


        const promedioPhReal =
            sumaPhReal /
            cantidadReal;


        const promedioCloroReal =
            sumaCloroReal /
            cantidadReal;


        if (
            Math.abs(
                promedioPhReal -
                Number(
                    documento.calculados
                        .promedio_ph
                )
            ) >
            tolerancia
        ) {

            throw new Error(
                "promedio_ph no coincide con las mediciones."
            );
        }


        if (
            Math.abs(
                promedioCloroReal -
                Number(
                    documento.calculados
                        .promedio_cloro_residual
                )
            ) >
            tolerancia
        ) {

            throw new Error(
                "promedio_cloro_residual no coincide con las mediciones."
            );
        }


        const ultima =
            documento.mediciones[
                documento.mediciones.length - 1
            ];


        if (
            ultima.fecha_hora.getTime() !==
            documento.ultima_medicion
                .fecha_hora.getTime()
        ) {

            throw new Error(
                "ultima_medicion no corresponde a la última medición."
            );
        }


        db.metricas_albergue.insertOne(
            documento
        );
    }
);


// ============================================================
// 7. LIMPIEZA FINAL
// ============================================================

try {

    db.metricas_albergue.deleteMany({

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha_bucket: {

            $gte:
                FECHA_INICIO_PRUEBAS,

            $lt:
                FECHA_FIN_PRUEBAS
        }
    });


    print("");
    print(
        "✓ OK: limpieza de buckets temporales"
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
// 8. RESULTADO
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
        "Existen pruebas fallidas en metricas_albergue."
    );
}


print("");
print(
    "✓ TODAS LAS PRUEBAS DE METRICAS_ALBERGUE " +
    "FINALIZARON CORRECTAMENTE."
);

print("");