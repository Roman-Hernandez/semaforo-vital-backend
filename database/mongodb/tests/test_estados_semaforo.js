// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - estados_semaforo
//
// Migración asociada:
//   013_create_estados_semaforo
//
// Cobertura:
//   - documento válido
//   - campos obligatorios
//   - nivel verde / amarillo / rojo
//   - codigo Int32
//   - datos_origen
//   - arrays obligatorios
//   - uniqueItems
//   - additionalProperties false
//   - naturaleza histórica append-only
//   - rechazo de updated_at / updated_by
//   - referencias huérfanas
//   - coherencia de albergue
//   - índices históricos
//   - migración registrada
//   - validationLevel strict
//   - validationAction error
//   - decisiones funcionales deliberadamente abiertas
//
// IMPORTANTE:
//
// estados_semaforo conserva el histórico oficial.
//
// Un nuevo cálculo debe generar un documento nuevo.
//
// metricas_albergue.estado_actual.semaforo_vital
// representa únicamente el snapshot persistente del último estado.
//
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" SEMÁFORO VITAL");
print(" PRUEBAS DBA - estados_semaforo");
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

    "estados_semaforo",
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


// ObjectId deliberadamente diferente.
//
// Se utiliza para crear documentos fuente pertenecientes
// lógicamente a otro albergue y validar la coherencia DBA.

const ALBERGUE_OTRO_ID =
    new ObjectId();


const MARCADOR =
    "DBA_TEST_ESTADOS_SEMAFORO";


const FECHA_BASE =
    ISODate(
        "2099-10-01T13:00:00.000Z"
    );


function fechaPrueba(
    dias
) {

    return new Date(
        FECHA_BASE.getTime() +
        (
            dias *
            24 *
            60 *
            60 *
            1000
        )
    );
}


// ============================================================
// 3. LIMPIEZA PREVIA
// ============================================================

db.estados_semaforo.deleteMany({

    fecha_calculo: {

        $gte:
            ISODate(
                "2099-10-01T00:00:00.000Z"
            ),

        $lt:
            ISODate(
                "2100-02-01T00:00:00.000Z"
            )
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


db.alertas.deleteMany({

    fuente_datos:
        MARCADOR
});


db.analisis_ia.deleteMany({

    "modelo.nombre":
        MARCADOR
});


db.predicciones_sir.deleteMany({

    "modelo.nombre":
        MARCADOR
});


db.metricas_albergue.deleteMany({

    albergue_id: {

        $in: [

            ALBERGUE_TEST_ID,
            ALBERGUE_OTRO_ID
        ]
    },

    fecha_bucket: {

        $gte:
            ISODate(
                "2099-12-01T05:00:00.000Z"
            ),

        $lt:
            ISODate(
                "2100-01-01T05:00:00.000Z"
            )
    }
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// 4. DATOS AUXILIARES CONTROLADOS
// ============================================================


// ------------------------------------------------------------
// 4.1 condiciones_sanitarias
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
            NumberInt(5),

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
                "2099-12-01T13:00:00.000Z"
            )
        )
    );


const condicionOtroAlbergue =
    db.condiciones_sanitarias.insertOne(

        crearCondicionSanitaria(

            ALBERGUE_OTRO_ID,

            ISODate(
                "2099-12-02T13:00:00.000Z"
            )
        )
    );


// ------------------------------------------------------------
// 4.2 casos_enfermedades
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
            NumberInt(3),

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
                "2099-12-01T13:10:00.000Z"
            )
        )
    );


const casoOtroAlbergue =
    db.casos_enfermedades.insertOne(

        crearCasoEnfermedad(

            ALBERGUE_OTRO_ID,

            ISODate(
                "2099-12-02T13:10:00.000Z"
            )
        )
    );


// ------------------------------------------------------------
// 4.3 alertas
// ------------------------------------------------------------

