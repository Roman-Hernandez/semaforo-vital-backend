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
//   - condiciones_sanitarias
//   - casos_enfermedades
//   - intervenciones
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
                                        maximum: 180
                                    },

                                    {
                                        bsonType: [
                                            "double",
                                            "int",
                                            "long",
                                            "decimal"
                                        ],

                                        minimum: -90,
                                        maximum: 90
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            capacidad_instalada: {
                bsonType: "int",
                minimum: 0
            },

            activo: {
                bsonType: "bool"
            },

            registrado_por: {
                bsonType: "objectId"
            },

            fecha: {
                bsonType: "date"
            },

            created_at: {
                bsonType: "date"
            },

            updated_at: {
                bsonType: "date"
            },

            updated_by: {
                bsonType: "objectId"
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
                bsonType: "objectId"
            },

            albergue_id: {
                bsonType: "objectId"
            },

            fecha: {
                bsonType: "date"
            },

            poblacion: {
                bsonType: "int",
                minimum: 0
            },

            litros_agua: {
                bsonType: [
                    "double",
                    "int",
                    "long",
                    "decimal"
                ],

                minimum: 0
            },

            letrinas: {
                bsonType: "int",
                minimum: 0
            },

            casos_eda: {
                bsonType: "int",
                minimum: 0
            },

            casos_ira: {
                bsonType: "int",
                minimum: 0
            },

            registrado_por: {
                bsonType: "objectId"
            },

            created_at: {
                bsonType: "date"
            },

            updated_at: {
                bsonType: "date"
            },

            updated_by: {
                bsonType: "objectId"
            }
        }
    }
};


// ============================================================
// 4. VALIDADOR - CONDICIONES SANITARIAS
// ============================================================

const validatorCondicionesSanitarias = {
    $jsonSchema: {

        bsonType: "object",

        title:
            "Esquema de validación de condiciones sanitarias",

        additionalProperties: false,

        required: [
            "albergue_id",
            "fecha",
            "agua_potable_disponible",
            "banos_disponibles",
            "estado_higiene",
            "estado_saneamiento",
            "fuente_datos",
            "registrado_por",
            "created_at"
        ],

        properties: {

            _id: {
                bsonType: "objectId"
            },

            albergue_id: {
                bsonType: "objectId"
            },

            fecha: {
                bsonType: "date"
            },

            agua_potable_disponible: {
                bsonType: "bool"
            },

            banos_disponibles: {
                bsonType: "int",
                minimum: 0
            },

            estado_higiene: {
                bsonType: "string",
                minLength: 1
            },

            estado_saneamiento: {
                bsonType: "string",
                minLength: 1
            },

            otros_recursos_sanitarios: {

                bsonType: "array",

                items: {

                    bsonType: "object",

                    additionalProperties: false,

                    required: [
                        "nombre",
                        "cantidad"
                    ],

                    properties: {

                        nombre: {
                            bsonType: "string",
                            minLength: 1
                        },

                        cantidad: {
                            bsonType: "int",
                            minimum: 0
                        },

                        observacion: {
                            bsonType: "string"
                        }
                    }
                }
            },

            observaciones: {
                bsonType: "string"
            },

            fuente_datos: {
                bsonType: "string",
                minLength: 1
            },

            registrado_por: {
                bsonType: "objectId"
            },

            created_at: {
                bsonType: "date"
            },

            updated_at: {
                bsonType: "date"
            },

            updated_by: {
                bsonType: "objectId"
            }
        }
    }
};


// ============================================================
// 5. VALIDADOR - CASOS DE ENFERMEDADES
// ============================================================

const validatorCasosEnfermedades = {
    $jsonSchema: {

        bsonType: "object",

        title:
            "Esquema de validación de casos de enfermedades",

        additionalProperties: false,

        required: [
            "albergue_id",
            "fecha",
            "enfermedad",
            "cantidad_casos_activos",
            "fuente_datos",
            "registrado_por",
            "created_at"
        ],

        properties: {

            _id: {
                bsonType: "objectId"
            },

            albergue_id: {
                bsonType: "objectId"
            },

            fecha: {
                bsonType: "date"
            },

            enfermedad: {
                bsonType: "string",
                minLength: 1
            },

            cantidad_casos_activos: {
                bsonType: "int",
                minimum: 0
            },

            observaciones: {
                bsonType: "string"
            },

            fuente_datos: {
                bsonType: "string",
                minLength: 1
            },

            registrado_por: {
                bsonType: "objectId"
            },

            created_at: {
                bsonType: "date"
            },

            updated_at: {
                bsonType: "date"
            },

            updated_by: {
                bsonType: "objectId"
            }
        }
    }
};


