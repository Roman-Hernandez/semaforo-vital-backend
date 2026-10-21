// ============================================================
// SEMÁFORO VITAL
// US-08 - Inicialización MongoDB Atlas
//
// Estado estructural vigente.
//
// Colecciones:
//   - usuarios
//   - albergues
//   - registros_diarios
//   - schema_migrations
//
// Responsabilidad:
//   - crear colecciones cuando no existan
//   - actualizar validadores cuando ya existan
//   - crear/verificar índices
//   - permitir ejecución repetida sin generar duplicados
//
// IMPORTANTE:
// Este archivo representa el estado estructural actual para
// instalaciones nuevas.
//
// Las migraciones versionadas documentan la evolución de
// ambientes existentes y NO deben modificarse retroactivamente.
//
// Base de datos:
//   semaforo_vital
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" SEMÁFORO VITAL - INICIALIZACIÓN MONGODB");
print("====================================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VALIDADOR - USUARIOS
// ============================================================

const validatorUsuarios = {
    $jsonSchema: {

        bsonType: "object",

        title:
            "Esquema de validación de usuarios",

        additionalProperties: false,

        required: [
            "email",
            "password_hash",
            "role",
            "active",
            "nombre",
            "created_at",
            "updated_at"
        ],

        properties: {

            _id: {
                bsonType: "objectId",
                description:
                    "Identificador único del usuario"
            },

            email: {
                bsonType: "string",
                minLength: 3,
                maxLength: 254,

                pattern:
                    "^[^\\s@A-Z]+@[^\\s@A-Z]+\\.[^\\s@A-Z]+$",

                description:
                    "Correo normalizado en minúsculas y sin espacios"
            },

            password_hash: {
                bsonType: "string",
                minLength: 20,

                pattern:
                    "^\\$argon2id\\$",

                description:
                    "Hash Argon2id. Nunca debe almacenarse contraseña en texto plano"
            },

            role: {
                bsonType: "string",

                enum: [
                    "administrador_albergue",
                    "super_administrador"
                ],

                description:
                    "Rol autorizado del usuario"
            },

            active: {
                bsonType: "bool",
                description:
                    "Estado lógico del usuario"
            },

            nombre: {
                bsonType: "string",
                minLength: 1,
                description:
                    "Nombre del usuario"
            },

            apellido: {
                bsonType: "string",
                minLength: 1,
                description:
                    "Apellido del usuario"
            },

            albergue_id: {
                bsonType: [
                    "objectId",
                    "null"
                ],

                description:
                    "Referencia lógica al albergue administrado"
            },

            created_at: {
                bsonType: "date",
                description:
                    "Fecha original de creación"
            },

            updated_at: {
                bsonType: "date",
                description:
                    "Fecha de última modificación"
            },

            last_login_at: {
                bsonType: [
                    "date",
                    "null"
                ],

                description:
                    "Fecha del último inicio de sesión"
            }
        },

        oneOf: [

            {
                properties: {

                    role: {
                        enum: [
                            "super_administrador"
                        ]
                    },

                    albergue_id: {
                        bsonType: "null"
                    }
                }
            },

            {
                required: [
                    "albergue_id"
                ],

                properties: {

                    role: {
                        enum: [
                            "administrador_albergue"
                        ]
                    },

                    albergue_id: {
                        bsonType: "objectId"
                    }
                }
            }
        ]
    }
};


// ============================================================
// 2. VALIDADOR - ALBERGUES
// ============================================================

const validatorAlbergues = {
    $jsonSchema: {

        bsonType: "object",

        title:
            "Esquema de validación de albergues",

        required: [
            "codigo_albergue",
            "nombre",
            "ubicacion",
            "capacidad_instalada",
            "activo",
            "registrado_por",
            "fecha",
            "created_at"
        ],

        additionalProperties: false,

        properties: {

            _id: {
                bsonType: "objectId",
                description:
                    "Identificador único del albergue"
            },

            codigo_albergue: {
                bsonType: "string",
                minLength: 1,
                description:
                    "Código funcional del albergue"
            },

            nombre: {
                bsonType: "string",
                minLength: 1,
                description:
                    "Nombre del albergue"
            },

            ubicacion: {

                bsonType: "object",

                required: [
                    "departamento",
                    "municipio",
                    "direccion",
                    "coordenadas"
                ],

                additionalProperties: false,

                properties: {

                    departamento: {
                        bsonType: "string",
                        minLength: 1
                    },

                    municipio: {
                        bsonType: "string",
                        minLength: 1
                    },

                    direccion: {
                        bsonType: "string",
                        minLength: 1
                    },

                    coordenadas: {

                        bsonType: "object",

                        required: [
                            "type",
                            "coordinates"
                        ],

                        additionalProperties: false,

                        properties: {

                            type: {
                                bsonType: "string",
                                enum: [
                                    "Point"
                                ]
                            },

                            coordinates: {

                                bsonType: "array",

                                minItems: 2,
                                maxItems: 2,

                                items: [
                                    {
                                        bsonType: [
                                            "double",
                                            "int",
                                            "long",
                                            "decimal"
                                        ],

                                        minimum: -180,
                                        maximum: 180,

                                        description:
                                            "Longitud válida"
                                    },

                                    {
                                        bsonType: [
                                            "double",
                                            "int",
                                            "long",
                                            "decimal"
                                        ],

                                        minimum: -90,
                                        maximum: 90,

                                        description:
                                            "Latitud válida"
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            capacidad_instalada: {
                bsonType: "int",
                minimum: 0,

                description:
                    "Cantidad máxima instalada. Debe ser mayor o igual a cero"
            },

            activo: {
                bsonType: "bool",
                description:
                    "Estado lógico del albergue"
            },

            registrado_por: {
                bsonType: "objectId",

                description:
                    "Referencia lógica al usuario responsable de la creación"
            },

            fecha: {
                bsonType: "date",

                description:
                    "Fecha funcional asociada al registro"
            },

            created_at: {
                bsonType: "date",

                description:
                    "Fecha y hora técnica original de creación"
            },

            updated_at: {
                bsonType: "date",

                description:
                    "Fecha y hora de la última modificación"
            },

            updated_by: {
                bsonType: "objectId",

                description:
                    "Referencia lógica al usuario responsable de la última modificación"
            }
        }
    }
};


// ============================================================
// 3. VALIDADOR - REGISTROS DIARIOS
// ============================================================

const validatorRegistrosDiarios = {
    $jsonSchema: {

        bsonType: "object",

        title:
            "Esquema de validación de registros diarios",

        required: [
            "albergue_id",
            "fecha",
            "poblacion",
            "litros_agua",
            "letrinas",
            "casos_eda",
            "casos_ira",
            "registrado_por",
            "created_at"
        ],

        additionalProperties: false,

        properties: {

            _id: {
                bsonType: "objectId",

                description:
                    "Identificador único del registro diario"
            },

            albergue_id: {
                bsonType: "objectId",

                description:
                    "Referencia lógica al documento de albergues"
            },

            fecha: {
                bsonType: "date",

                description:
                    "Día operativo normalizado a 00:00 America/Bogota"
            },

            poblacion: {
                bsonType: "int",
                minimum: 0,

                description:
                    "Cantidad de personas alojadas. Debe ser mayor o igual a cero"
            },

            litros_agua: {
                bsonType: [
                    "double",
                    "int",
                    "long",
                    "decimal"
                ],

                minimum: 0,

                description:
                    "Litros totales de agua disponibles durante el día"
            },

            letrinas: {
                bsonType: "int",
                minimum: 0,

                description:
                    "Cantidad de letrinas disponibles"
            },

            casos_eda: {
                bsonType: "int",
                minimum: 0,

                description:
                    "Casos nuevos de EDA reportados durante el día"
            },

            casos_ira: {
                bsonType: "int",
                minimum: 0,

                description:
                    "Casos nuevos de IRA reportados durante el día"
            },

            registrado_por: {
                bsonType: "objectId",

                description:
                    "Referencia lógica al usuario responsable de la creación"
            },

            created_at: {
                bsonType: "date",

                description:
                    "Fecha y hora técnica original de creación"
            },

            updated_at: {
                bsonType: "date",

                description:
                    "Fecha y hora de la última modificación"
            },

            updated_by: {
                bsonType: "objectId",

                description:
                    "Referencia lógica al usuario responsable de la última modificación"
            }
        }
    }
};


// ============================================================
// 4. FUNCIÓN IDEMPOTENTE DE CREACIÓN / ACTUALIZACIÓN
// ============================================================

function crearOActualizarColeccion(
    nombre,
    validator
) {

    const existe =
        db
            .getCollectionNames()
            .includes(nombre);


    if (!existe) {

        db.createCollection(
            nombre,
            {
                validator:
                    validator,

                validationLevel:
                    "strict",

                validationAction:
                    "error"
            }
        );

        print(
            "✓ Colección creada: " +
            nombre
        );

    } else {

        const resultado =
            db.runCommand({

                collMod:
                    nombre,

                validator:
                    validator,

                validationLevel:
                    "strict",

                validationAction:
                    "error"
            });


        if (
            resultado.ok !== 1
        ) {

            throw new Error(
                "No fue posible actualizar la colección: " +
                nombre
            );
        }


        print(
            "✓ Validador actualizado: " +
            nombre
        );
    }
}


// ============================================================
// 5. CREAR / ACTUALIZAR COLECCIONES
// ============================================================

crearOActualizarColeccion(
    "usuarios",
    validatorUsuarios
);


crearOActualizarColeccion(
    "albergues",
    validatorAlbergues
);


crearOActualizarColeccion(
    "registros_diarios",
    validatorRegistrosDiarios
);


// ============================================================
// 6. SCHEMA MIGRATIONS
// ============================================================

if (
    !db
        .getCollectionNames()
        .includes(
            "schema_migrations"
        )
) {

    db.createCollection(
        "schema_migrations"
    );

    print(
        "✓ Colección creada: schema_migrations"
    );

} else {

    print(
        "✓ Colección disponible: schema_migrations"
    );
}


// ============================================================
// 7. ÍNDICES
// ============================================================

print("");
print("Configurando índices...");


// ------------------------------------------------------------
// 7.1 usuarios.email único
// ------------------------------------------------------------

db.usuarios.createIndex(
    {
        email: 1
    },
    {
        name:
            "ux_usuarios_email",

        unique:
            true
    }
);

print(
    "✓ Índice creado/verificado: ux_usuarios_email"
);


// ------------------------------------------------------------
// 7.2 usuarios.albergue_id
// ------------------------------------------------------------

db.usuarios.createIndex(
    {
        albergue_id: 1
    },
    {
        name:
            "ix_usuarios_albergue_id"
    }
);

print(
    "✓ Índice creado/verificado: ix_usuarios_albergue_id"
);


// ------------------------------------------------------------
// 7.3 albergues.codigo_albergue único
// ------------------------------------------------------------

db.albergues.createIndex(
    {
        codigo_albergue: 1
    },
    {
        name:
            "ux_albergues_codigo_albergue",

        unique:
            true
    }
);

print(
    "✓ Índice creado/verificado: ux_albergues_codigo_albergue"
);


// ------------------------------------------------------------
// 7.4 registro consolidado por albergue + día
// ------------------------------------------------------------

db.registros_diarios.createIndex(
    {
        albergue_id: 1,
        fecha: -1
    },
    {
        name:
            "ux_registros_diarios_albergue_fecha",

        unique:
            true
    }
);

print(
    "✓ Índice creado/verificado: " +
    "ux_registros_diarios_albergue_fecha"
);


// ------------------------------------------------------------
// 7.5 schema_migrations.version único
// ------------------------------------------------------------

db.schema_migrations.createIndex(
    {
        version: 1
    },
    {
        name:
            "ux_schema_migrations_version",

        unique:
            true
    }
);

print(
    "✓ Índice creado/verificado: ux_schema_migrations_version"
);


// ============================================================
// 8. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" INICIALIZACIÓN FINALIZADA");
print("====================================================");

print(
    "✓ Colecciones creadas/actualizadas"
);

print(
    "✓ Validadores vigentes"
);

print(
    "✓ Índices vigentes"
);

print(
    "✓ Inicialización reejecutable"
);

print("");