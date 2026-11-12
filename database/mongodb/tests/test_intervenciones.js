// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - intervenciones
//
// Migración asociada:
//   007_create_intervenciones
//
// Verifica:
//   - documento válido
//   - campos obligatorios
//   - tipos BSON
//   - strings no vacíos
//   - additionalProperties: false
//   - trazabilidad de actualización
//   - múltiples intervenciones en misma fecha/tipo
//   - índices requeridos
//   - detección de referencias lógicas huérfanas
//   - limpieza de datos temporales
//
// IMPORTANTE:
//
// La colección intervenciones representa acciones REALES
// ejecutadas.
//
// No representa simulaciones ni escenarios hipotéticos.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" PRUEBAS DBA - INTERVENCIONES");
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


print(
    "✓ Albergue de prueba disponible."
);

print(
    "✓ Usuario de prueba disponible."
);


// ============================================================
// 3. DATOS TEMPORALES
// ============================================================
//
// Se utilizan fechas de 2099 para evitar colisiones con
// información real.
// ============================================================

const FECHA_BASE =
    ISODate(
        "2099-08-01T05:00:00.000Z"
    );


const FUENTE_PRUEBA =
    "prueba_dba_intervenciones";


// ============================================================
// 4. LIMPIEZA PREVIA
// ============================================================

db.intervenciones.deleteMany({
    fuente_datos:
        FUENTE_PRUEBA
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// 5. CONSTRUCTOR DE DOCUMENTO VÁLIDO
// ============================================================

function crearIntervencionValida(
    fecha,
    tipo
) {

    return {

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha_intervencion:
            fecha,

        tipo_intervencion:
            tipo || "saneamiento",

        descripcion:
            "Intervención real ejecutada para prueba DBA",

        observaciones:
            "Documento temporal de prueba",

        fuente_datos:
            FUENTE_PRUEBA,

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
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
    "Documento válido",
    function () {

        const documento =
            crearIntervencionValida(
                FECHA_BASE,
                "saneamiento"
            );


        const resultado =
            db.intervenciones.insertOne(
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
            crearIntervencionValida(
                ISODate(
                    "2099-08-02T05:00:00.000Z"
                ),
                "agua"
            );

        delete documento.albergue_id;

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 3
// fecha_intervencion obligatoria
// ------------------------------------------------------------

pruebaDebeFallar(
    "fecha_intervencion es obligatoria",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-03T05:00:00.000Z"
                ),
                "agua"
            );

        delete documento.fecha_intervencion;

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 4
// tipo_intervencion obligatorio
// ------------------------------------------------------------

pruebaDebeFallar(
    "tipo_intervencion es obligatorio",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-04T05:00:00.000Z"
                ),
                "agua"
            );

        delete documento.tipo_intervencion;

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 5
// descripcion obligatoria
// ------------------------------------------------------------

pruebaDebeFallar(
    "descripcion es obligatoria",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-05T05:00:00.000Z"
                ),
                "higiene"
            );

        delete documento.descripcion;

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 6
// fuente_datos obligatoria
// ------------------------------------------------------------

pruebaDebeFallar(
    "fuente_datos es obligatoria",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-06T05:00:00.000Z"
                ),
                "higiene"
            );

        delete documento.fuente_datos;

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 7
// tipo_intervencion no vacío
// ------------------------------------------------------------

pruebaDebeFallar(
    "tipo_intervencion no puede estar vacío",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-07T05:00:00.000Z"
                ),
                "agua"
            );

        documento.tipo_intervencion =
            "";

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 8
// descripcion no vacía
// ------------------------------------------------------------

pruebaDebeFallar(
    "descripcion no puede estar vacía",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-08T05:00:00.000Z"
                ),
                "saneamiento"
            );

        documento.descripcion =
            "";

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 9
// fecha_intervencion debe ser Date
// ------------------------------------------------------------

pruebaDebeFallar(
    "fecha_intervencion debe ser Date",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-09T05:00:00.000Z"
                ),
                "agua"
            );

        documento.fecha_intervencion =
            "2099-08-09";

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 10
// registrado_por debe ser ObjectId
// ------------------------------------------------------------

pruebaDebeFallar(
    "registrado_por debe ser ObjectId",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-10T05:00:00.000Z"
                ),
                "agua"
            );

        documento.registrado_por =
            "usuario-invalido";

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 11
// additionalProperties: false
// ------------------------------------------------------------