function crearAlerta(
    albergueId,
    fecha,
    mensaje
) {

    return {

        albergue_id:
            albergueId,

        fecha_alerta:
            fecha,

        nivel_riesgo:
            "amarillo",

        tipo_alerta:
            MARCADOR,

        mensaje:
            mensaje,

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


const alertaMismoAlbergue =
    db.alertas.insertOne(

        crearAlerta(

            ALBERGUE_TEST_ID,

            ISODate(
                "2099-12-01T13:20:00.000Z"
            ),

            "[DBA-TEST-ESTADOS] alerta mismo albergue"
        )
    );


const alertaOtroAlbergue =
    db.alertas.insertOne(

        crearAlerta(

            ALBERGUE_OTRO_ID,

            ISODate(
                "2099-12-02T13:20:00.000Z"
            ),

            "[DBA-TEST-ESTADOS] alerta otro albergue"
        )
    );


// ------------------------------------------------------------
// 4.4 analisis_ia
// ------------------------------------------------------------

function crearAnalisisIA(
    albergueId,
    fecha,
    version
) {

    return {

        albergue_id:
            albergueId,

        fecha_ejecucion:
            fecha,

        periodo_analizado: {

            fecha_inicio:
                ISODate(
                    "2099-11-01T05:00:00.000Z"
                ),

            fecha_fin:
                ISODate(
                    "2099-11-30T05:00:00.000Z"
                )
        },

        modelo: {

            nombre:
                MARCADOR,

            version:
                version
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
                NumberInt(0),

            registros_descartados:
                NumberInt(0),

            datos_faltantes:
                []
        },

        resultado: {

            probabilidad_riesgo:
                0.50
        },

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
            new Date()
    };
}


const analisisMismoAlbergue =
    db.analisis_ia.insertOne(

        crearAnalisisIA(

            ALBERGUE_TEST_ID,

            ISODate(
                "2099-12-01T13:30:00.000Z"
            ),

            "estados-test-a"
        )
    );


const analisisOtroAlbergue =
    db.analisis_ia.insertOne(

        crearAnalisisIA(

            ALBERGUE_OTRO_ID,

            ISODate(
                "2099-12-02T13:30:00.000Z"
            ),

            "estados-test-b"
        )
    );


// ------------------------------------------------------------
// 4.5 predicciones_sir
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
                    NumberInt(95),

                infectados:
                    NumberInt(5),

                recuperados:
                    NumberInt(0)
            },

            horizonte_dias:
                NumberInt(10),

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
                NumberInt(0),

            registros_descartados:
                NumberInt(0)
        },

        trayectoria: [

            {

                dia:
                    NumberInt(0),

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
                "2099-12-01T13:40:00.000Z"
            ),

            "estados-test-a"
        )
    );


const prediccionOtroAlbergue =
    db.predicciones_sir.insertOne(

        crearPrediccionSIR(

            ALBERGUE_OTRO_ID,

            ISODate(
                "2099-12-02T13:40:00.000Z"
            ),

            "estados-test-b"
        )
    );


// ------------------------------------------------------------
// 4.6 metricas_albergue
// ------------------------------------------------------------

function crearBucketMetricas(
    albergueId,
    fechaBucket
) {

    const fechaMedicion =
        new Date(
            fechaBucket.getTime() +
            (
                8 *
                60 *
                60 *
                1000
            )
        );


    return {

        albergue_id:
            albergueId,

        fecha_bucket:
            fechaBucket,

        mediciones: [

            {

                fecha_hora:
                    fechaMedicion,

                ph:
                    7.1,

                cloro_residual:
                    0.5,

                personas_alojadas:
                    NumberInt(100),

                porcentaje_ocupacion:
                    50
            }
        ],

        calculados: {

            cantidad_mediciones:
                NumberInt(1),

            suma_ph:
                7.1,

            suma_cloro_residual:
                0.5,

            promedio_ph:
                7.1,

            promedio_cloro_residual:
                0.5,

            porcentaje_ocupacion:
                50
        },

        ultima_medicion: {

            fecha_hora:
                fechaMedicion,

            ph:
                7.1,

            cloro_residual:
                0.5,

            personas_alojadas:
                NumberInt(100),

            porcentaje_ocupacion:
                50
        },

        created_at:
            new Date(),

        updated_at:
            new Date()
    };
}


