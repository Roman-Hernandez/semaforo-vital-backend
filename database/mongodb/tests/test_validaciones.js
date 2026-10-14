// ============================================================
// SEMÁFORO VITAL
// US-08 - Pruebas de validación MongoDB
//
// Verifica:
//   - restricciones >= 0
//   - campos obligatorios de trazabilidad
//   - índice único albergue_id + fecha
//
// Base de datos:
//   semaforo_vital
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("==========================================");
print(" SEMÁFORO VITAL - PRUEBAS MONGODB");
print("==========================================");
print("Base de datos: " + db.getName());
print("");

let pruebasExitosas = 0;
let pruebasFallidas = 0;


// ============================================================
// IDENTIFICADORES DE PRUEBA
// ============================================================

// Corresponde al albergue crítico creado por los datos semilla.
const ALBERGUE_TEST_ID =
    ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa");

const USUARIO_TEST_ID =
    ObjectId("eeeeeeeeeeeeeeeeeeeeeeee");


// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function crearRegistroValido(fecha) {
    return {
        albergue_id: ALBERGUE_TEST_ID,

        fecha: fecha,

        poblacion: NumberInt(100),

        litros_agua: 1500.0,

        letrinas: NumberInt(5),

        casos_eda: NumberInt(0),

        casos_ira: NumberInt(0),

        registrado_por: USUARIO_TEST_ID,

        created_at: new Date()
    };
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

        if (e.code === codigoEsperado) {

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


// ============================================================
// LIMPIEZA PREVIA
// ============================================================

db.registros_diarios.deleteMany({
    albergue_id: ALBERGUE_TEST_ID,
    fecha: {
        $gte: ISODate("2099-01-01T00:00:00.000Z")
    }
});


// ============================================================
// PRUEBA 1
// población negativa
// ============================================================

pruebaDebeFallar(
    "poblacion negativa",
    function () {

        const documento =
            crearRegistroValido(
                ISODate("2099-01-01T00:00:00.000Z")
            );

        documento.poblacion =
            NumberInt(-1);

        db.registros_diarios.insertOne(
            documento
        );
    },
    121
);


// ============================================================
// PRUEBA 2
// litros de agua negativos
// ============================================================

pruebaDebeFallar(
    "litros_agua negativos",
    function () {

        const documento =
            crearRegistroValido(
                ISODate("2099-01-02T00:00:00.000Z")
            );

        documento.litros_agua =
            -1.0;

        db.registros_diarios.insertOne(
            documento
        );
    },
    121
);


// ============================================================
// PRUEBA 3
// letrinas negativas
// ============================================================

pruebaDebeFallar(
    "letrinas negativas",
    function () {

        const documento =
            crearRegistroValido(
                ISODate("2099-01-03T00:00:00.000Z")
            );

        documento.letrinas =
            NumberInt(-1);

        db.registros_diarios.insertOne(
            documento
        );
    },
    121
);


// ============================================================
// PRUEBA 4
// casos EDA negativos
// ============================================================

pruebaDebeFallar(
    "casos_eda negativos",
    function () {

        const documento =
            crearRegistroValido(
                ISODate("2099-01-04T00:00:00.000Z")
            );

        documento.casos_eda =
            NumberInt(-1);

        db.registros_diarios.insertOne(
            documento
        );
    },
    121
);


// ============================================================
// PRUEBA 5
// casos IRA negativos
// ============================================================

pruebaDebeFallar(
    "casos_ira negativos",
    function () {

        const documento =
            crearRegistroValido(
                ISODate("2099-01-05T00:00:00.000Z")
            );

        documento.casos_ira =
            NumberInt(-1);

        db.registros_diarios.insertOne(
            documento
        );
    },
    121
);


// ============================================================
// PRUEBA 6
// registrado_por obligatorio
// ============================================================

pruebaDebeFallar(
    "registrado_por obligatorio",
    function () {

        const documento =
            crearRegistroValido(
                ISODate("2099-01-06T00:00:00.000Z")
            );

        delete documento.registrado_por;

        db.registros_diarios.insertOne(
            documento
        );
    },
    121
);


// ============================================================
// PRUEBA 7
// documento válido
// ============================================================

const FECHA_DUPLICADO =
    ISODate("2099-12-31T00:00:00.000Z");

pruebaDebeFuncionar(
    "documento válido",
    function () {

        db.registros_diarios.insertOne(
            crearRegistroValido(
                FECHA_DUPLICADO
            )
        );
    }
);


// ============================================================
// PRUEBA 8
// duplicado albergue_id + fecha
// ============================================================

pruebaDebeFallar(
    "duplicado albergue_id + fecha",
    function () {

        const duplicado =
            crearRegistroValido(
                FECHA_DUPLICADO
            );

        duplicado.poblacion =
            NumberInt(120);

        db.registros_diarios.insertOne(
            duplicado
        );
    },
    11000
);


// ============================================================
// LIMPIEZA
// ============================================================

db.registros_diarios.deleteMany({
    albergue_id: ALBERGUE_TEST_ID,
    fecha: {
        $gte: ISODate("2099-01-01T00:00:00.000Z")
    }
});


// ============================================================
// RESULTADO FINAL
// ============================================================

print("");
print("------------------------------------------");
print("RESULTADO");
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


if (pruebasFallidas > 0) {

    throw new Error(
        "La batería de pruebas MongoDB presentó fallos."
    );
}


print("");
print("✓ TODAS LAS PRUEBAS FINALIZARON CORRECTAMENTE.");