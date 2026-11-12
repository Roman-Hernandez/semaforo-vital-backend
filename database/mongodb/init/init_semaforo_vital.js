// ============================================================
// SEMÁFORO VITAL
// Inicialización estructural MongoDB
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
//   - metricas_albergue
//   - schema_migrations
//
// Responsabilidad:
//   - crear colecciones cuando no existan
//   - actualizar validadores cuando ya existan
//   - crear/verificar índices
//   - permitir ejecución repetida sin generar duplicados
//
// IMPORTANTE:
//
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

        bsonType:
            "object",

        title:
            "Esquema de validación de usuarios",

        additionalProperties:
            false,

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
                bsonType:
                    "objectId"
            },

            email: {

                bsonType:
                    "string",

                minLength:
                    3,

                maxLength:
                    254,

                pattern:
                    "^[^\\s@A-Z]+@[^\\s@A-Z]+\\.[^\\s@A-Z]+$"
            },

            password_hash: {

                bsonType:
                    "string",

                minLength:
                    20,

                pattern:
                    "^\\$argon2id\\$"
            },

            role: {

                bsonType:
                    "string",

                enum: [
                    "administrador_albergue",
                    "super_administrador"
                ]
            },

            active: {
                bsonType:
                    "bool"
            },

            nombre: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            apellido: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            albergue_id: {

                bsonType: [
                    "objectId",
                    "null"
                ]
            },

            created_at: {
                bsonType:
                    "date"
            },

            updated_at: {
                bsonType:
                    "date"
            },

            last_login_at: {

                bsonType: [
                    "date",
                    "null"
                ]
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

                        bsonType:
                            "null"
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

                        bsonType:
                            "objectId"
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

        bsonType:
            "object",

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

        additionalProperties:
            false,

        properties: {

            _id: {

                bsonType:
                    "objectId"
            },

            codigo_albergue: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            nombre: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            ubicacion: {

                bsonType:
                    "object",

                required: [
                    "departamento",
                    "municipio",
                    "direccion",
                    "coordenadas"
                ],

                additionalProperties:
                    false,

                properties: {

                    departamento: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    },

                    municipio: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    },

                    direccion: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    },

                    coordenadas: {

                        bsonType:
                            "object",

                        required: [
                            "type",
                            "coordinates"
                        ],

                        additionalProperties:
                            false,

                        properties: {

                            type: {

                                bsonType:
                                    "string",

                                enum: [
                                    "Point"
                                ]
                            },

                            coordinates: {

                                bsonType:
                                    "array",

                                minItems:
                                    2,

                                maxItems:
                                    2,

                                items: [

                                    {

                                        bsonType: [
                                            "double",
                                            "int",
                                            "long",
                                            "decimal"
                                        ],

                                        minimum:
                                            -180,

                                        maximum:
                                            180
                                    },

                                    {

                                        bsonType: [
                                            "double",
                                            "int",
                                            "long",
                                            "decimal"
                                        ],

                                        minimum:
                                            -90,

                                        maximum:
                                            90
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            capacidad_instalada: {

                bsonType:
                    "int",

                minimum:
                    0
            },

            activo: {

                bsonType:
                    "bool"
            },

            registrado_por: {

                bsonType:
                    "objectId"
            },

            fecha: {

                bsonType:
                    "date"
            },

            created_at: {

                bsonType:
                    "date"
            },

            updated_at: {

                bsonType:
                    "date"
            },

            updated_by: {

                bsonType:
                    "objectId"
            }
        }
    }
};


// ============================================================
// 3. VALIDADOR - REGISTROS DIARIOS
// ============================================================

const validatorRegistrosDiarios = {

    $jsonSchema: {

        bsonType:
            "object",

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

        additionalProperties:
            false,

        properties: {

            _id: {

                bsonType:
                    "objectId"
            },

            albergue_id: {

                bsonType:
                    "objectId"
            },

            fecha: {

                bsonType:
                    "date"
            },

            poblacion: {

                bsonType:
                    "int",

                minimum:
                    0
            },

            litros_agua: {

                bsonType: [
                    "double",
                    "int",
                    "long",
                    "decimal"
                ],

                minimum:
                    0
            },

            letrinas: {

                bsonType:
                    "int",

                minimum:
                    0
            },

            casos_eda: {

                bsonType:
                    "int",

                minimum:
                    0
            },

            casos_ira: {

                bsonType:
                    "int",

                minimum:
                    0
            },

            registrado_por: {

                bsonType:
                    "objectId"
            },

            created_at: {

                bsonType:
                    "date"
            },

            updated_at: {

                bsonType:
                    "date"
            },

            updated_by: {

                bsonType:
                    "objectId"
            }
        }
    }
};


// ============================================================
// 4. VALIDADOR - CONDICIONES SANITARIAS
// ============================================================

const validatorCondicionesSanitarias = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de condiciones sanitarias",

        additionalProperties:
            false,

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

                bsonType:
                    "objectId"
            },

            albergue_id: {

                bsonType:
                    "objectId"
            },

            fecha: {

                bsonType:
                    "date"
            },

            agua_potable_disponible: {

                bsonType:
                    "bool"
            },

            banos_disponibles: {

                bsonType:
                    "int",

                minimum:
                    0
            },

            estado_higiene: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            estado_saneamiento: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            otros_recursos_sanitarios: {

                bsonType:
                    "array",

                items: {

                    bsonType:
                        "object",

                    additionalProperties:
                        false,

                    required: [
                        "nombre",
                        "cantidad"
                    ],

                    properties: {

                        nombre: {

                            bsonType:
                                "string",

                            minLength:
                                1
                        },

                        cantidad: {

                            bsonType:
                                "int",

                            minimum:
                                0
                        },

                        observacion: {

                            bsonType:
                                "string"
                        }
                    }
                }
            },

            observaciones: {

                bsonType:
                    "string"
            },

            fuente_datos: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            registrado_por: {

                bsonType:
                    "objectId"
            },

            created_at: {

                bsonType:
                    "date"
            },

            updated_at: {

                bsonType:
                    "date"
            },

            updated_by: {

                bsonType:
                    "objectId"
            }
        }
    }
};