const metricaMismoAlbergue =
    db.metricas_albergue.insertOne(

        crearBucketMetricas(

            ALBERGUE_TEST_ID,

            ISODate(
                "2099-12-20T05:00:00.000Z"
            )
        )
    );


const metricaOtroAlbergue =
    db.metricas_albergue.insertOne(

        crearBucketMetricas(

            ALBERGUE_OTRO_ID,

            ISODate(
                "2099-12-21T05:00:00.000Z"
            )
        )
    );


print(
    "✓ Datos auxiliares de origen creados."
);


// ============================================================
// 5. FACTORÍA DE ESTADO VÁLIDO
// ============================================================

function documentoValido(
    fecha
) {

    return {

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha_calculo:
            fecha,

        nivel:
            "amarillo",

        codigo:
            NumberInt(2),

        datos_origen: {

            condiciones_sanitarias_ids:
                [],

            casos_enfermedades_ids:
                [],

            alertas_ids:
                [],

            analisis_ia_ids:
                [],

            predicciones_sir_ids:
                [],

            metricas_albergue_ids:
                []
        },

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
    "1. Permite insertar un estado válido",

    function () {

        const resultado =
            db.estados_semaforo.insertOne(

                documentoValido(
                    fechaPrueba(1)
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
    "2. Rechaza estado sin albergue_id",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(2)
            );


        delete documento.albergue_id;


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 3. albergue_id DEBE SER ObjectId
// ============================================================

prueba(
    "3. Rechaza albergue_id que no sea ObjectId",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(3)
            );


        documento.albergue_id =
            "albergue_invalido";


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 4. fecha_calculo OBLIGATORIA
// ============================================================

prueba(
    "4. Rechaza estado sin fecha_calculo",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(4)
            );


        delete documento.fecha_calculo;


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 5. fecha_calculo DEBE SER Date
// ============================================================

prueba(
    "5. Rechaza fecha_calculo que no sea Date",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(5)
            );


        documento.fecha_calculo =
            "2099-10-05";


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 6. nivel OBLIGATORIO
// ============================================================

prueba(
    "6. Rechaza estado sin nivel",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(6)
            );


        delete documento.nivel;


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 7. nivel FUERA DEL ENUM
// ============================================================

prueba(
    "7. Rechaza nivel fuera de verde/amarillo/rojo",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(7)
            );


        documento.nivel =
            "naranja";


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 8. ACEPTA LOS TRES NIVELES
// ============================================================

prueba(
    "8. Acepta verde, amarillo y rojo",

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
                        fechaPrueba(
                            8 + indice
                        )
                    );


                documento.nivel =
                    nivel;


                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );


        const cantidad =
            db.estados_semaforo.countDocuments({

                albergue_id:
                    ALBERGUE_TEST_ID,

                fecha_calculo: {

                    $gte:
                        fechaPrueba(8),

                    $lte:
                        fechaPrueba(10)
                },

                nivel: {

                    $in: [

                        "verde",
                        "amarillo",
                        "rojo"
                    ]
                }
            });


        assertTrue(
            cantidad === 3,
            "No se almacenaron correctamente los tres niveles."
        );
    }
);


// ============================================================
// 9. codigo OBLIGATORIO
// ============================================================

prueba(
    "9. Rechaza estado sin codigo",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(11)
            );


        delete documento.codigo;


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 10. codigo DEBE SER Int32
// ============================================================

prueba(
    "10. Rechaza codigo que no sea Int32",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(12)
            );


        documento.codigo =
            2.5;


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 11. codigo NO TIENE ENUM ARTIFICIAL
// ============================================================

prueba(
    "11. Permite codigo Int32 sin correspondencia numérica artificial",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(13)
            );


        documento.codigo =
            NumberInt(99);


        const resultado =
            db.estados_semaforo.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "Se impuso una correspondencia de codigo no aprobada."
        );
    }
);


