// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - casos_enfermedades
//
// Migración asociada:
//   006_create_casos_enfermedades
//
// Verifica:
//   - documento válido
//   - campos obligatorios
//   - tipos BSON
//   - cantidad_casos_activos >= 0
//   - enfermedad no vacía
//   - additionalProperties: false
//   - trazabilidad de actualización
//   - índices epidemiológicos
//   - detección de referencias lógicas huérfanas
//   - limpieza de datos temporales
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" PRUEBAS DBA - CASOS DE ENFERMEDADES");
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
// Se utilizan fechas del año 2099 para evitar colisiones con
// información real del proyecto.
// ============================================================

const FECHA_BASE =
    ISODate(
        "2099-07-01T05:00:00.000Z"
    );


const FUENTE_PRUEBA =
    "prueba_dba_casos_enfermedades";


// ============================================================
// 4. LIMPIEZA PREVIA
// ============================================================

db.casos_enfermedades.deleteMany({
    fuente_datos:
        FUENTE_PRUEBA
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// 5. CONSTRUCTOR DE DOCUMENTO VÁLIDO
// ============================================================

function crearCasoValido(
    fecha,
    enfermedad
) {

    return {

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha:
            fecha,

        enfermedad:
            enfermedad || "EDA",

        cantidad_casos_activos:
            NumberInt(5),

        observaciones:
            "Documento temporal de prueba DBA",

        fuente_datos:
            FUENTE_PRUEBA,

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
            new Date()
    };
}


// ============================================================
// 6. PRUEBAS DE VALIDACIÓN
// ============================================================


// ------------------------------------------------------------
// PRUEBA 1
// Documento válido
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Documento válido",
    function () {

        const documento =
            crearCasoValido(
                FECHA_BASE,
                "EDA"
            );

        const resultado =
            db.casos_enfermedades.insertOne(
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
            crearCasoValido(
                ISODate(
                    "2099-07-02T05:00:00.000Z"
                ),
                "EDA"
            );

        delete documento.albergue_id;

        db.casos_enfermedades.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 3
// fecha obligatoria
// ------------------------------------------------------------

pruebaDebeFallar(
    "fecha es obligatoria",
    function () {

        const documento =
            crearCasoValido(
                ISODate(
                    "2099-07-03T05:00:00.000Z"
                ),
                "EDA"
            );

        delete documento.fecha;

        db.casos_enfermedades.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 4
// enfermedad obligatoria
// ------------------------------------------------------------

pruebaDebeFallar(
    "enfermedad es obligatoria",
    function () {

        const documento =
            crearCasoValido(
                ISODate(
                    "2099-07-04T05:00:00.000Z"
                ),
                "EDA"
            );

        delete documento.enfermedad;

        db.casos_enfermedades.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 5
// cantidad_casos_activos obligatoria
// ------------------------------------------------------------

pruebaDebeFallar(
    "cantidad_casos_activos es obligatoria",
    function () {

        const documento =
            crearCasoValido(
                ISODate(
                    "2099-07-05T05:00:00.000Z"
                ),
                "EDA"
            );

        delete documento.cantidad_casos_activos;

        db.casos_enfermedades.insertOne(
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
            crearCasoValido(
                ISODate(
                    "2099-07-06T05:00:00.000Z"
                ),
                "EDA"
            );

        delete documento.fuente_datos;

        db.casos_enfermedades.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 7
// enfermedad no puede estar vacía
// ------------------------------------------------------------

pruebaDebeFallar(
    "enfermedad no puede estar vacía",
    function () {

        const documento =
            crearCasoValido(
                ISODate(
                    "2099-07-07T05:00:00.000Z"
                ),
                "EDA"
            );

        documento.enfermedad =
            "";

        db.casos_enfermedades.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 8
// cantidad_casos_activos no negativa
// ------------------------------------------------------------

pruebaDebeFallar(
    "cantidad_casos_activos no acepta valores negativos",
    function () {

        const documento =
            crearCasoValido(
                ISODate(
                    "2099-07-08T05:00:00.000Z"
                ),
                "IRA"
            );

        documento.cantidad_casos_activos =
            NumberInt(-1);

        db.casos_enfermedades.insertOne(
            documento
        );
    },
    121
);


// ------------------------------------------------------------
// PRUEBA 9
// cantidad_casos_activos debe ser Int32
// ------------------------------------------------------------

pruebaDebeFallar(
    "cantidad_casos_activos debe ser Int32",
    function () {

        const documento =
            crearCasoValido(
                ISODate(
                    "2099-07-09T05:00:00.000Z"
                ),
                "IRA"
            );

        documento.cantidad_casos_activos =
            "5";

        db.casos_enfermedades.insertOne(
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
            crearCasoValido(
                ISODate(
                    "2099-07-10T05:00:00.000Z"
                ),
                "EDA"
            );

        documento.registrado_por =
            "usuario-invalido";

        db.casos_enfermedades.insertOne(
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
            crearCasoValido(
                ISODate(
                    "2099-07-11T05:00:00.000Z"
                ),
                "EDA"
            );

        documento.campo_no_permitido =
            "valor";

        db.casos_enfermedades.insertOne(
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

        const fecha =
            ISODate(
                "2099-07-12T05:00:00.000Z"
            );


        const documento =
            crearCasoValido(
                fecha,
                "IRA"
            );


        const insercion =
            db.casos_enfermedades.insertOne(
                documento
            );


        const resultado =
            db.casos_enfermedades.updateOne(
                {
                    _id:
                        insercion.insertedId
                },
                {
                    $set: {

                        cantidad_casos_activos:
                            NumberInt(7),

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
// Índices requeridos
// ------------------------------------------------------------

pruebaDebeFuncionar(
    "Índices epidemiológicos existentes",
    function () {

        const indices =
            db.casos_enfermedades
                .getIndexes();


        const indiceAlbergueFecha =
            indices.find(
                function (indice) {

                    return (
                        indice.name ===
                        "ix_casos_enfermedades_albergue_fecha"
                    );
                }
            );


        if (
            !indiceAlbergueFecha
        ) {

            throw new Error(
                "No existe ix_casos_enfermedades_albergue_fecha."
            );
        }


        const indiceEnfermedadFecha =
            indices.find(
                function (indice) {

                    return (
                        indice.name ===
                        "ix_casos_enfermedades_albergue_enfermedad_fecha"
                    );
                }
            );


        if (
            !indiceEnfermedadFecha
        ) {

            throw new Error(
                "No existe " +
                "ix_casos_enfermedades_albergue_enfermedad_fecha."
            );
        }
    }
);


// ------------------------------------------------------------
// PRUEBA 14
// Detección DBA de referencia huérfana
// ------------------------------------------------------------
//
// MongoDB acepta un ObjectId estructuralmente válido aunque
// no exista en albergues.
//
// Esta prueba demuestra que el control DBA con $lookup puede
// detectar la inconsistencia.
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
            crearCasoValido(
                ISODate(
                    "2099-07-13T05:00:00.000Z"
                ),
                "EDA"
            );


        documento.albergue_id =
            albergueHuerfanoId;


        const resultadoInsercion =
            db.casos_enfermedades.insertOne(
                documento
            );


        const huerfanos =
            db.casos_enfermedades.aggregate([

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


        db.casos_enfermedades.deleteOne({
            _id:
                resultadoInsercion.insertedId
        });
    }
);


// ============================================================
// 7. LIMPIEZA FINAL
// ============================================================

try {

    db.casos_enfermedades.deleteMany({
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
        "Existen pruebas fallidas en casos_enfermedades."
    );
}


print("");
print(
    "✓ TODAS LAS PRUEBAS DE CASOS_ENFERMEDADES " +
    "FINALIZARON CORRECTAMENTE."
);

print("");