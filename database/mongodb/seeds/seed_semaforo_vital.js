// ============================================================
// SEMÁFORO VITAL
// US-08 - Datos semilla MongoDB Atlas
//
// Escenarios:
//   - Albergue crítico: < 5 litros/persona/día
//   - Albergue óptimo: >= 15 litros/persona/día
//
// Base de datos:
//   semaforo_vital
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("==========================================");
print(" SEMÁFORO VITAL - CARGA DE DATOS SEMILLA");
print("==========================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES
// ============================================================

const coleccionesRequeridas = [
    "albergues",
    "registros_diarios"
];

const coleccionesExistentes = db.getCollectionNames();

coleccionesRequeridas.forEach(function (coleccion) {

    if (!coleccionesExistentes.includes(coleccion)) {
        throw new Error(
            "La colección requerida no existe: " + coleccion +
            ". Ejecute primero init_semaforo_vital.js"
        );
    }
});

print("✓ Colecciones requeridas disponibles.");


// ============================================================
// 2. IDENTIFICADORES DETERMINÍSTICOS DE DATOS SEMILLA
// ============================================================

const USUARIO_SEED_ID =
    ObjectId("cccccccccccccccccccccccc");

const ALBERGUE_CRITICO_ID =
    ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa");

const ALBERGUE_OPTIMO_ID =
    ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb");


// Fecha operativa normalizada a medianoche UTC.
const FECHA_SEED =
    ISODate("2026-10-14T00:00:00.000Z");


// ============================================================
// 3. ALBERGUE CRÍTICO
// ============================================================

db.albergues.updateOne(
    {
        _id: ALBERGUE_CRITICO_ID
    },
    {
        $set: {
            codigo_albergue: "SIM-PER-001",

            nombre: "Albergue Simulado La Esperanza",

            ubicacion: {
                departamento: "Risaralda",
                municipio: "Pereira",
                direccion: "Ubicación simulada - Pereira",

                coordenadas: {
                    type: "Point",
                    coordinates: [
                        -75.6946,
                        4.8143
                    ]
                }
            },

            capacidad_instalada: NumberInt(250),

            activo: true,

            registrado_por: USUARIO_SEED_ID,

            fecha: FECHA_SEED
        },

        $setOnInsert: {
            created_at: new Date()
        }
    },
    {
        upsert: true
    }
);

print("✓ Albergue crítico creado/actualizado.");


// ============================================================
// 4. ALBERGUE ÓPTIMO
// ============================================================

db.albergues.updateOne(
    {
        _id: ALBERGUE_OPTIMO_ID
    },
    {
        $set: {
            codigo_albergue: "SIM-PER-002",

            nombre: "Albergue Simulado Nuevo Horizonte",

            ubicacion: {
                departamento: "Risaralda",
                municipio: "Pereira",
                direccion: "Ubicación simulada - Pereira",

                coordenadas: {
                    type: "Point",
                    coordinates: [
                        -75.7000,
                        4.8100
                    ]
                }
            },

            capacidad_instalada: NumberInt(150),

            activo: true,

            registrado_por: USUARIO_SEED_ID,

            fecha: FECHA_SEED
        },

        $setOnInsert: {
            created_at: new Date()
        }
    },
    {
        upsert: true
    }
);

print("✓ Albergue óptimo creado/actualizado.");


// ============================================================
// 5. REGISTRO DIARIO - ESCENARIO CRÍTICO
// ============================================================

db.registros_diarios.updateOne(
    {
        albergue_id: ALBERGUE_CRITICO_ID,
        fecha: FECHA_SEED
    },
    {
        $set: {
            albergue_id: ALBERGUE_CRITICO_ID,

            fecha: FECHA_SEED,

            poblacion: NumberInt(200),

            litros_agua: 800.0,

            letrinas: NumberInt(4),

            casos_eda: NumberInt(8),

            casos_ira: NumberInt(3),

            registrado_por: USUARIO_SEED_ID
        },

        $setOnInsert: {
            created_at: new Date()
        }
    },
    {
        upsert: true
    }
);

print("✓ Registro diario crítico creado/actualizado.");


// ============================================================
// 6. REGISTRO DIARIO - ESCENARIO ÓPTIMO
// ============================================================

db.registros_diarios.updateOne(
    {
        albergue_id: ALBERGUE_OPTIMO_ID,
        fecha: FECHA_SEED
    },
    {
        $set: {
            albergue_id: ALBERGUE_OPTIMO_ID,

            fecha: FECHA_SEED,

            poblacion: NumberInt(100),

            litros_agua: 1800.0,

            letrinas: NumberInt(8),

            casos_eda: NumberInt(0),

            casos_ira: NumberInt(1),

            registrado_por: USUARIO_SEED_ID
        },

        $setOnInsert: {
            created_at: new Date()
        }
    },
    {
        upsert: true
    }
);

print("✓ Registro diario óptimo creado/actualizado.");


// ============================================================
// 7. VERIFICACIÓN DE CRITERIOS DE AGUA
// ============================================================

const registroCritico = db.registros_diarios.findOne({
    albergue_id: ALBERGUE_CRITICO_ID,
    fecha: FECHA_SEED
});

const registroOptimo = db.registros_diarios.findOne({
    albergue_id: ALBERGUE_OPTIMO_ID,
    fecha: FECHA_SEED
});


const litrosPersonaCritico =
    registroCritico.litros_agua /
    registroCritico.poblacion;

const litrosPersonaOptimo =
    registroOptimo.litros_agua /
    registroOptimo.poblacion;


if (litrosPersonaCritico >= 5) {
    throw new Error(
        "El escenario crítico no cumple el criterio < 5 L/persona/día"
    );
}


if (litrosPersonaOptimo < 15) {
    throw new Error(
        "El escenario óptimo no cumple el criterio >= 15 L/persona/día"
    );
}


print("");
print("Verificación de escenarios:");

print(
    "✓ Crítico: " +
    litrosPersonaCritico +
    " L/persona/día (< 5)"
);

print(
    "✓ Óptimo: " +
    litrosPersonaOptimo +
    " L/persona/día (>= 15)"
);

print("");
print("Carga de datos semilla finalizada.");