// ============================================================
// 12. datos_origen OBLIGATORIO
// ============================================================

prueba(
    "12. Rechaza estado sin datos_origen",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(14)
            );


        delete documento.datos_origen;


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 13. additionalProperties FALSE EN datos_origen
// ============================================================

prueba(
    "13. Rechaza propiedades adicionales en datos_origen",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(15)
            );


        documento
            .datos_origen
            .campo_no_permitido =
                [];


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 14-19. ARRAYS OBLIGATORIOS
// ============================================================

const arraysObligatorios = [

    "condiciones_sanitarias_ids",
    "casos_enfermedades_ids",
    "alertas_ids",
    "analisis_ia_ids",
    "predicciones_sir_ids",
    "metricas_albergue_ids"
];


arraysObligatorios.forEach(

    function (
        campo,
        indice
    ) {

        prueba(
            String(
                14 + indice
            ) +
            ". Rechaza datos_origen sin " +
            campo,

            function () {

                const documento =
                    documentoValido(
                        fechaPrueba(
                            16 + indice
                        )
                    );


                delete documento
                    .datos_origen[
                        campo
                    ];


                esperarErrorValidacion(
                    function () {

                        db.estados_semaforo.insertOne(
                            documento
                        );
                    }
                );
            }
        );
    }
);


// ============================================================
// 20. ARRAYS PUEDEN ESTAR VACÍOS
// ============================================================

prueba(
    "20. Permite arrays de origen vacíos",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(22)
            );


        const resultado =
            db.estados_semaforo.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "Los arrays vacíos fueron rechazados."
        );
    }
);


// ============================================================
// 21. uniqueItems
// ============================================================

prueba(
    "21. Rechaza referencias duplicadas dentro de arrays de origen",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(23)
            );


        documento
            .datos_origen
            .condiciones_sanitarias_ids =
                [

                    condicionMismoAlbergue.insertedId,
                    condicionMismoAlbergue.insertedId
                ];


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 22. ITEMS DE ARRAYS DEBEN SER ObjectId
// ============================================================

prueba(
    "22. Rechaza items no ObjectId en arrays de origen",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(24)
            );


        documento
            .datos_origen
            .alertas_ids =
                [

                    "alerta_invalida"
                ];


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 23. registrado_por OBLIGATORIO
// ============================================================

prueba(
    "23. Rechaza estado sin registrado_por",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(25)
            );


        delete documento.registrado_por;


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 24. registrado_por DEBE SER ObjectId
// ============================================================

prueba(
    "24. Rechaza registrado_por que no sea ObjectId",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(26)
            );


        documento.registrado_por =
            "usuario_invalido";


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 25. created_at OBLIGATORIO
// ============================================================

prueba(
    "25. Rechaza estado sin created_at",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(27)
            );


        delete documento.created_at;


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 26. created_at DEBE SER Date
// ============================================================

prueba(
    "26. Rechaza created_at que no sea Date",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(28)
            );


        documento.created_at =
            "fecha_invalida";


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 27. additionalProperties FALSE
// ============================================================

prueba(
    "27. Rechaza propiedades adicionales en estado",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(29)
            );


        documento.campo_no_permitido =
            "NO DEBE EXISTIR";


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 28. updated_at NO PERTENECE AL CONTRATO
// ============================================================

prueba(
    "28. Rechaza updated_at por naturaleza histórica",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(30)
            );


        documento.updated_at =
            new Date();


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 29. updated_by NO PERTENECE AL CONTRATO
// ============================================================

prueba(
    "29. Rechaza updated_by por naturaleza histórica",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(31)
            );


        documento.updated_by =
            USUARIO_TEST_ID;


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 30. MÚLTIPLES CÁLCULOS MISMA FECHA
// ============================================================

