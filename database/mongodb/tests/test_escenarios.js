// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - escenarios
//
// Migración asociada:
//   014_create_escenarios
//
// Cobertura:
//   - estructura general
//   - campos obligatorios
//   - datos_base
//   - uniqueItems
//   - condiciones simuladas
//   - intervenciones simuladas
//   - separación real / hipotético
//   - naturaleza histórica append-only
//   - referencias lógicas
//   - coherencia de albergue
//   - integración con analisis_ia
//   - integración con predicciones_sir
//   - índices
//   - migración registrada
//   - validación strict/error
//
// IMPORTANTE:
//
// escenarios almacena hipótesis.
//
// intervenciones almacena exclusivamente acciones reales.
//
// Los resultados IA y SIR continúan almacenándose en:
//
//   analisis_ia
//   predicciones_sir
//
// utilizando escenario_id cuando la ejecución corresponde
// a una simulación hipotética.
// ============================================================

db = db.getSiblingDB("semaforo_vital");


print("");
print("====================================================");
print(" SEMÁFORO VITAL");
print(" PRUEBAS DBA - escenarios");
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
    "intervenciones",
    "escenarios",
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


const ALBERGUE_OTRO_ID =
    new ObjectId();


const MARCADOR =
    "DBA_TEST_ESCENARIOS";


const MARCADOR_MODELO =
    "DBA_TEST_ESCENARIOS_MODELO";


