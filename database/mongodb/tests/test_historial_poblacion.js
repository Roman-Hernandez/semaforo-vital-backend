// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - historial_poblacion
//
// Objetivo:
//   Validar la colección incorporada por la migración
//   010_create_historial_poblacion.
//
// IMPORTANTE:
//   Estas pruebas NO modifican la migración 010.
//   Validan el contrato estructural que quedó disponible
//   después del cambio realizado por Backend.
//
// Cobertura:
//   - validator
//   - tipos BSON
//   - campos obligatorios
//   - población no negativa
//   - población Int32
//   - additionalProperties false
//   - trazabilidad
//   - población cero
//   - múltiples fechas
//   - unicidad albergue + fecha
//   - índice
//   - migración registrada
//   - referencias huérfanas detectables
//
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" SEMÁFORO VITAL");
print(" PRUEBAS DBA - historial_poblacion");
print("====================================================");
print("");

let pruebasExitosas = 0;
let pruebasFallidas = 0;


// ============================================================
// UTILIDADES
// ============================================================

function prueba(nombre, funcion) {

    try {

        funcion();

        pruebasExitosas++;

        print(
            "✓ " + nombre
        );

    } catch (error) {

        pruebasFallidas++;

        print(
            "✗ " + nombre
        );

        print(
            "  " + error.message
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


function esperarErrorDuplicado(
    funcion
) {

    let errorDetectado = false;

    try {

        funcion();

    } catch (error) {

        if (
            error.code === 11000
        ) {

            errorDetectado = true;

        } else {

            throw error;
        }
    }


    if (!errorDetectado) {

        throw new Error(
            "Se esperaba error de índice único 11000."
        );
    }
}


// ============================================================
// PRECONDICIONES
// ============================================================

assertTrue(
    db
        .getCollectionNames()
        .includes(
            "historial_poblacion"
        ),
    "No existe la colección historial_poblacion."
);


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


const albergueId =
    alberguePrueba._id;


const usuarioId =
    usuarioPrueba._id;


// ============================================================
// RANGO RESERVADO PARA PRUEBAS
// ============================================================
//
// Se utilizan fechas futuras únicamente para aislar documentos
// temporales de prueba.
//
// ============================================================

const FECHA_INICIO_PRUEBAS =
    ISODate(
        "2099-12-10T05:00:00.000Z"
    );


const FECHA_FIN_PRUEBAS =
    ISODate(
        "2099-12-31T05:00:00.000Z"
    );


// ============================================================
// LIMPIEZA PREVIA
// ============================================================

db.historial_poblacion.deleteMany({

    fecha: {

        $gte:
            FECHA_INICIO_PRUEBAS,

        $lte:
            FECHA_FIN_PRUEBAS
    }
});


// ============================================================
// FACTORÍA DOCUMENTO VÁLIDO
// ============================================================

function documentoValido(
    fecha,
    poblacion
) {

    return {

        albergue_id:
            albergueId,

        fecha:
            fecha,

        poblacion:
            NumberInt(
                poblacion
            ),

        registrado_por:
            usuarioId,

        created_at:
            new Date()
    };
}


// ============================================================
// 1. DOCUMENTO VÁLIDO
// ============================================================

prueba(
    "1. Permite insertar un documento válido",

    function () {

        const fecha =
            ISODate(
                "2099-12-10T05:00:00.000Z"
            );


        const resultado =
            db.historial_poblacion.insertOne(
                documentoValido(
                    fecha,
                    100
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
                    "2099-12-11T05:00:00.000Z"
                ),
                101
            );


        delete documento.albergue_id;


        esperarErrorValidacion(
            function () {

                db.historial_poblacion.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 3. fecha OBLIGATORIA
// ============================================================

prueba(
    "3. Rechaza documento sin fecha",

    function () {

        const documento =
            documentoValido(
                ISODate(
                    "2099-12-11T05:00:00.000Z"
                ),
                101
            );


        delete documento.fecha;


        esperarErrorValidacion(
            function () {

                db.historial_poblacion.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 4. poblacion OBLIGATORIA
// ============================================================

prueba(
    "4. Rechaza documento sin poblacion",

    function () {

        const documento =
            documentoValido(
                ISODate(
                    "2099-12-11T05:00:00.000Z"
                ),
                101
            );


        delete documento.poblacion;


        esperarErrorValidacion(
            function () {

                db.historial_poblacion.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 5. registrado_por OBLIGATORIO
// ============================================================

prueba(
    "5. Rechaza documento sin registrado_por",

    function () {

        const documento =
            documentoValido(
                ISODate(
                    "2099-12-11T05:00:00.000Z"
                ),
                101
            );


        delete documento.registrado_por;


        esperarErrorValidacion(
            function () {

                db.historial_poblacion.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 6. created_at OBLIGATORIO
// ============================================================

prueba(
    "6. Rechaza documento sin created_at",

    function () {

        const documento =
            documentoValido(
                ISODate(
                    "2099-12-11T05:00:00.000Z"
                ),
                101
            );


        delete documento.created_at;


        esperarErrorValidacion(
            function () {

                db.historial_poblacion.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 7. POBLACIÓN NEGATIVA
// ============================================================

prueba(
    "7. Rechaza población negativa",

    function () {

        const documento =
            documentoValido(
                ISODate(
                    "2099-12-11T05:00:00.000Z"
                ),
                101
            );


        documento.poblacion =
            NumberInt(
                -1
            );


        esperarErrorValidacion(
            function () {

                db.historial_poblacion.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 8. POBLACIÓN DEBE SER Int32
// ============================================================

prueba(
    "8. Rechaza población Double",

    function () {

        const documento =
            documentoValido(
                ISODate(
                    "2099-12-11T05:00:00.000Z"
                ),
                101
            );


        documento.poblacion =
            101.5;


        esperarErrorValidacion(
            function () {

                db.historial_poblacion.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 9. additionalProperties = false
// ============================================================

prueba(
    "9. Rechaza propiedades adicionales",

    function () {

        const documento =
            documentoValido(
                ISODate(
                    "2099-12-11T05:00:00.000Z"
                ),
                101
            );


        documento.campo_no_autorizado =
            "NO DEBE EXISTIR";


        esperarErrorValidacion(
            function () {

                db.historial_poblacion.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 10. POBLACIÓN CERO
// ============================================================

prueba(
    "10. Permite población igual a cero",

    function () {

        const fecha =
            ISODate(
                "2099-12-12T05:00:00.000Z"
            );


        const resultado =
            db.historial_poblacion.insertOne(
                documentoValido(
                    fecha,
                    0
                )
            );


        const documento =
            db.historial_poblacion.findOne({

                _id:
                    resultado.insertedId
            });


        assertTrue(
            Number(
                documento.poblacion
            ) === 0,
            "La población cero no fue almacenada correctamente."
        );
    }
);


// ============================================================
// 11. TRAZABILIDAD DE ACTUALIZACIÓN
// ============================================================

prueba(
    "11. Permite updated_at y updated_by",

    function () {

        const fecha =
            ISODate(
                "2099-12-13T05:00:00.000Z"
            );


        const documento =
            documentoValido(
                fecha,
                125
            );


        documento.updated_at =
            new Date();


        documento.updated_by =
            usuarioId;


        const resultado =
            db.historial_poblacion.insertOne(
                documento
            );


        const guardado =
            db.historial_poblacion.findOne({

                _id:
                    resultado.insertedId
            });


        assertTrue(
            guardado.updated_at instanceof Date,
            "updated_at no fue almacenado como Date."
        );


        assertTrue(
            guardado.updated_by.equals(
                usuarioId
            ),
            "updated_by no fue almacenado correctamente."
        );
    }
);


// ============================================================
// 12. MISMO ALBERGUE EN DIFERENTES FECHAS
// ============================================================

prueba(
    "12. Permite múltiples fechas para el mismo albergue",

    function () {

        const fechaA =
            ISODate(
                "2099-12-14T05:00:00.000Z"
            );


        const fechaB =
            ISODate(
                "2099-12-15T05:00:00.000Z"
            );


        db.historial_poblacion.insertOne(
            documentoValido(
                fechaA,
                130
            )
        );


        db.historial_poblacion.insertOne(
            documentoValido(
                fechaB,
                135
            )
        );


        const cantidad =
            db.historial_poblacion.countDocuments({

                albergue_id:
                    albergueId,

                fecha: {

                    $in: [
                        fechaA,
                        fechaB
                    ]
                }
            });


        assertTrue(
            cantidad === 2,
            "No se conservaron ambas fechas."
        );
    }
);


// ============================================================
// 13. UNICIDAD albergue + fecha
// ============================================================

prueba(
    "13. Rechaza duplicado del mismo albergue y fecha",

    function () {

        const fecha =
            ISODate(
                "2099-12-16T05:00:00.000Z"
            );


        db.historial_poblacion.insertOne(
            documentoValido(
                fecha,
                140
            )
        );


        esperarErrorDuplicado(
            function () {

                db.historial_poblacion.insertOne(
                    documentoValido(
                        fecha,
                        999
                    )
                );
            }
        );
    }
);


// ============================================================
// 14. ÍNDICE ÚNICO
// ============================================================

prueba(
    "14. Índice ux_historial_poblacion_albergue_fecha correcto",

    function () {

        const indices =
            db.historial_poblacion
                .getIndexes();


        const indice =
            indices.find(
                function (item) {

                    return (
                        item.name ===
                        "ux_historial_poblacion_albergue_fecha"
                    );
                }
            );


        assertTrue(
            indice !== undefined,
            "No existe ux_historial_poblacion_albergue_fecha."
        );


        assertTrue(
            indice.unique === true,
            "El índice debe ser UNIQUE."
        );


        assertTrue(
            indice.key.albergue_id === 1,
            "albergue_id debe tener orden 1."
        );


        assertTrue(
            indice.key.fecha === -1,
            "fecha debe tener orden -1."
        );
    }
);


// ============================================================
// 15. MIGRACIÓN REGISTRADA UNA SOLA VEZ
// ============================================================

prueba(
    "15. Migración 010 registrada exactamente una vez",

    function () {

        const cantidad =
            db.schema_migrations.countDocuments({

                version:
                    "010_create_historial_poblacion"
            });


        assertTrue(
            cantidad === 1,
            "La migración 010 debe estar registrada exactamente una vez."
        );
    }
);


// ============================================================
// 16. ALBERGUE HUÉRFANO DETECTABLE
// ============================================================

prueba(
    "16. Detecta albergue_id huérfano mediante $lookup",

    function () {

        const albergueHuerfano =
            new ObjectId();


        const fecha =
            ISODate(
                "2099-12-20T05:00:00.000Z"
            );


        db.historial_poblacion.insertOne({

            albergue_id:
                albergueHuerfano,

            fecha:
                fecha,

            poblacion:
                NumberInt(
                    10
                ),

            registrado_por:
                usuarioId,

            created_at:
                new Date()
        });


        const huerfanos =
            db.historial_poblacion.aggregate([

                {
                    $match: {

                        fecha:
                            fecha
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
            "No fue posible detectar el albergue huérfano."
        );
    }
);


// ============================================================
// 17. registrado_por HUÉRFANO DETECTABLE
// ============================================================

prueba(
    "17. Detecta registrado_por huérfano mediante $lookup",

    function () {

        const usuarioHuerfano =
            new ObjectId();


        const fecha =
            ISODate(
                "2099-12-21T05:00:00.000Z"
            );


        db.historial_poblacion.insertOne({

            albergue_id:
                albergueId,

            fecha:
                fecha,

            poblacion:
                NumberInt(
                    20
                ),

            registrado_por:
                usuarioHuerfano,

            created_at:
                new Date()
        });


        const huerfanos =
            db.historial_poblacion.aggregate([

                {
                    $match: {

                        fecha:
                            fecha
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
            "No fue posible detectar registrado_por huérfano."
        );
    }
);


// ============================================================
// 18. updated_by HUÉRFANO DETECTABLE
// ============================================================

prueba(
    "18. Detecta updated_by huérfano mediante $lookup",

    function () {

        const usuarioHuerfano =
            new ObjectId();


        const fecha =
            ISODate(
                "2099-12-22T05:00:00.000Z"
            );


        db.historial_poblacion.insertOne({

            albergue_id:
                albergueId,

            fecha:
                fecha,

            poblacion:
                NumberInt(
                    30
                ),

            registrado_por:
                usuarioId,

            created_at:
                new Date(),

            updated_at:
                new Date(),

            updated_by:
                usuarioHuerfano
        });


        const huerfanos =
            db.historial_poblacion.aggregate([

                {
                    $match: {

                        fecha:
                            fecha,

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
            "No fue posible detectar updated_by huérfano."
        );
    }
);


// ============================================================
// LIMPIEZA FINAL
// ============================================================

db.historial_poblacion.deleteMany({

    fecha: {

        $gte:
            FECHA_INICIO_PRUEBAS,

        $lte:
            FECHA_FIN_PRUEBAS
    }
});


// ============================================================
// RESULTADOS
// ============================================================

print("");
print("====================================================");
print(" RESULTADO PRUEBAS DBA - historial_poblacion");
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
        "La suite DBA de historial_poblacion presentó fallos."
    );
}


if (
    pruebasExitosas !== 18
) {

    throw new Error(
        "Se esperaban exactamente 18 pruebas exitosas."
    );
}


print(
    "✓ Suite DBA historial_poblacion finalizada correctamente."
);

print("");