prueba(
    "30. Permite múltiples cálculos del mismo albergue y fecha",

    function () {

        const fecha =
            fechaPrueba(32);


        const documentoA =
            documentoValido(
                fecha
            );


        const documentoB =
            documentoValido(
                fecha
            );


        documentoA.nivel =
            "amarillo";


        documentoB.nivel =
            "rojo";


        const resultado =
            db.estados_semaforo.insertMany([

                documentoA,
                documentoB
            ]);


        assertTrue(
            Object.keys(
                resultado.insertedIds
            ).length === 2,
            "No se insertaron los dos estados históricos."
        );
    }
);


// ============================================================
// 31. REFERENCIAS VÁLIDAS MISMO ALBERGUE
// ============================================================

prueba(
    "31. Permite trazabilidad completa con fuentes del mismo albergue",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(33)
            );


        documento.datos_origen = {

            condiciones_sanitarias_ids: [

                condicionMismoAlbergue.insertedId
            ],

            casos_enfermedades_ids: [

                casoMismoAlbergue.insertedId
            ],

            alertas_ids: [

                alertaMismoAlbergue.insertedId
            ],

            analisis_ia_ids: [

                analisisMismoAlbergue.insertedId
            ],

            predicciones_sir_ids: [

                prediccionMismoAlbergue.insertedId
            ],

            metricas_albergue_ids: [

                metricaMismoAlbergue.insertedId
            ]
        };


        const resultado =
            db.estados_semaforo.insertOne(
                documento
            );


        assertTrue(
            resultado.acknowledged === true,
            "No se almacenó el estado con trazabilidad completa."
        );
    }
);


// ============================================================
// 32. albergue_id HUÉRFANO
// ============================================================

