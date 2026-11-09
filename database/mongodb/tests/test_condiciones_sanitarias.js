// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - condiciones_sanitarias
//
// Migración asociada:
//   005_create_condiciones_sanitarias
//
// Verifica:
//   - documento válido
//   - campos obligatorios
//   - tipos BSON
//   - valores >= 0
//   - recursos sanitarios embebidos
//   - additionalProperties: false
//   - índice albergue + fecha
//   - detección de referencias lógicas huérfanas
//   - limpieza de datos temporales
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" PRUEBAS DBA - CONDICIONES SANITARIAS");
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
// 2. OBTENER DATOS REALES DE REFERENCIA
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
// 3. FECHAS TEMPORALES
// ============================================================
//
// Fechas 2099 para evitar colisión con datos reales.
// ============================================================

const FECHA_BASE =
    ISODate(
        "2099-06-01T05:00:00.000Z"
    );


// ============================================================
// 4. CONSTRUCTOR DOCUMENTO VÁLIDO
// ============================================================

function crearCondicionValida(
    fecha
) {

    return {

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha:
            fecha,

        agua_potable_disponible:
            true,

        banos_disponibles:
            NumberInt(5),

        estado_higiene:
            "adecuado",

        estado_saneamiento:
            "adecuado",

        otros_recursos_sanitarios: [
            {
                nombre:
                    "Kit de higiene",

                cantidad:
                    NumberInt(10),

                observacion:
                    "Registro temporal de prueba"
            }
        ],

        observaciones:
            "Documento temporal de prueba",

        fuente_datos:
            "prueba_dba",

        registrado_por:
            USUARIO_TEST_ID,

        created_at:
            new Date()
    };
}


// ============================================================
// 5. LIMPIEZA PREVIA
// ============================================================

db.condiciones_sanitarias.deleteMany({

    albergue_id:
        ALBERGUE_TEST_ID,

    fecha: {

        $gte:
            ISODate(
                "2099-01-01T05:00:00.000Z"
            )
    }
});


db.condiciones_sanitarias.deleteMany({

    fuente_datos:
        "prueba_dba_huerfano"
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// PRUEBA 1
// documento válido
// ============================================================

pruebaDebeFuncionar(
    "documento válido",

    function () {

        db.condiciones_sanitarias.insertOne(
            crearCondicionValida(
                FECHA_BASE
            )
        );
    }
);


// ============================================================
// PRUEBA 2
// albergue_id obligatorio
// ============================================================

pruebaDebeFallar(
    "albergue_id obligatorio",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-02T05:00:00.000Z"
                )
            );

        delete documento.albergue_id;

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 3
// fecha obligatoria
// ============================================================

pruebaDebeFallar(
    "fecha obligatoria",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-03T05:00:00.000Z"
                )
            );

        delete documento.fecha;

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 4
// banos_disponibles negativo
// ============================================================

pruebaDebeFallar(
    "banos_disponibles negativo",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-04T05:00:00.000Z"
                )
            );

        documento.banos_disponibles =
            NumberInt(-1);

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 5
// agua_potable_disponible tipo incorrecto
// ============================================================

pruebaDebeFallar(
    "agua_potable_disponible debe ser Boolean",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-05T05:00:00.000Z"
                )
            );

        documento.agua_potable_disponible =
            "si";

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 6
// estado_higiene vacío
// ============================================================

pruebaDebeFallar(
    "estado_higiene no puede estar vacío",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-06T05:00:00.000Z"
                )
            );

        documento.estado_higiene =
            "";

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 7
// estado_saneamiento obligatorio
// ============================================================

pruebaDebeFallar(
    "estado_saneamiento obligatorio",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-07T05:00:00.000Z"
                )
            );

        delete documento.estado_saneamiento;

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 8
// fuente_datos obligatoria
// ============================================================

pruebaDebeFallar(
    "fuente_datos obligatoria",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-08T05:00:00.000Z"
                )
            );

        delete documento.fuente_datos;

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 9
// cantidad negativa en recurso sanitario
// ============================================================

pruebaDebeFallar(
    "cantidad de recurso sanitario negativa",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-09T05:00:00.000Z"
                )
            );

        documento
            .otros_recursos_sanitarios[0]
            .cantidad =
                NumberInt(-1);

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 10
// propiedad no permitida
// ============================================================