// ============================================================
// 5. VALIDADOR - CASOS DE ENFERMEDADES
// ============================================================

const validatorCasosEnfermedades = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de casos de enfermedades",

        additionalProperties:
            false,

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

                bsonType:
                    "objectId"
            },

            albergue_id: {

                bsonType:
                    "objectId"
            },

            fecha: {

                bsonType:
                    "date"
            },

            enfermedad: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            cantidad_casos_activos: {

                bsonType:
                    "int",

                minimum:
                    0
            },

            observaciones: {

                bsonType:
                    "string"
            },

            fuente_datos: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            registrado_por: {

                bsonType:
                    "objectId"
            },

            created_at: {

                bsonType:
                    "date"
            },

            updated_at: {

                bsonType:
                    "date"
            },

            updated_by: {

                bsonType:
                    "objectId"
            }
        }
    }
};


// ============================================================
// 6. VALIDADOR - INTERVENCIONES
// ============================================================

const validatorIntervenciones = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de intervenciones",

        additionalProperties:
            false,

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

                bsonType:
                    "objectId"
            },

            albergue_id: {

                bsonType:
                    "objectId"
            },

            fecha_intervencion: {

                bsonType:
                    "date"
            },

            tipo_intervencion: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            descripcion: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            observaciones: {

                bsonType:
                    "string"
            },

            fuente_datos: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            registrado_por: {

                bsonType:
                    "objectId"
            },

            created_at: {

                bsonType:
                    "date"
            },

            updated_at: {

                bsonType:
                    "date"
            },

            updated_by: {

                bsonType:
                    "objectId"
            }
        }
    }
};