pruebaDebeFallar(
    "Propiedades adicionales son rechazadas",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-11T05:00:00.000Z"
                ),
                "saneamiento"
            );

        documento.campo_no_permitido =
            "valor";

        db.intervenciones.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 12
// Trazabilidad válida
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "updated_at y updated_by válidos",
    function () {

        const documento =
            crearIntervencionValida(
                ISODate(
                    "2099-08-12T05:00:00.000Z"
                ),
                "higiene"
            );


        const insercion =
            db.intervenciones.insertOne(
                documento
            );


        const resultado =
            db.intervenciones.updateOne(
                {
                    _id:
                        insercion.insertedId
                },
                {
                    $set: {

                        observaciones:
                            "Intervención actualizada durante prueba DBA",

                        updated_at:
                            new Date(),

                        updated_by:
                            USUARIO_TEST_ID
                    }
                }
            );


        if (
            resultado.matchedCount !== 1
        ) {

            throw new Error(
                "No se encontró el documento para actualizar."
            );
        }


        if (
            resultado.modifiedCount !== 1
        ) {

            throw new Error(
                "El documento no fue modificado."
            );
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 13
// Varias intervenciones del mismo tipo y fecha son válidas
// ------------------------------------------------------------
//
// Esto demuestra que NO existe una restricción de unicidad
// por albergue + tipo + fecha.
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Permite múltiples intervenciones del mismo tipo y fecha",
    function () {

        const fecha =
            ISODate(
                "2099-08-13T05:00:00.000Z"
            );


        const documento1 =
            crearIntervencionValida(
                fecha,
                "saneamiento"
            );


        documento1.descripcion =
            "Primera intervención del día";


        const documento2 =
            crearIntervencionValida(
                fecha,
                "saneamiento"
            );


        documento2.descripcion =
            "Segunda intervención del día";


        db.intervenciones.insertOne(
            documento1
        );


        db.intervenciones.insertOne(
            documento2
        );


        const cantidad =
            db.intervenciones.countDocuments({
                albergue_id:
                    ALBERGUE_TEST_ID,

                fecha_intervencion:
                    fecha,

                tipo_intervencion:
                    "saneamiento",

                fuente_datos:
                    FUENTE_PRUEBA
            });


        if (
            cantidad !== 2
        ) {

            throw new Error(
                "No se registraron correctamente " +
                "las dos intervenciones independientes."
            );
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 14
// Índices requeridos
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Índices de intervenciones existentes",
    function () {

        const indices =
            db.intervenciones
                .getIndexes();


        const indiceAlbergueFecha =
            indices.find(
                function (indice) {

                    return (
                        indice.name ===
                        "ix_intervenciones_albergue_fecha"
                    );
                }
            );


        if (
            !indiceAlbergueFecha
        ) {

            throw new Error(
                "No existe ix_intervenciones_albergue_fecha."
            );
        }


        const indiceAlbergueTipoFecha =
            indices.find(
                function (indice) {

                    return (
                        indice.name ===
                        "ix_intervenciones_albergue_tipo_fecha"
                    );
                }
            );


        if (
            !indiceAlbergueTipoFecha
        ) {

            throw new Error(
                "No existe " +
                "ix_intervenciones_albergue_tipo_fecha."
            );
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 15
// Detección DBA de albergue_id huérfano
// ------------------------------------------------------------
//
// MongoDB puede aceptar un ObjectId estructuralmente válido
// aunque no exista en albergues.
//
// Esta prueba demuestra que el control DBA con $lookup puede
// detectar esa inconsistencia.
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
            crearIntervencionValida(
                ISODate(
                    "2099-08-14T05:00:00.000Z"
                ),
                "saneamiento"
            );


        documento.albergue_id =
            albergueHuerfanoId;


        const resultadoInsercion =
            db.intervenciones.insertOne(
                documento
            );


        const huerfanos =
            db.intervenciones.aggregate([

                {
                    $match: {

                        _id:
                            resultadoInsercion.insertedId
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


        db.intervenciones.deleteOne({
            _id:
                resultadoInsercion.insertedId
        });
    }
);


// ============================================================
// 7. LIMPIEZA FINAL
// ============================================================

try {

    db.intervenciones.deleteMany({
        fuente_datos:
            FUENTE_PRUEBA
    });


    print("");
    print(
        "✓ OK: limpieza de documentos temporales"
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
        "Existen pruebas fallidas en intervenciones."
    );
}


print("");
print(
    "✓ TODAS LAS PRUEBAS DE INTERVENCIONES " +
    "FINALIZARON CORRECTAMENTE."
);

print("");