pruebaDebeFallar(
    "propiedad adicional no permitida",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-10T05:00:00.000Z"
                )
            );

        documento.campo_inexistente =
            "no permitido";

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 11
// registrado_por tipo incorrecto
// ============================================================

pruebaDebeFallar(
    "registrado_por debe ser ObjectId",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-11T05:00:00.000Z"
                )
            );

        documento.registrado_por =
            "usuario";

        db.condiciones_sanitarias.insertOne(
            documento
        );
    },

    121
);


// ============================================================
// PRUEBA 12
// updated_by válido
// ============================================================

pruebaDebeFuncionar(
    "updated_by ObjectId válido",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-12T05:00:00.000Z"
                )
            );

        documento.updated_at =
            new Date();

        documento.updated_by =
            USUARIO_TEST_ID;

        db.condiciones_sanitarias.insertOne(
            documento
        );
    }
);


// ============================================================
// PRUEBA 13
// validar índice
// ============================================================

pruebaDebeFuncionar(
    "índice albergue + fecha disponible",

    function () {

        const indices =
            db.condiciones_sanitarias
                .getIndexes();

        const encontrado =
            indices.some(
                function (indice) {

                    return (
                        indice.name ===
                        "ix_condiciones_sanitarias_albergue_fecha"
                    );
                }
            );


        if (!encontrado) {

            throw new Error(
                "Índice no encontrado."
            );
        }
    }
);


// ============================================================
// PRUEBA 14
// MongoDB permite ObjectId estructuralmente válido aunque
// la referencia no exista.
// El control DBA debe detectar el documento huérfano.
// ============================================================

const ID_ALBERGUE_INEXISTENTE =
    ObjectId(
        "ffffffffffffffffffffffff"
    );


pruebaDebeFuncionar(
    "detección DBA de albergue_id huérfano",

    function () {

        const documento =
            crearCondicionValida(
                ISODate(
                    "2099-06-13T05:00:00.000Z"
                )
            );

        documento.albergue_id =
            ID_ALBERGUE_INEXISTENTE;

        documento.fuente_datos =
            "prueba_dba_huerfano";


        const resultadoInsert =
            db.condiciones_sanitarias
                .insertOne(
                    documento
                );


        const huerfanos =
            db.condiciones_sanitarias.aggregate([

                {
                    $match: {
                        _id:
                            resultadoInsert.insertedId
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


        db.condiciones_sanitarias.deleteOne({
            _id:
                resultadoInsert.insertedId
        });
    }
);


// ============================================================
// 6. LIMPIEZA FINAL
// ============================================================

db.condiciones_sanitarias.deleteMany({

    albergue_id:
        ALBERGUE_TEST_ID,

    fecha: {

        $gte:
            ISODate(
                "2099-01-01T05:00:00.000Z"
            )
    }
});


db.condiciones_sanitarias.deleteMany({

    fuente_datos:
        "prueba_dba_huerfano"
});


// ============================================================
// 7. VERIFICAR LIMPIEZA
// ============================================================

const documentosTemporales =
    db.condiciones_sanitarias.countDocuments({

        $or: [

            {
                albergue_id:
                    ALBERGUE_TEST_ID,

                fecha: {

                    $gte:
                        ISODate(
                            "2099-01-01T05:00:00.000Z"
                        )
                }
            },

            {
                fuente_datos:
                    "prueba_dba_huerfano"
            }
        ]
    });


if (
    documentosTemporales !== 0
) {

    print(
        "✗ FALLÓ: quedaron " +
        documentosTemporales +
        " documentos temporales."
    );

    pruebasFallidas++;

} else {

    print(
        "✓ OK: limpieza de documentos temporales"
    );
}


// ============================================================
// 8. RESULTADO FINAL
// ============================================================

print("");
print("------------------------------------------");
print(" RESULTADO");
print("------------------------------------------");

print(
    "Pruebas exitosas: " +
    pruebasExitosas
);

print(
    "Pruebas fallidas: " +
    pruebasFallidas
);

print("------------------------------------------");


if (
    pruebasFallidas > 0
) {

    throw new Error(
        "La batería de pruebas de condiciones_sanitarias " +
        "presentó fallos."
    );
}


print("");
print(
    "✓ TODAS LAS PRUEBAS DE CONDICIONES_SANITARIAS " +
    "FINALIZARON CORRECTAMENTE."
);