// ============================================================
// 7. VALIDADOR - METRICAS ALBERGUE
// ============================================================
//
// BUCKET PATTERN:
//
//   1 documento
//   =
//   1 albergue + 1 fecha_bucket
//
// COMPUTED PATTERN:
//
//   calculados
//   ultima_medicion
//   estado_actual
//
// estado_actual es opcional durante esta etapa porque las
// colecciones alertas y estados_semaforo serán implementadas
// posteriormente.
// ============================================================

const validatorMetricasAlbergue = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de métricas de albergue",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha_bucket",
            "mediciones",
            "calculados",
            "ultima_medicion",
            "created_at",
            "updated_at"
        ],

        properties: {

            _id: {

                bsonType:
                    "objectId"
            },


            albergue_id: {

                bsonType:
                    "objectId"
            },


            fecha_bucket: {

                bsonType:
                    "date"
            },


            // =================================================
            // BUCKET PATTERN
            // =================================================

            mediciones: {

                bsonType:
                    "array",

                minItems:
                    1,

                items: {

                    bsonType:
                        "object",

                    additionalProperties:
                        false,

                    required: [
                        "fecha_hora",
                        "ph",
                        "cloro_residual",
                        "personas_alojadas",
                        "porcentaje_ocupacion"
                    ],

                    properties: {

                        fecha_hora: {

                            bsonType:
                                "date"
                        },


                        ph: {

                            bsonType: [
                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0
                        },


                        cloro_residual: {

                            bsonType: [
                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0
                        },


                        personas_alojadas: {

                            bsonType:
                                "int",

                            minimum:
                                0
                        },


                        porcentaje_ocupacion: {

                            bsonType: [
                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0
                        }
                    }
                }
            },


            // =================================================
            // COMPUTED PATTERN
            // =================================================

            calculados: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "cantidad_mediciones",
                    "suma_ph",
                    "suma_cloro_residual",
                    "promedio_ph",
                    "promedio_cloro_residual",
                    "porcentaje_ocupacion"
                ],

                properties: {

                    cantidad_mediciones: {

                        bsonType:
                            "int",

                        minimum:
                            1
                    },


                    suma_ph: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },


                    suma_cloro_residual: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },


                    promedio_ph: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },


                    promedio_cloro_residual: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },


                    porcentaje_ocupacion: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    }
                }
            },


            // =================================================
            // ÚLTIMA MEDICIÓN
            // =================================================

            ultima_medicion: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "fecha_hora",
                    "ph",
                    "cloro_residual",
                    "personas_alojadas",
                    "porcentaje_ocupacion"
                ],

                properties: {

                    fecha_hora: {

                        bsonType:
                            "date"
                    },


                    ph: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },


                    cloro_residual: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },


                    personas_alojadas: {

                        bsonType:
                            "int",

                        minimum:
                            0
                    },


                    porcentaje_ocupacion: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    }
                }
            },


            // =================================================
            // SNAPSHOT COMPUTADO DEL ESTADO ACTUAL
            // =================================================

            estado_actual: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "agua",
                    "hacinamiento",
                    "semaforo_vital",
                    "alertas_activas"
                ],

                properties: {

                    agua: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [
                            "nivel"
                        ],

                        properties: {

                            nivel: {

                                bsonType:
                                    "string",

                                minLength:
                                    1
                            }
                        }
                    },


                    hacinamiento: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [
                            "nivel"
                        ],

                        properties: {

                            nivel: {

                                bsonType:
                                    "string",

                                minLength:
                                    1
                            }
                        }
                    },


                    semaforo_vital: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [
                            "nivel",
                            "codigo",
                            "estado_semaforo_id",
                            "fecha_calculo"
                        ],

                        properties: {

                            nivel: {

                                bsonType:
                                    "string",

                                minLength:
                                    1
                            },


                            codigo: {

                                bsonType:
                                    "int"
                            },


                            estado_semaforo_id: {

                                bsonType:
                                    "objectId"
                            },


                            fecha_calculo: {

                                bsonType:
                                    "date"
                            }
                        }
                    },


                    alertas_activas: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [
                            "cantidad",
                            "ids"
                        ],

                        properties: {

                            cantidad: {

                                bsonType:
                                    "int",

                                minimum:
                                    0
                            },


                            ids: {

                                bsonType:
                                    "array",

                                uniqueItems:
                                    true,

                                items: {

                                    bsonType:
                                        "objectId"
                                }
                            }
                        }
                    }
                }
            },


            created_at: {

                bsonType:
                    "date"
            },


            updated_at: {

                bsonType:
                    "date"
            }
        }
    }
};