const FECHA_BASE =
    ISODate(
        "2099-08-01T13:00:00.000Z"
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

db.analisis_ia.deleteMany({

    "modelo.nombre":
        MARCADOR_MODELO
});


db.predicciones_sir.deleteMany({

    "modelo.nombre":
        MARCADOR_MODELO
});


db.escenarios.deleteMany({

    nombre: {

        $regex:
            "^" + MARCADOR
    }
});


db.condiciones_sanitarias.deleteMany({

    fuente_datos:
        MARCADOR
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// 4. FACTORÍA DE ESCENARIO VÁLIDO
// ============================================================

function documentoValido(
    sufijo
) {

    return {

        albergue_id:
            ALBERGUE_TEST_ID,

        nombre:
            MARCADOR +
            "_" +
            sufijo,

        descripcion:
            "Escenario hipotético de prueba DBA",

        datos_base: {

            registros_diarios_ids:
                [],

            historial_poblacion_ids:
                [],

            condiciones_sanitarias_ids:
                [],

            casos_enfermedades_ids:
                [],

            metricas_albergue_ids:
                [],

            estados_semaforo_ids:
                []
        },

        condiciones_simuladas: {

            agua_potable_disponible:
                true,

            banos_disponibles:
                NumberInt(5),

            estado_higiene:
                "prueba_dba",

            estado_saneamiento:
                "prueba_dba",

            otros_recursos_sanitarios:
                []
        },

        intervenciones_simuladas:
            [],

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
            new Date()
    };
}


// ============================================================
// 5. FACTORÍA IA
// ============================================================

function crearAnalisisIA(
    albergueId,
    escenarioId,
    version
) {

    return {

        albergue_id:
            albergueId,

        escenario_id:
            escenarioId,

        fecha_ejecucion:
            ISODate(
                "2099-11-10T13:00:00.000Z"
            ),

        periodo_analizado: {

            fecha_inicio:
                ISODate(
                    "2099-11-01T00:00:00.000Z"
                ),

            fecha_fin:
                ISODate(
                    "2099-11-09T23:59:59.000Z"
                )
        },

        modelo: {

            nombre:
                MARCADOR_MODELO,

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


// ============================================================
// 6. FACTORÍA SIR
// ============================================================

function crearPrediccionSIR(
    albergueId,
    escenarioId,
    version
) {

    return {

        albergue_id:
            albergueId,

        escenario_id:
            escenarioId,

        fecha_ejecucion:
            ISODate(
                "2099-11-10T14:00:00.000Z"
            ),

        enfermedad:
            "EDA",

        publica:
            false,

        modelo: {

            nombre:
                MARCADOR_MODELO,

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


// ============================================================
// 7. PRUEBAS ESTRUCTURALES
// ============================================================


// ------------------------------------------------------------
// PRUEBA 1
// ------------------------------------------------------------

prueba(
    "1. Permite insertar escenario válido",

    function () {

        const resultado =
            db.escenarios.insertOne(
                documentoValido(
                    "VALIDO"
                )
            );


        assertTrue(
            resultado.acknowledged === true,
            "MongoDB no confirmó la inserción."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 2
// ------------------------------------------------------------

prueba(
    "2. Rechaza escenario sin albergue_id",

    function () {

        const documento =
            documentoValido(
                "SIN_ALBERGUE"
            );


        delete documento.albergue_id;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 3
// ------------------------------------------------------------

prueba(
    "3. Rechaza albergue_id que no sea ObjectId",

    function () {

        const documento =
            documentoValido(
                "ALBERGUE_TIPO"
            );


        documento.albergue_id =
            "invalido";


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 4
// ------------------------------------------------------------

prueba(
    "4. Rechaza escenario sin nombre",

    function () {

        const documento =
            documentoValido(
                "SIN_NOMBRE"
            );


        delete documento.nombre;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 5
// ------------------------------------------------------------

prueba(
    "5. Rechaza nombre vacío",

    function () {

        const documento =
            documentoValido(
                "NOMBRE_VACIO"
            );


        documento.nombre =
            "";


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 6
// ------------------------------------------------------------

prueba(
    "6. descripcion es opcional",

    function () {

        const documento =
            documentoValido(
                "SIN_DESCRIPCION"
            );


        delete documento.descripcion;


        db.escenarios.insertOne(
            documento
        );
    }
);


// ============================================================
// 8. datos_base
// ============================================================


// ------------------------------------------------------------
// PRUEBA 7
// ------------------------------------------------------------

prueba(
    "7. Rechaza escenario sin datos_base",

    function () {

        const documento =
            documentoValido(
                "SIN_DATOS_BASE"
            );


        delete documento.datos_base;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


const camposDatosBase = [

    "registros_diarios_ids",
    "historial_poblacion_ids",
    "condiciones_sanitarias_ids",
    "casos_enfermedades_ids",
    "metricas_albergue_ids",
    "estados_semaforo_ids"
];


// ------------------------------------------------------------
// PRUEBA 8
// ------------------------------------------------------------

prueba(
    "8. Todos los arrays de datos_base son obligatorios",

    function () {

        camposDatosBase.forEach(

            function (campo) {

                const documento =
                    documentoValido(
                        "ARRAY_REQUERIDO_" +
                        campo
                    );


                delete documento
                    .datos_base[campo];


                esperarErrorValidacion(
                    function () {

                        db.escenarios.insertOne(
                            documento
                        );
                    }
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 9
// ------------------------------------------------------------

prueba(
    "9. Los campos de datos_base deben ser arrays",

    function () {

        camposDatosBase.forEach(

            function (campo) {

                const documento =
                    documentoValido(
                        "ARRAY_TIPO_" +
                        campo
                    );


                documento
                    .datos_base[campo] =
                        "invalido";


                esperarErrorValidacion(
                    function () {

                        db.escenarios.insertOne(
                            documento
                        );
                    }
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 10
// ------------------------------------------------------------

prueba(
    "10. Los elementos de datos_base deben ser ObjectId",

    function () {

        camposDatosBase.forEach(

            function (campo) {

                const documento =
                    documentoValido(
                        "ARRAY_OBJECTID_" +
                        campo
                    );


                documento
                    .datos_base[campo] =
                        [
                            "id_invalido"
                        ];


                esperarErrorValidacion(
                    function () {

                        db.escenarios.insertOne(
                            documento
                        );
                    }
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 11
// ------------------------------------------------------------

prueba(
    "11. datos_base no permite referencias duplicadas",

    function () {

        camposDatosBase.forEach(

            function (campo) {

                const idDuplicado =
                    new ObjectId();


                const documento =
                    documentoValido(
                        "ARRAY_DUPLICADO_" +
                        campo
                    );


                documento
                    .datos_base[campo] =
                        [
                            idDuplicado,
                            idDuplicado
                        ];


                esperarErrorValidacion(
                    function () {

                        db.escenarios.insertOne(
                            documento
                        );
                    }
                );
            }
        );
    }
);


// ============================================================
// 9. condiciones_simuladas
// ============================================================


// ------------------------------------------------------------
// PRUEBA 12
// ------------------------------------------------------------

prueba(
    "12. condiciones_simuladas es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_CONDICIONES"
            );


        delete documento
            .condiciones_simuladas;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 13
// ------------------------------------------------------------

prueba(
    "13. agua_potable_disponible es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_AGUA"
            );


        delete documento
            .condiciones_simuladas
            .agua_potable_disponible;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 14
// ------------------------------------------------------------

prueba(
    "14. agua_potable_disponible debe ser Boolean",

    function () {

        const documento =
            documentoValido(
                "AGUA_TIPO"
            );


        documento
            .condiciones_simuladas
            .agua_potable_disponible =
                "si";


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 15
// ------------------------------------------------------------

prueba(
    "15. banos_disponibles es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_BANOS"
            );


        delete documento
            .condiciones_simuladas
            .banos_disponibles;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 16
// ------------------------------------------------------------

prueba(
    "16. banos_disponibles debe ser Int32",

    function () {

        const documento =
            documentoValido(
                "BANOS_TIPO"
            );


        documento
            .condiciones_simuladas
            .banos_disponibles =
                5.5;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 17
// ------------------------------------------------------------

prueba(
    "17. banos_disponibles no puede ser negativo",

    function () {

        const documento =
            documentoValido(
                "BANOS_NEGATIVO"
            );


        documento
            .condiciones_simuladas
            .banos_disponibles =
                NumberInt(-1);


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 18
// ------------------------------------------------------------

prueba(
    "18. estado_higiene es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_HIGIENE"
            );


        delete documento
            .condiciones_simuladas
            .estado_higiene;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 19
// ------------------------------------------------------------

prueba(
    "19. estado_higiene no puede ser vacío",

    function () {

        const documento =
            documentoValido(
                "HIGIENE_VACIA"
            );


        documento
            .condiciones_simuladas
            .estado_higiene =
                "";


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 20
// ------------------------------------------------------------

prueba(
    "20. estado_saneamiento es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_SANEAMIENTO"
            );


        delete documento
            .condiciones_simuladas
            .estado_saneamiento;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 21
// ------------------------------------------------------------

prueba(
    "21. estado_saneamiento no puede ser vacío",

    function () {

        const documento =
            documentoValido(
                "SANEAMIENTO_VACIO"
            );


        documento
            .condiciones_simuladas
            .estado_saneamiento =
                "";


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 22
// ------------------------------------------------------------

prueba(
    "22. otros_recursos_sanitarios es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_RECURSOS"
            );


        delete documento
            .condiciones_simuladas
            .otros_recursos_sanitarios;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 23
// ------------------------------------------------------------

prueba(
    "23. Permite recurso sanitario hipotético válido",

    function () {

        const documento =
            documentoValido(
                "RECURSO_VALIDO"
            );


        documento
            .condiciones_simuladas
            .otros_recursos_sanitarios =
                [

                    {

                        nombre:
                            "Tanques de agua",

                        cantidad:
                            NumberInt(3),

                        observacion:
                            "Simulación DBA"
                    }
                ];


        db.escenarios.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 24
// ------------------------------------------------------------

prueba(
    "24. Recurso sanitario requiere nombre",

    function () {

        const documento =
            documentoValido(
                "RECURSO_SIN_NOMBRE"
            );


        documento
            .condiciones_simuladas
            .otros_recursos_sanitarios =
                [

                    {

                        cantidad:
                            NumberInt(3)
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 25
// ------------------------------------------------------------

prueba(
    "25. Nombre de recurso no puede ser vacío",

    function () {

        const documento =
            documentoValido(
                "RECURSO_NOMBRE_VACIO"
            );


        documento
            .condiciones_simuladas
            .otros_recursos_sanitarios =
                [

                    {

                        nombre:
                            "",

                        cantidad:
                            NumberInt(3)
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 26
// ------------------------------------------------------------

prueba(
    "26. Recurso sanitario requiere cantidad",

    function () {

        const documento =
            documentoValido(
                "RECURSO_SIN_CANTIDAD"
            );


        documento
            .condiciones_simuladas
            .otros_recursos_sanitarios =
                [

                    {

                        nombre:
                            "Tanques"
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 27
// ------------------------------------------------------------

prueba(
    "27. Cantidad de recurso debe ser Int32",

    function () {

        const documento =
            documentoValido(
                "RECURSO_CANTIDAD_TIPO"
            );


        documento
            .condiciones_simuladas
            .otros_recursos_sanitarios =
                [

                    {

                        nombre:
                            "Tanques",

                        cantidad:
                            2.5
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 28
// ------------------------------------------------------------

prueba(
    "28. Cantidad de recurso no puede ser negativa",

    function () {

        const documento =
            documentoValido(
                "RECURSO_NEGATIVO"
            );


        documento
            .condiciones_simuladas
            .otros_recursos_sanitarios =
                [

                    {

                        nombre:
                            "Tanques",

                        cantidad:
                            NumberInt(-1)
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 29
// ------------------------------------------------------------

prueba(
    "29. Rechaza propiedades adicionales en recurso sanitario",

    function () {

        const documento =
            documentoValido(
                "RECURSO_EXTRA"
            );


        documento
            .condiciones_simuladas
            .otros_recursos_sanitarios =
                [

                    {

                        nombre:
                            "Tanques",

                        cantidad:
                            NumberInt(3),

                        campo_extra:
                            true
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 30
// ------------------------------------------------------------

prueba(
    "30. letrinas es opcional",

    function () {

        const documento =
            documentoValido(
                "LETRINAS_OPCIONAL"
            );


        assertTrue(
            documento
                .condiciones_simuladas
                .letrinas === undefined,

            "El documento base no debería incluir letrinas."
        );


        db.escenarios.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 31
// ------------------------------------------------------------

prueba(
    "31. Permite letrinas Int32 no negativas",

    function () {

        const documento =
            documentoValido(
                "LETRINAS_VALIDAS"
            );


        documento
            .condiciones_simuladas
            .letrinas =
                NumberInt(10);


        db.escenarios.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 32
// ------------------------------------------------------------

prueba(
    "32. Rechaza letrinas que no sean Int32",

    function () {

        const documento =
            documentoValido(
                "LETRINAS_TIPO"
            );


        documento
            .condiciones_simuladas
            .letrinas =
                10.5;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 33
// ------------------------------------------------------------

prueba(
    "33. Rechaza cantidad negativa de letrinas",

    function () {

        const documento =
            documentoValido(
                "LETRINAS_NEGATIVAS"
            );


        documento
            .condiciones_simuladas
            .letrinas =
                NumberInt(-1);


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 34
// ------------------------------------------------------------

prueba(
    "34. litros_agua es opcional",

    function () {

        const documento =
            documentoValido(
                "LITROS_OPCIONAL"
            );


        assertTrue(
            documento
                .condiciones_simuladas
                .litros_agua === undefined,

            "El documento base no debería incluir litros_agua."
        );


        db.escenarios.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 35
// ------------------------------------------------------------

prueba(
    "35. Permite litros_agua numérico no negativo",

    function () {

        const documento =
            documentoValido(
                "LITROS_VALIDOS"
            );


        documento
            .condiciones_simuladas
            .litros_agua =
                2500.5;


        db.escenarios.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 36
// ------------------------------------------------------------

prueba(
    "36. Rechaza litros_agua negativo",

    function () {

        const documento =
            documentoValido(
                "LITROS_NEGATIVOS"
            );


        documento
            .condiciones_simuladas
            .litros_agua =
                -1;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 10. intervenciones_simuladas
// ============================================================


// ------------------------------------------------------------
// PRUEBA 37
// ------------------------------------------------------------

prueba(
    "37. intervenciones_simuladas es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_INTERVENCIONES"
            );


        delete documento
            .intervenciones_simuladas;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 38
// ------------------------------------------------------------

prueba(
    "38. intervenciones_simuladas puede estar vacío",

    function () {

        const documento =
            documentoValido(
                "INTERVENCIONES_VACIAS"
            );


        documento
            .intervenciones_simuladas =
                [];


        db.escenarios.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 39
// ------------------------------------------------------------

prueba(
    "39. Permite intervención simulada válida",

    function () {

        const documento =
            documentoValido(
                "INTERVENCION_VALIDA"
            );


        documento
            .intervenciones_simuladas =
                [

                    {

                        tipo_intervencion:
                            "instalacion_letrinas",

                        descripcion:
                            "Instalar diez letrinas adicionales",

                        observaciones:
                            "Escenario DBA"
                    }
                ];


        db.escenarios.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 40
// ------------------------------------------------------------

prueba(
    "40. Intervención simulada requiere tipo_intervencion",

    function () {

        const documento =
            documentoValido(
                "INTERVENCION_SIN_TIPO"
            );


        documento
            .intervenciones_simuladas =
                [

                    {

                        descripcion:
                            "Prueba"
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 41
// ------------------------------------------------------------

prueba(
    "41. tipo_intervencion no puede ser vacío",

    function () {

        const documento =
            documentoValido(
                "INTERVENCION_TIPO_VACIO"
            );


        documento
            .intervenciones_simuladas =
                [

                    {

                        tipo_intervencion:
                            "",

                        descripcion:
                            "Prueba"
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 42
// ------------------------------------------------------------

prueba(
    "42. Intervención simulada requiere descripcion",

    function () {

        const documento =
            documentoValido(
                "INTERVENCION_SIN_DESCRIPCION"
            );


        documento
            .intervenciones_simuladas =
                [

                    {

                        tipo_intervencion:
                            "prueba"
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 43
// ------------------------------------------------------------

prueba(
    "43. Descripción de intervención no puede ser vacía",

    function () {

        const documento =
            documentoValido(
                "INTERVENCION_DESC_VACIA"
            );


        documento
            .intervenciones_simuladas =
                [

                    {

                        tipo_intervencion:
                            "prueba",

                        descripcion:
                            ""
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 44
// ------------------------------------------------------------

prueba(
    "44. Rechaza propiedades adicionales en intervención simulada",

    function () {

        const documento =
            documentoValido(
                "INTERVENCION_EXTRA"
            );


        documento
            .intervenciones_simuladas =
                [

                    {

                        tipo_intervencion:
                            "prueba",

                        descripcion:
                            "Prueba",

                        ejecutada:
                            true
                    }
                ];


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 11. TRAZABILIDAD
// ============================================================


// ------------------------------------------------------------
// PRUEBA 45
// ------------------------------------------------------------

prueba(
    "45. registrado_por es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_REGISTRADO_POR"
            );


        delete documento.registrado_por;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 46
// ------------------------------------------------------------

prueba(
    "46. registrado_por debe ser ObjectId",

    function () {

        const documento =
            documentoValido(
                "REGISTRADO_TIPO"
            );


        documento.registrado_por =
            "usuario_invalido";


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 47
// ------------------------------------------------------------

prueba(
    "47. created_at es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_CREATED_AT"
            );


        delete documento.created_at;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 48
// ------------------------------------------------------------

prueba(
    "48. created_at debe ser Date",

    function () {

        const documento =
            documentoValido(
                "CREATED_TIPO"
            );


        documento.created_at =
            "2099-01-01";


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 12. CONTRATO CERRADO / APPEND-ONLY
// ============================================================


// ------------------------------------------------------------
// PRUEBA 49
// ------------------------------------------------------------

prueba(
    "49. Rechaza propiedades adicionales de primer nivel",

    function () {

        const documento =
            documentoValido(
                "CAMPO_EXTRA"
            );


        documento.campo_no_permitido =
            true;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 50
// ------------------------------------------------------------

prueba(
    "50. updated_at no pertenece al contrato histórico",

    function () {

        const documento =
            documentoValido(
                "UPDATED_AT"
            );


        documento.updated_at =
            new Date();


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 51
// ------------------------------------------------------------

prueba(
    "51. updated_by no pertenece al contrato histórico",

    function () {

        const documento =
            documentoValido(
                "UPDATED_BY"
            );


        documento.updated_by =
            USUARIO_TEST_ID;


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 52
// ------------------------------------------------------------

prueba(
    "52. Permite escenarios históricos con mismo nombre y fecha",

    function () {

        const documento1 =
            documentoValido(
                "HISTORICO_DUPLICADO"
            );


        const documento2 =
            documentoValido(
                "HISTORICO_DUPLICADO"
            );


        documento1.created_at =
            fechaPrueba(52);


        documento2.created_at =
            fechaPrueba(52);


        const resultado =
            db.escenarios.insertMany(
                [
                    documento1,
                    documento2
                ]
            );


        assertTrue(
            Object.keys(
                resultado.insertedIds
            ).length === 2,

            "No se insertaron ambos escenarios históricos."
        );
    }
);


// ============================================================
// 13. REFERENCIAS LÓGICAS
// ============================================================


// ------------------------------------------------------------
// PRUEBA 53
// ------------------------------------------------------------

prueba(
    "53. Detecta escenario con albergue_id huérfano",

    function () {

        const documento =
            documentoValido(
                "ALBERGUE_HUERFANO"
            );


        documento.albergue_id =
            new ObjectId();


        const insercion =
            db.escenarios.insertOne(
                documento
            );


        const encontrados =
            db.escenarios.aggregate([

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
            encontrados.length === 1,
            "No se detectó el albergue huérfano."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 54
// ------------------------------------------------------------

prueba(
    "54. Detecta escenario con registrado_por huérfano",

    function () {

        const documento =
            documentoValido(
                "USUARIO_HUERFANO"
            );


        documento.registrado_por =
            new ObjectId();


        const insercion =
            db.escenarios.insertOne(
                documento
            );


        const encontrados =
            db.escenarios.aggregate([

                {

                    $match: {

                        _id:
                            insercion.insertedId
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
            encontrados.length === 1,
            "No se detectó registrado_por huérfano."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 55
// ------------------------------------------------------------

prueba(
    "55. Detecta referencias huérfanas en todos los arrays de datos_base",

    function () {

        const configuraciones = [

            [
                "registros_diarios_ids",
                "registros_diarios"
            ],

            [
                "historial_poblacion_ids",
                "historial_poblacion"
            ],

            [
                "condiciones_sanitarias_ids",
                "condiciones_sanitarias"
            ],

            [
                "casos_enfermedades_ids",
                "casos_enfermedades"
            ],

            [
                "metricas_albergue_ids",
                "metricas_albergue"
            ],

            [
                "estados_semaforo_ids",
                "estados_semaforo"
            ]
        ];


        configuraciones.forEach(

            function (configuracion) {

                const campo =
                    configuracion[0];


                const coleccion =
                    configuracion[1];


                const idHuerfano =
                    new ObjectId();


                const documento =
                    documentoValido(
                        "HUERFANO_" +
                        campo
                    );


                documento
                    .datos_base[campo] =
                        [
                            idHuerfano
                        ];


                const insercion =
                    db.escenarios.insertOne(
                        documento
                    );


                const encontrados =
                    db.escenarios.aggregate([

                        {

                            $match: {

                                _id:
                                    insercion.insertedId
                            }
                        },

                        {

                            $unwind: {

                                path:
                                    "$datos_base." +
                                    campo
                            }
                        },

                        {

                            $lookup: {

                                from:
                                    coleccion,

                                localField:
                                    "datos_base." +
                                    campo,

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
                    encontrados.length === 1,

                    "No se detectó referencia huérfana en " +
                    campo
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 56
// ------------------------------------------------------------

prueba(
    "56. Detecta fuente perteneciente a otro albergue",

    function () {

        const condicionOtroAlbergue =
            db.condiciones_sanitarias.insertOne({

                albergue_id:
                    ALBERGUE_OTRO_ID,

                fecha:
                    ISODate(
                        "2099-12-01T13:00:00.000Z"
                    ),

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
            });


        const documento =
            documentoValido(
                "FUENTE_OTRO_ALBERGUE"
            );


        documento
            .datos_base
            .condiciones_sanitarias_ids =
                [
                    condicionOtroAlbergue.insertedId
                ];


        const insercion =
            db.escenarios.insertOne(
                documento
            );


        const encontrados =
            db.escenarios.aggregate([

                {

                    $match: {

                        _id:
                            insercion.insertedId
                    }
                },

                {

                    $unwind: {

                        path:
                            "$datos_base.condiciones_sanitarias_ids"
                    }
                },

                {

                    $lookup: {

                        from:
                            "condiciones_sanitarias",

                        localField:
                            "datos_base.condiciones_sanitarias_ids",

                        foreignField:
                            "_id",

                        as:
                            "condicion_ref"
                    }
                },

                {

                    $unwind: {

                        path:
                            "$condicion_ref"
                    }
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
                }

            ]).toArray();


        assertTrue(
            encontrados.length === 1,
            "No se detectó la fuente de otro albergue."
        );
    }
);


// ============================================================
// 14. ÍNDICES
// ============================================================


// ------------------------------------------------------------
// PRUEBA 57
// ------------------------------------------------------------

prueba(
    "57. Índice de escenarios es correcto y no único",

    function () {

        const indice =
            db.escenarios
                .getIndexes()
                .find(

                    function (item) {

                        return (
                            item.name ===
                            "ix_escenarios_albergue_created_at"
                        );
                    }
                );


        assertTrue(
            indice !== undefined,
            "No existe ix_escenarios_albergue_created_at."
        );


        assertTrue(
            indice.unique !== true,
            "El índice de escenarios no debe ser UNIQUE."
        );


        assertTrue(
            indice.key.albergue_id === 1 &&
            indice.key.created_at === -1,

            "La definición del índice de escenarios es incorrecta."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 58
// ------------------------------------------------------------

prueba(
    "58. Índice IA por escenario es correcto y no único",

    function () {

        const indice =
            db.analisis_ia
                .getIndexes()
                .find(

                    function (item) {

                        return (
                            item.name ===
                            "ix_analisis_ia_escenario_fecha"
                        );
                    }
                );


        assertTrue(
            indice !== undefined,
            "No existe ix_analisis_ia_escenario_fecha."
        );


        assertTrue(
            indice.unique !== true,
            "El índice IA por escenario no debe ser UNIQUE."
        );


        assertTrue(
            indice.key.escenario_id === 1 &&
            indice.key.fecha_ejecucion === -1,

            "La definición del índice IA es incorrecta."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 59
// ------------------------------------------------------------

prueba(
    "59. Índice SIR por escenario es correcto y no único",

    function () {

        const indice =
            db.predicciones_sir
                .getIndexes()
                .find(

                    function (item) {

                        return (
                            item.name ===
                            "ix_predicciones_sir_escenario_fecha"
                        );
                    }
                );


        assertTrue(
            indice !== undefined,
            "No existe ix_predicciones_sir_escenario_fecha."
        );


        assertTrue(
            indice.unique !== true,
            "El índice SIR por escenario no debe ser UNIQUE."
        );


        assertTrue(
            indice.key.escenario_id === 1 &&
            indice.key.fecha_ejecucion === -1,

            "La definición del índice SIR es incorrecta."
        );
    }
);


// ============================================================
// 15. MIGRACIÓN Y VALIDACIÓN
// ============================================================


// ------------------------------------------------------------
// PRUEBA 60
// ------------------------------------------------------------

prueba(
    "60. Migración 014 está registrada exactamente una vez",

    function () {

        const cantidad =
            db.schema_migrations
                .countDocuments({

                    version:
                        "014_create_escenarios"
                });


        assertTrue(
            cantidad === 1,
            "La migración 014 no está registrada exactamente una vez."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 61
// ------------------------------------------------------------

prueba(
    "61. escenarios utiliza validationLevel strict y validationAction error",

    function () {

        const info =
            db.getCollectionInfos({

                name:
                    "escenarios"
            })[0];


        assertTrue(
            info !== undefined,
            "No fue posible consultar escenarios."
        );


        assertTrue(
            info.options.validationLevel ===
            "strict",

            "validationLevel debe ser strict."
        );


        assertTrue(
            info.options.validationAction ===
            "error",

            "validationAction debe ser error."
        );
    }
);


// ============================================================
// 16. INTEGRACIÓN analisis_ia
// ============================================================


// ------------------------------------------------------------
// PRUEBA 62
// ------------------------------------------------------------

prueba(
    "62. analisis_ia puede referenciar escenario válido",

    function () {

        const escenario =
            db.escenarios.insertOne(
                documentoValido(
                    "IA_VALIDO"
                )
            );


        const analisis =
            db.analisis_ia.insertOne(
                crearAnalisisIA(
                    ALBERGUE_TEST_ID,
                    escenario.insertedId,
                    "ia-valido"
                )
            );


        const encontrados =
            db.analisis_ia.aggregate([

                {

                    $match: {

                        _id:
                            analisis.insertedId
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
                }

            ]).toArray();


        assertTrue(
            encontrados.length === 1 &&
            encontrados[0]
                .escenario_ref
                .length === 1,

            "No se resolvió la referencia IA → escenario."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 63
// ------------------------------------------------------------

prueba(
    "63. Detecta escenario_id huérfano en analisis_ia",

    function () {

        const analisis =
            db.analisis_ia.insertOne(
                crearAnalisisIA(
                    ALBERGUE_TEST_ID,
                    new ObjectId(),
                    "ia-huerfano"
                )
            );


        const encontrados =
            db.analisis_ia.aggregate([

                {

                    $match: {

                        _id:
                            analisis.insertedId
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
                }

            ]).toArray();


        assertTrue(
            encontrados.length === 1,
            "No se detectó escenario_id huérfano en IA."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 64
// ------------------------------------------------------------

prueba(
    "64. Detecta IA asociada a escenario de otro albergue",

    function () {

        const escenario =
            db.escenarios.insertOne(
                documentoValido(
                    "IA_OTRO_ALBERGUE"
                )
            );


        const analisis =
            db.analisis_ia.insertOne(
                crearAnalisisIA(
                    ALBERGUE_OTRO_ID,
                    escenario.insertedId,
                    "ia-otro-albergue"
                )
            );


        const encontrados =
            db.analisis_ia.aggregate([

                {

                    $match: {

                        _id:
                            analisis.insertedId
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
                }

            ]).toArray();


        assertTrue(
            encontrados.length === 1,
            "No se detectó inconsistencia IA/albergue."
        );
    }
);


// ============================================================
// 17. INTEGRACIÓN predicciones_sir
// ============================================================


// ------------------------------------------------------------
// PRUEBA 65
// ------------------------------------------------------------

prueba(
    "65. predicciones_sir puede referenciar escenario válido",

    function () {

        const escenario =
            db.escenarios.insertOne(
                documentoValido(
                    "SIR_VALIDO"
                )
            );


        const prediccion =
            db.predicciones_sir.insertOne(
                crearPrediccionSIR(
                    ALBERGUE_TEST_ID,
                    escenario.insertedId,
                    "sir-valido"
                )
            );


        const encontrados =
            db.predicciones_sir.aggregate([

                {

                    $match: {

                        _id:
                            prediccion.insertedId
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
                }

            ]).toArray();


        assertTrue(
            encontrados.length === 1 &&
            encontrados[0]
                .escenario_ref
                .length === 1,

            "No se resolvió la referencia SIR → escenario."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 66
// ------------------------------------------------------------

prueba(
    "66. Detecta escenario_id huérfano en predicciones_sir",

    function () {

        const prediccion =
            db.predicciones_sir.insertOne(
                crearPrediccionSIR(
                    ALBERGUE_TEST_ID,
                    new ObjectId(),
                    "sir-huerfano"
                )
            );


        const encontrados =
            db.predicciones_sir.aggregate([

                {

                    $match: {

                        _id:
                            prediccion.insertedId
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
                }

            ]).toArray();


        assertTrue(
            encontrados.length === 1,
            "No se detectó escenario_id huérfano en SIR."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 67
// ------------------------------------------------------------

prueba(
    "67. Detecta SIR asociado a escenario de otro albergue",

    function () {

        const escenario =
            db.escenarios.insertOne(
                documentoValido(
                    "SIR_OTRO_ALBERGUE"
                )
            );


        const prediccion =
            db.predicciones_sir.insertOne(
                crearPrediccionSIR(
                    ALBERGUE_OTRO_ID,
                    escenario.insertedId,
                    "sir-otro-albergue"
                )
            );


        const encontrados =
            db.predicciones_sir.aggregate([

                {

                    $match: {

                        _id:
                            prediccion.insertedId
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
                }

            ]).toArray();


        assertTrue(
            encontrados.length === 1,
            "No se detectó inconsistencia SIR/albergue."
        );
    }
);


// ============================================================
// 18. SEPARACIÓN INTERVENCIONES REALES / SIMULADAS
// ============================================================


// ------------------------------------------------------------
// PRUEBA 68
// ------------------------------------------------------------

prueba(
    "68. Crear intervención simulada no crea intervención real",

    function () {

        const cantidadAntes =
            db.intervenciones
                .countDocuments({

                    tipo_intervencion:
                        MARCADOR
                });


        const documento =
            documentoValido(
                "SEPARACION_INTERVENCIONES"
            );


        documento
            .intervenciones_simuladas =
                [

                    {

                        tipo_intervencion:
                            MARCADOR,

                        descripcion:
                            "Intervención exclusivamente hipotética"
                    }
                ];


        db.escenarios.insertOne(
            documento
        );


        const cantidadDespues =
            db.intervenciones
                .countDocuments({

                    tipo_intervencion:
                        MARCADOR
                });


        assertTrue(
            cantidadAntes === cantidadDespues,

            "Una intervención simulada alteró la colección intervenciones."
        );
    }
);


// ============================================================
// 19. RESULTADOS ANALÍTICOS NO PERTENECEN AL ESCENARIO
// ============================================================


// ------------------------------------------------------------
// PRUEBA 69
// ------------------------------------------------------------

prueba(
    "69. Rechaza resultados analíticos embebidos fuera del contrato",

    function () {

        const documento =
            documentoValido(
                "RESULTADO_NO_PERMITIDO"
            );


        documento.nivel_riesgo_resultante =
            "rojo";


        esperarErrorValidacion(
            function () {

                db.escenarios.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 20. LIMPIEZA FINAL
// ============================================================

try {

    db.analisis_ia.deleteMany({

        "modelo.nombre":
            MARCADOR_MODELO
    });


    db.predicciones_sir.deleteMany({

        "modelo.nombre":
            MARCADOR_MODELO
    });


    db.escenarios.deleteMany({

        nombre: {

            $regex:
                "^" + MARCADOR
        }
    });


    db.condiciones_sanitarias.deleteMany({

        fuente_datos:
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
// 21. RESULTADO
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
        "Existen pruebas fallidas en escenarios."
    );
}


print("");
print(
    "✓ TODAS LAS PRUEBAS DE ESCENARIOS " +
    "FINALIZARON CORRECTAMENTE."
);

print("");