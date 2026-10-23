// ============================================================
// SEMÁFORO VITAL
// US-08 - Datos semilla MongoDB Atlas
//
// Escenarios:
//   - Albergue crítico: < 5 litros/persona/día
//   - Albergue óptimo: >= 15 litros/persona/día
//
// Responsabilidad:
//   - cargar datos semilla reproducibles
//   - utilizar usuarios reales existentes
//   - mantener integridad lógica de referencias
//   - validar criterios funcionales de agua
//
// Base de datos:
//   semaforo_vital
//
// Zona horaria funcional:
//   America/Bogota (UTC-05:00)
//
// Convención:
//   fecha      = día operativo a las 00:00 Colombia
//   created_at = instante real de creación
//
// MongoDB almacena BSON Date como instante UTC.
// Ejemplo:
//   2026-10-14 00:00 Colombia
//   = 2026-10-14T05:00:00.000Z
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("==========================================");
print(" SEMÁFORO VITAL - CARGA DE DATOS SEMILLA");
print("==========================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES REQUERIDAS
// ============================================================

const coleccionesRequeridas = [
    "usuarios",
    "albergues",
    "registros_diarios"
];

const coleccionesExistentes =
    db.getCollectionNames();


coleccionesRequeridas.forEach(
    function (coleccion) {

        if (
            !coleccionesExistentes.includes(
                coleccion
            )
        ) {

            throw new Error(
                "La colección requerida no existe: " +
                coleccion +
                ". Ejecute primero las migraciones correspondientes."
            );
        }
    }
);


print(
    "✓ Colecciones requeridas disponibles."
);


// ============================================================
// 2. IDENTIFICADORES DETERMINÍSTICOS
// ============================================================

const ALBERGUE_CRITICO_ID =
    ObjectId(
        "aaaaaaaaaaaaaaaaaaaaaaaa"
    );

const ALBERGUE_OPTIMO_ID =
    ObjectId(
        "bbbbbbbbbbbbbbbbbbbbbbbb"
    );


// ============================================================
// 3. FECHA OPERATIVA
// ============================================================
//
// 2026-10-14 00:00:00 America/Bogota
// equivale a:
// 2026-10-14T05:00:00.000Z
// ============================================================

const FECHA_SEED =
    ISODate(
        "2026-10-14T05:00:00.000Z"
    );


// ============================================================
// 4. RESOLVER USUARIO RESPONSABLE
// ============================================================
//
// No se utilizan ObjectId ficticios para registrado_por.
//
// Se selecciona el primer super_administrador activo según
// created_at y _id para mantener un comportamiento determinista.
//
// El seed se detiene si no existe un usuario válido.
// ============================================================

const usuariosResponsables =
    db.usuarios
        .find(
            {
                role:
                    "super_administrador",

                active:
                    true
            }
        )
        .sort(
            {
                created_at:
                    1,

                _id:
                    1
            }
        )
        .limit(1)
        .toArray();


if (
    usuariosResponsables.length === 0
) {

    throw new Error(
        "No existe un super_administrador activo. " +
        "Debe existir un usuario válido antes de ejecutar los datos semilla."
    );
}


const USUARIO_SEED_ID =
    usuariosResponsables[0]._id;


print(
    "✓ Usuario responsable encontrado: " +
    USUARIO_SEED_ID
);


// ============================================================
// 5. ALBERGUE CRÍTICO
// ============================================================

db.albergues.updateOne(
    {
        _id:
            ALBERGUE_CRITICO_ID
    },

    {
        $set: {

            codigo_albergue:
                "SIM-PER-001",

            nombre:
                "Albergue Simulado La Esperanza",

            ubicacion: {

                departamento:
                    "Risaralda",

                municipio:
                    "Pereira",

                direccion:
                    "Ubicación simulada - Pereira",

                coordenadas: {

                    type:
                        "Point",

                    coordinates: [
                        -75.6946,
                        4.8143
                    ]
                }
            },

            capacidad_instalada:
                NumberInt(250),

            activo:
                true,

            registrado_por:
                USUARIO_SEED_ID,

            fecha:
                FECHA_SEED
        },

        $setOnInsert: {

            created_at:
                new Date()
        }
    },

    {
        upsert:
            true
    }
);


print(
    "✓ Albergue crítico creado/actualizado."
);


// ============================================================
// 6. ALBERGUE ÓPTIMO
// ============================================================

db.albergues.updateOne(
    {
        _id:
            ALBERGUE_OPTIMO_ID
    },

    {
        $set: {

            codigo_albergue:
                "SIM-PER-002",

            nombre:
                "Albergue Simulado Nuevo Horizonte",

            ubicacion: {

                departamento:
                    "Risaralda",

                municipio:
                    "Pereira",

                direccion:
                    "Ubicación simulada - Pereira",

                coordenadas: {

                    type:
                        "Point",

                    coordinates: [
                        -75.7000,
                        4.8100
                    ]
                }
            },

            capacidad_instalada:
                NumberInt(150),

            activo:
                true,

            registrado_por:
                USUARIO_SEED_ID,

            fecha:
                FECHA_SEED
        },

        $setOnInsert: {

            created_at:
                new Date()
        }
    },

    {
        upsert:
            true
    }
);


print(
    "✓ Albergue óptimo creado/actualizado."
);


// ============================================================
// 7. REGISTRO DIARIO - ESCENARIO CRÍTICO
// ============================================================

db.registros_diarios.updateOne(
    {
        albergue_id:
            ALBERGUE_CRITICO_ID,

        fecha:
            FECHA_SEED
    },

    {
        $set: {

            albergue_id:
                ALBERGUE_CRITICO_ID,

            fecha:
                FECHA_SEED,

            poblacion:
                NumberInt(200),

            litros_agua:
                800.0,

            letrinas:
                NumberInt(4),

            casos_eda:
                NumberInt(8),

            casos_ira:
                NumberInt(3),

            registrado_por:
                USUARIO_SEED_ID
        },

        $setOnInsert: {

            created_at:
                new Date()
        }
    },

    {
        upsert:
            true
    }
);


print(
    "✓ Registro diario crítico creado/actualizado."
);


// ============================================================
// 8. REGISTRO DIARIO - ESCENARIO ÓPTIMO
// ============================================================

db.registros_diarios.updateOne(
    {
        albergue_id:
            ALBERGUE_OPTIMO_ID,

        fecha:
            FECHA_SEED
    },

    {
        $set: {

            albergue_id:
                ALBERGUE_OPTIMO_ID,

            fecha:
                FECHA_SEED,

            poblacion:
                NumberInt(100),

            litros_agua:
                1800.0,

            letrinas:
                NumberInt(8),

            casos_eda:
                NumberInt(0),

            casos_ira:
                NumberInt(1),

            registrado_por:
                USUARIO_SEED_ID
        },

        $setOnInsert: {

            created_at:
                new Date()
        }
    },

    {
        upsert:
            true
    }
);


print(
    "✓ Registro diario óptimo creado/actualizado."
);


// ============================================================
// 9. VERIFICAR CRITERIOS DE AGUA
// ============================================================

const registroCritico =
    db.registros_diarios.findOne(
        {
            albergue_id:
                ALBERGUE_CRITICO_ID,

            fecha:
                FECHA_SEED
        }
    );


const registroOptimo =
    db.registros_diarios.findOne(
        {
            albergue_id:
                ALBERGUE_OPTIMO_ID,

            fecha:
                FECHA_SEED
        }
    );


if (
    !registroCritico
) {

    throw new Error(
        "No fue posible recuperar el registro diario crítico."
    );
}


if (
    !registroOptimo
) {

    throw new Error(
        "No fue posible recuperar el registro diario óptimo."
    );
}


const litrosPersonaCritico =
    registroCritico.litros_agua /
    registroCritico.poblacion;


const litrosPersonaOptimo =
    registroOptimo.litros_agua /
    registroOptimo.poblacion;


if (
    litrosPersonaCritico >= 5
) {

    throw new Error(
        "El escenario crítico no cumple el criterio < 5 L/persona/día."
    );
}


if (
    litrosPersonaOptimo < 15
) {

    throw new Error(
        "El escenario óptimo no cumple el criterio >= 15 L/persona/día."
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


// ============================================================
// 10. INTEGRIDAD REFERENCIAL
// ============================================================
//
// MongoDB no aplica claves foráneas entre colecciones.
//
// Por esta razón, el seed comprueba explícitamente:
//
// albergues.registrado_por
//      → usuarios._id
//
// registros_diarios.registrado_por
//      → usuarios._id
//
// registros_diarios.albergue_id
//      → albergues._id
//
// Estas verificaciones complementan las validaciones que deberá
// aplicar la capa de aplicación.
// ============================================================


// ------------------------------------------------------------
// 10.1 albergues.registrado_por → usuarios._id
// ------------------------------------------------------------

const alberguesSinUsuario =
    db.albergues.aggregate([
        {
            $match: {

                _id: {
                    $in: [
                        ALBERGUE_CRITICO_ID,
                        ALBERGUE_OPTIMO_ID
                    ]
                }
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
                    "usuario"
            }
        },

        {
            $match: {

                "usuario.0": {
                    $exists:
                        false
                }
            }
        },

        {
            $project: {

                codigo_albergue:
                    1,

                registrado_por:
                    1
            }
        }
    ]).toArray();


if (
    alberguesSinUsuario.length > 0
) {

    printjson(
        alberguesSinUsuario
    );

    throw new Error(
        "Existen albergues semilla con registrado_por inexistente."
    );
}


print(
    "✓ albergues.registrado_por → usuarios._id válido."
);


// ------------------------------------------------------------
// 10.2 registros_diarios.registrado_por → usuarios._id
// ------------------------------------------------------------

const registrosSinUsuario =
    db.registros_diarios.aggregate([
        {
            $match: {

                albergue_id: {
                    $in: [
                        ALBERGUE_CRITICO_ID,
                        ALBERGUE_OPTIMO_ID
                    ]
                },

                fecha:
                    FECHA_SEED
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
                    "usuario"
            }
        },

        {
            $match: {

                "usuario.0": {
                    $exists:
                        false
                }
            }
        },

        {
            $project: {

                albergue_id:
                    1,

                fecha:
                    1,

                registrado_por:
                    1
            }
        }
    ]).toArray();


if (
    registrosSinUsuario.length > 0
) {

    printjson(
        registrosSinUsuario
    );

    throw new Error(
        "Existen registros diarios semilla con registrado_por inexistente."
    );
}


print(
    "✓ registros_diarios.registrado_por → usuarios._id válido."
);


// ------------------------------------------------------------
// 10.3 registros_diarios.albergue_id → albergues._id
// ------------------------------------------------------------

const registrosSinAlbergue =
    db.registros_diarios.aggregate([
        {
            $match: {

                albergue_id: {
                    $in: [
                        ALBERGUE_CRITICO_ID,
                        ALBERGUE_OPTIMO_ID
                    ]
                },

                fecha:
                    FECHA_SEED
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
        },

        {
            $project: {

                albergue_id:
                    1,

                fecha:
                    1
            }
        }
    ]).toArray();


if (
    registrosSinAlbergue.length > 0
) {

    printjson(
        registrosSinAlbergue
    );

    throw new Error(
        "Existen registros diarios semilla asociados a albergues inexistentes."
    );
}


print(
    "✓ registros_diarios.albergue_id → albergues._id válido."
);


// ============================================================
// 11. VERIFICAR CANTIDAD DE DOCUMENTOS SEMILLA
// ============================================================

const cantidadAlberguesSeed =
    db.albergues.countDocuments(
        {
            _id: {
                $in: [
                    ALBERGUE_CRITICO_ID,
                    ALBERGUE_OPTIMO_ID
                ]
            }
        }
    );


const cantidadRegistrosSeed =
    db.registros_diarios.countDocuments(
        {
            albergue_id: {
                $in: [
                    ALBERGUE_CRITICO_ID,
                    ALBERGUE_OPTIMO_ID
                ]
            },

            fecha:
                FECHA_SEED
        }
    );


if (
    cantidadAlberguesSeed !== 2
) {

    throw new Error(
        "La cantidad esperada de albergues semilla es 2. " +
        "Cantidad encontrada: " +
        cantidadAlberguesSeed
    );
}


if (
    cantidadRegistrosSeed !== 2
) {

    throw new Error(
        "La cantidad esperada de registros diarios semilla es 2. " +
        "Cantidad encontrada: " +
        cantidadRegistrosSeed
    );
}


print(
    "✓ Cantidad de albergues semilla: " +
    cantidadAlberguesSeed
);


print(
    "✓ Cantidad de registros diarios semilla: " +
    cantidadRegistrosSeed
);


// ============================================================
// 12. RESULTADO FINAL
// ============================================================

print("");
print("==========================================");
print(" CARGA DE DATOS SEMILLA FINALIZADA");
print("==========================================");

print(
    "✓ Usuario responsable real"
);

print(
    "✓ Referencias válidas"
);

print(
    "✓ Datos semilla reproducibles"
);

print(
    "✓ Sin duplicados"
);

print("");