// ============================================================
// 8. FUNCIÓN IDEMPOTENTE DE CREACIÓN / ACTUALIZACIÓN
// ============================================================

function crearOActualizarColeccion(
    nombre,
    validator
) {

    const existe =
        db
            .getCollectionNames()
            .includes(
                nombre
            );


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
// 9. CREAR / ACTUALIZAR COLECCIONES
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


crearOActualizarColeccion(
    "metricas_albergue",
    validatorMetricasAlbergue
);


// ============================================================
// 10. SCHEMA MIGRATIONS
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
// 11. ÍNDICES
// ============================================================

print("");
print("Configurando índices...");


// ------------------------------------------------------------
// 11.1 usuarios.email único
// ------------------------------------------------------------

db.usuarios.createIndex(
    {
        email:
            1
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
// 11.2 usuarios.albergue_id
// ------------------------------------------------------------

db.usuarios.createIndex(
    {
        albergue_id:
            1
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
// 11.3 albergues.codigo_albergue
// ------------------------------------------------------------

db.albergues.createIndex(
    {
        codigo_albergue:
            1
    },
    {
        name:
            "ux_albergues_codigo_albergue",

        unique:
            true
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ux_albergues_codigo_albergue"
);


// ------------------------------------------------------------
// 11.4 registros_diarios albergue + fecha
// ------------------------------------------------------------

db.registros_diarios.createIndex(
    {
        albergue_id:
            1,

        fecha:
            -1
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
// 11.5 condiciones_sanitarias albergue + fecha
// ------------------------------------------------------------

db.condiciones_sanitarias.createIndex(
    {
        albergue_id:
            1,

        fecha:
            -1
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
// 11.6 casos_enfermedades albergue + fecha
// ------------------------------------------------------------

db.casos_enfermedades.createIndex(
    {
        albergue_id:
            1,

        fecha:
            -1
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
// 11.7 casos_enfermedades albergue + enfermedad + fecha
// ------------------------------------------------------------

db.casos_enfermedades.createIndex(
    {
        albergue_id:
            1,

        enfermedad:
            1,

        fecha:
            -1
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
// 11.8 intervenciones albergue + fecha
// ------------------------------------------------------------

db.intervenciones.createIndex(
    {
        albergue_id:
            1,

        fecha_intervencion:
            -1
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
// 11.9 intervenciones albergue + tipo + fecha
// ------------------------------------------------------------

db.intervenciones.createIndex(
    {
        albergue_id:
            1,

        tipo_intervencion:
            1,

        fecha_intervencion:
            -1
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
// 11.10 metricas_albergue albergue + fecha_bucket
// ------------------------------------------------------------
//
// Regla Bucket Pattern:
//
// Solo puede existir:
//
//   1 bucket
//   por
//   albergue + fecha_bucket
//
// ------------------------------------------------------------

db.metricas_albergue.createIndex(
    {
        albergue_id:
            1,

        fecha_bucket:
            1
    },
    {
        name:
            "ux_metricas_albergue_albergue_fecha_bucket",

        unique:
            true
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ux_metricas_albergue_albergue_fecha_bucket"
);


// ------------------------------------------------------------
// 11.11 schema_migrations.version
// ------------------------------------------------------------

db.schema_migrations.createIndex(
    {
        version:
            1
    },
    {
        name:
            "ux_schema_migrations_version",

        unique:
            true
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ux_schema_migrations_version"
);


// ============================================================
// 12. RESULTADO
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
    "✓ Bucket Pattern disponible en metricas_albergue"
);

print(
    "✓ Computed Pattern disponible en metricas_albergue"
);

print(
    "✓ Inicialización reejecutable"
);

print("");