prueba(
    "32. Detecta albergue_id huérfano",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(34)
            );


        documento.albergue_id =
            new ObjectId();


        const resultado =
            db.estados_semaforo.insertOne(
                documento
            );


        const huerfanos =
            db.estados_semaforo.aggregate([

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
// 33. registrado_por HUÉRFANO
// ============================================================

prueba(
    "33. Detecta registrado_por huérfano",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(35)
            );


        documento.registrado_por =
            new ObjectId();


        const resultado =
            db.estados_semaforo.insertOne(
                documento
            );


        const huerfanos =
            db.estados_semaforo.aggregate([

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
// 34-39. REFERENCIAS HUÉRFANAS DE DATOS DE ORIGEN
// ============================================================

const referenciasHuerfanas = [

    {
        numero: 34,
        campo: "condiciones_sanitarias_ids",
        coleccion: "condiciones_sanitarias"
    },

    {
        numero: 35,
        campo: "casos_enfermedades_ids",
        coleccion: "casos_enfermedades"
    },

    {
        numero: 36,
        campo: "alertas_ids",
        coleccion: "alertas"
    },

    {
        numero: 37,
        campo: "analisis_ia_ids",
        coleccion: "analisis_ia"
    },

    {
        numero: 38,
        campo: "predicciones_sir_ids",
        coleccion: "predicciones_sir"
    },

    {
        numero: 39,
        campo: "metricas_albergue_ids",
        coleccion: "metricas_albergue"
    }
];


referenciasHuerfanas.forEach(

    function (
        configuracion,
        indice
    ) {

        prueba(
            configuracion.numero +
            ". Detecta referencia huérfana en " +
            configuracion.campo,

            function () {

                const documento =
                    documentoValido(
                        fechaPrueba(
                            36 + indice
                        )
                    );


                documento
                    .datos_origen[
                        configuracion.campo
                    ] =
                        [

                            new ObjectId()
                        ];


                const resultado =
                    db.estados_semaforo.insertOne(
                        documento
                    );


                const huerfanos =
                    db.estados_semaforo.aggregate([

                        {

                            $match: {

                                _id:
                                    resultado.insertedId
                            }
                        },

                        {

                            $unwind:
                                "$datos_origen." +
                                configuracion.campo
                        },

                        {

                            $lookup: {

                                from:
                                    configuracion.coleccion,

                                localField:
                                    "datos_origen." +
                                    configuracion.campo,

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
                    "No se detectó referencia huérfana hacia " +
                    configuracion.coleccion +
                    "."
                );
            }
        );
    }
);


// ============================================================
// 40-45. COHERENCIA DE ALBERGUE
// ============================================================

const coherencias = [

    {
        numero: 40,
        campo: "condiciones_sanitarias_ids",
        coleccion: "condiciones_sanitarias",
        id: condicionOtroAlbergue.insertedId
    },

    {
        numero: 41,
        campo: "casos_enfermedades_ids",
        coleccion: "casos_enfermedades",
        id: casoOtroAlbergue.insertedId
    },

    {
        numero: 42,
        campo: "alertas_ids",
        coleccion: "alertas",
        id: alertaOtroAlbergue.insertedId
    },

    {
        numero: 43,
        campo: "analisis_ia_ids",
        coleccion: "analisis_ia",
        id: analisisOtroAlbergue.insertedId
    },

    {
        numero: 44,
        campo: "predicciones_sir_ids",
        coleccion: "predicciones_sir",
        id: prediccionOtroAlbergue.insertedId
    },

    {
        numero: 45,
        campo: "metricas_albergue_ids",
        coleccion: "metricas_albergue",
        id: metricaOtroAlbergue.insertedId
    }
];


coherencias.forEach(

    function (
        configuracion,
        indice
    ) {

        prueba(
            configuracion.numero +
            ". Detecta " +
            configuracion.campo +
            " perteneciente a otro albergue",

            function () {

                const documento =
                    documentoValido(
                        fechaPrueba(
                            42 + indice
                        )
                    );


                documento
                    .datos_origen[
                        configuracion.campo
                    ] =
                        [

                            configuracion.id
                        ];


                const resultado =
                    db.estados_semaforo.insertOne(
                        documento
                    );


                const inconsistencias =
                    db.estados_semaforo.aggregate([

                        {

                            $match: {

                                _id:
                                    resultado.insertedId
                            }
                        },

                        {

                            $unwind:
                                "$datos_origen." +
                                configuracion.campo
                        },

                        {

                            $lookup: {

                                from:
                                    configuracion.coleccion,

                                localField:
                                    "datos_origen." +
                                    configuracion.campo,

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
                    "No se detectó referencia de otro albergue para " +
                    configuracion.campo +
                    "."
                );
            }
        );
    }
);


// ============================================================
// 46. ÍNDICES
// ============================================================

prueba(
    "46. Los tres índices de estados_semaforo son correctos y no únicos",

    function () {

        const indices =
            db.estados_semaforo
                .getIndexes();


        const albergueFecha =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_estados_semaforo_albergue_fecha"
                    );
                }
            );


        assertTrue(
            albergueFecha !== undefined,
            "No existe ix_estados_semaforo_albergue_fecha."
        );


        assertTrue(
            albergueFecha.unique !== true,
            "ix_estados_semaforo_albergue_fecha no debe ser UNIQUE."
        );


        assertTrue(
            albergueFecha.key.albergue_id === 1 &&
            albergueFecha.key.fecha_calculo === -1,
            "Definición incorrecta de ix_estados_semaforo_albergue_fecha."
        );


        const albergueNivelFecha =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_estados_semaforo_albergue_nivel_fecha"
                    );
                }
            );


        assertTrue(
            albergueNivelFecha !== undefined,
            "No existe ix_estados_semaforo_albergue_nivel_fecha."
        );


        assertTrue(
            albergueNivelFecha.unique !== true,
            "ix_estados_semaforo_albergue_nivel_fecha no debe ser UNIQUE."
        );


        assertTrue(
            albergueNivelFecha.key.albergue_id === 1 &&
            albergueNivelFecha.key.nivel === 1 &&
            albergueNivelFecha.key.fecha_calculo === -1,
            "Definición incorrecta de ix_estados_semaforo_albergue_nivel_fecha."
        );


        const nivelFecha =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ix_estados_semaforo_nivel_fecha"
                    );
                }
            );


        assertTrue(
            nivelFecha !== undefined,
            "No existe ix_estados_semaforo_nivel_fecha."
        );


        assertTrue(
            nivelFecha.unique !== true,
            "ix_estados_semaforo_nivel_fecha no debe ser UNIQUE."
        );


        assertTrue(
            nivelFecha.key.nivel === 1 &&
            nivelFecha.key.fecha_calculo === -1,
            "Definición incorrecta de ix_estados_semaforo_nivel_fecha."
        );
    }
);


// ============================================================
// 47. MIGRACIÓN 013
// ============================================================

prueba(
    "47. Migración 013 registrada exactamente una vez",

    function () {

        const cantidad =
            db.schema_migrations.countDocuments({

                version:
                    "013_create_estados_semaforo"
            });


        assertTrue(
            cantidad === 1,
            "La migración 013 debe estar registrada exactamente una vez."
        );
    }
);


// ============================================================
// 48. VALIDACIÓN STRICT / ERROR
// ============================================================

prueba(
    "48. Colección utiliza validationLevel strict y validationAction error",

    function () {

        const info =
            db.getCollectionInfos({

                name:
                    "estados_semaforo"
            })[0];


        assertTrue(
            info !== undefined,
            "No fue posible consultar estados_semaforo."
        );


        assertTrue(
            info.options.validationLevel === "strict",
            "validationLevel debe ser strict."
        );


        assertTrue(
            info.options.validationAction === "error",
            "validationAction debe ser error."
        );
    }
);


// ============================================================
// 49. NO EXISTE prioridad
// ============================================================

prueba(
    "49. Rechaza prioridad porque no pertenece al contrato",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(50)
            );


        documento.prioridad =
            "alta";


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 50. NO EXISTE fórmula/regla funcional
// ============================================================

prueba(
    "50. Rechaza regla_aplicada porque la fórmula de clasificación no pertenece al contrato DBA",

    function () {

        const documento =
            documentoValido(
                fechaPrueba(51)
            );


        documento.regla_aplicada =
            "alerta_roja_implica_rojo";


        esperarErrorValidacion(
            function () {

                db.estados_semaforo.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 7. LIMPIEZA FINAL
// ============================================================

try {

    db.estados_semaforo.deleteMany({

        fecha_calculo: {

            $gte:
                ISODate(
                    "2099-10-01T00:00:00.000Z"
                ),

            $lt:
                ISODate(
                    "2100-02-01T00:00:00.000Z"
                )
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


    db.alertas.deleteMany({

        fuente_datos:
            MARCADOR
    });


    db.analisis_ia.deleteMany({

        "modelo.nombre":
            MARCADOR
    });


    db.predicciones_sir.deleteMany({

        "modelo.nombre":
            MARCADOR
    });


    db.metricas_albergue.deleteMany({

        albergue_id: {

            $in: [

                ALBERGUE_TEST_ID,
                ALBERGUE_OTRO_ID
            ]
        },

        fecha_bucket: {

            $gte:
                ISODate(
                    "2099-12-01T05:00:00.000Z"
                ),

            $lt:
                ISODate(
                    "2100-01-01T05:00:00.000Z"
                )
        }
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
print(" RESULTADO PRUEBAS DBA - estados_semaforo");
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
        "La suite DBA de estados_semaforo presentó fallos."
    );
}


if (
    pruebasExitosas !== 50
) {

    throw new Error(
        "Se esperaban exactamente 50 pruebas exitosas."
    );
}


print(
    "✓ Suite DBA estados_semaforo finalizada correctamente."
);

print("");