// ============================================================
// 6. VALIDADOR - INTERVENCIONES
// ============================================================

const validatorIntervenciones = {
    $jsonSchema: {

        bsonType: "object",

        title:
            "Esquema de validación de intervenciones",

        additionalProperties: false,

        required: [
            "albergue_id",
            "fecha_intervencion",
            "tipo_intervencion",
            "descripcion",
            "fuente_datos",
            "registrado_por",
            "created_at"
        ],

        properties: {

            _id: {
                bsonType: "objectId",

                description:
                    "Identificador único de la intervención"
            },

            albergue_id: {
                bsonType: "objectId",

                description:
                    "Referencia lógica a albergues._id"
            },

            fecha_intervencion: {
                bsonType: "date",

                description:
                    "Fecha funcional en la que fue ejecutada la intervención"
            },

            tipo_intervencion: {
                bsonType: "string",

                minLength: 1,

                description:
                    "Tipo de intervención ejecutada. Catálogo funcional pendiente de definición"
            },

            descripcion: {
                bsonType: "string",

                minLength: 1,

                description:
                    "Descripción de la intervención realmente ejecutada"
            },

            observaciones: {
                bsonType: "string",

                description:
                    "Observaciones adicionales de la intervención"
            },

            fuente_datos: {
                bsonType: "string",

                minLength: 1,

                description:
                    "Origen del dato. Catálogo funcional pendiente de definición"
            },

            registrado_por: {
                bsonType: "objectId",

                description:
                    "Referencia lógica al usuario creador"
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
// 7. FUNCIÓN IDEMPOTENTE DE CREACIÓN / ACTUALIZACIÓN
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
// 8. CREAR / ACTUALIZAR COLECCIONES
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


crearOActualizarColeccion(
    "condiciones_sanitarias",
    validatorCondicionesSanitarias
);


crearOActualizarColeccion(
    "casos_enfermedades",
    validatorCasosEnfermedades
);


crearOActualizarColeccion(
    "intervenciones",
    validatorIntervenciones
);


// ============================================================
// 9. SCHEMA MIGRATIONS
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
// 10. ÍNDICES
// ============================================================

print("");
print("Configurando índices...");


// ------------------------------------------------------------
// 10.1 usuarios.email único
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
// 10.2 usuarios.albergue_id
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
// 10.3 albergues.codigo_albergue
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
// 10.4 registros_diarios albergue + fecha
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
// 10.5 condiciones_sanitarias albergue + fecha
// ------------------------------------------------------------

db.condiciones_sanitarias.createIndex(
    {
        albergue_id: 1,
        fecha: -1
    },
    {
        name:
            "ix_condiciones_sanitarias_albergue_fecha"
    }
);

print(
    "✓ Índice creado/verificado: " +
    "ix_condiciones_sanitarias_albergue_fecha"
);


// ------------------------------------------------------------
// 10.6 casos_enfermedades albergue + fecha
// ------------------------------------------------------------

db.casos_enfermedades.createIndex(
    {
        albergue_id: 1,
        fecha: -1
    },
    {
        name:
            "ix_casos_enfermedades_albergue_fecha"
    }
);

print(
    "✓ Índice creado/verificado: " +
    "ix_casos_enfermedades_albergue_fecha"
);


// ------------------------------------------------------------
// 10.7 casos_enfermedades albergue + enfermedad + fecha
// ------------------------------------------------------------

db.casos_enfermedades.createIndex(
    {
        albergue_id: 1,
        enfermedad: 1,
        fecha: -1
    },
    {
        name:
            "ix_casos_enfermedades_albergue_enfermedad_fecha"
    }
);

print(
    "✓ Índice creado/verificado: " +
    "ix_casos_enfermedades_albergue_enfermedad_fecha"
);


// ------------------------------------------------------------
// 10.8 intervenciones albergue + fecha
// ------------------------------------------------------------

db.intervenciones.createIndex(
    {
        albergue_id: 1,
        fecha_intervencion: -1
    },
    {
        name:
            "ix_intervenciones_albergue_fecha"
    }
);

print(
    "✓ Índice creado/verificado: " +
    "ix_intervenciones_albergue_fecha"
);


// ------------------------------------------------------------
// 10.9 intervenciones albergue + tipo + fecha
// ------------------------------------------------------------

db.intervenciones.createIndex(
    {
        albergue_id: 1,
        tipo_intervencion: 1,
        fecha_intervencion: -1
    },
    {
        name:
            "ix_intervenciones_albergue_tipo_fecha"
    }
);

print(
    "✓ Índice creado/verificado: " +
    "ix_intervenciones_albergue_tipo_fecha"
);


// ------------------------------------------------------------
// 10.10 schema_migrations.version
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
// 11. RESULTADO
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