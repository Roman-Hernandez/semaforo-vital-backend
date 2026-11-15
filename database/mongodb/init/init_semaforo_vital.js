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
//   - historial_poblacion
//   - condiciones_sanitarias
//   - casos_enfermedades
//   - intervenciones
//   - metricas_albergue
//   - analisis_ia
//   - predicciones_sir
//   - alertas
//   - estados_semaforo
//   - escenarios
//   - schema_migrations
//
// Responsabilidad:
//   - crear colecciones cuando no existan
//   - actualizar validadores cuando ya existan
//   - crear/verificar índices
//   - permitir ejecución repetida
//
// IMPORTANTE:
//
// Este archivo representa el estado estructural actual para
// instalaciones nuevas.
//
// Las migraciones versionadas representan la evolución
// histórica de ambientes existentes.
//
// historial_poblacion fue incorporada mediante:
//
//   010_create_historial_poblacion
//
// predicciones_sir fue incorporada mediante:
//
//   011_create_predicciones_sir
//
// alertas fue incorporada mediante:
//
//   012_create_alertas
//
// estados_semaforo fue incorporada mediante:
//
//   013_create_estados_semaforo
//
// escenarios fue incorporada mediante:
//
//   014_create_escenarios
//
// El backfill desde registros_diarios hacia historial_poblacion
// pertenece exclusivamente a la migración 010.
//
// El init NO ejecuta transformaciones históricas.
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
// 4. VALIDADOR - HISTORIAL POBLACION
// ============================================================
//
// Fuente persistente oficial de población diaria.
//
// Regla:
//
//   1 albergue + 1 fecha
//   =
//   1 registro de población.
//
// registros_diarios.poblacion se conserva por compatibilidad.
//
// ============================================================

const validatorHistorialPoblacion = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de historial de población",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha",
            "poblacion",
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

            poblacion: {

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
// 5. VALIDADOR - CONDICIONES SANITARIAS
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
// 6. VALIDADOR - CASOS DE ENFERMEDADES
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
// 7. VALIDADOR - INTERVENCIONES
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
// 8. VALIDADOR - METRICAS ALBERGUE
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
// 9. VALIDADOR - ANALISIS IA
// ============================================================
//
// Colección histórica.
//
// Cada ejecución IA genera un documento nuevo.
//
// escenario_id es opcional hasta implementar escenarios.
//
// ============================================================

const validatorAnalisisIA = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de análisis IA",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha_ejecucion",
            "periodo_analizado",
            "modelo",
            "datos_entrada",
            "preprocesamiento",
            "resultado",
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

            escenario_id: {
                bsonType:
                    "objectId"
            },

            fecha_ejecucion: {
                bsonType:
                    "date"
            },

            periodo_analizado: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "fecha_inicio",
                    "fecha_fin"
                ],

                properties: {

                    fecha_inicio: {
                        bsonType:
                            "date"
                    },

                    fecha_fin: {
                        bsonType:
                            "date"
                    }
                }
            },

            modelo: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "nombre",
                    "version"
                ],

                properties: {

                    nombre: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    },

                    version: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    }
                }
            },

            datos_entrada: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "registros_diarios_ids",
                    "condiciones_sanitarias_ids",
                    "casos_enfermedades_ids",
                    "intervenciones_ids",
                    "metricas_albergue_ids"
                ],

                properties: {

                    registros_diarios_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    condiciones_sanitarias_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    casos_enfermedades_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    intervenciones_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    metricas_albergue_ids: {

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
            },

            preprocesamiento: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "registros_considerados",
                    "registros_descartados",
                    "datos_faltantes"
                ],

                properties: {

                    registros_considerados: {

                        bsonType:
                            "int",

                        minimum:
                            0
                    },

                    registros_descartados: {

                        bsonType:
                            "int",

                        minimum:
                            0
                    },

                    datos_faltantes: {

                        bsonType:
                            "array",

                        items: {

                            bsonType:
                                "object",

                            additionalProperties:
                                false,

                            required: [
                                "campo",
                                "cantidad",
                                "tratamiento"
                            ],

                            properties: {

                                campo: {

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

                                tratamiento: {

                                    bsonType:
                                        "string",

                                    minLength:
                                        1
                                }
                            }
                        }
                    }
                }
            },

            resultado: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "probabilidad_riesgo"
                ],

                properties: {

                    probabilidad_riesgo: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0,

                        maximum:
                            1
                    }
                }
            },

            registrado_por: {
                bsonType:
                    "objectId"
            },

            created_at: {
                bsonType:
                    "date"
            }
        }
    }
};


// ============================================================
// 10. VALIDADOR - PREDICCIONES SIR
// ============================================================
//
// Colección histórica.
//
// Cada ejecución SIR genera un documento nuevo.
//
// ============================================================

const validatorPrediccionesSIR = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de predicciones SIR",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha_ejecucion",
            "enfermedad",
            "publica",
            "modelo",
            "parametros",
            "datos_entrada",
            "preprocesamiento",
            "trayectoria",
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

            escenario_id: {
                bsonType:
                    "objectId"
            },

            fecha_ejecucion: {
                bsonType:
                    "date"
            },

            enfermedad: {

                bsonType:
                    "string",

                minLength:
                    1
            },

            publica: {
                bsonType:
                    "bool"
            },

            modelo: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "nombre",
                    "version"
                ],

                properties: {

                    nombre: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    },

                    version: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    }
                }
            },

            parametros: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "beta",
                    "gamma",
                    "condiciones_iniciales",
                    "horizonte_dias",
                    "metodo_numerico"
                ],

                properties: {

                    beta: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },

                    gamma: {

                        bsonType: [
                            "double",
                            "int",
                            "long",
                            "decimal"
                        ],

                        minimum:
                            0
                    },

                    condiciones_iniciales: {

                        bsonType:
                            "object",

                        additionalProperties:
                            false,

                        required: [
                            "susceptibles",
                            "infectados",
                            "recuperados"
                        ],

                        properties: {

                            susceptibles: {

                                bsonType:
                                    "int",

                                minimum:
                                    0
                            },

                            infectados: {

                                bsonType:
                                    "int",

                                minimum:
                                    0
                            },

                            recuperados: {

                                bsonType:
                                    "int",

                                minimum:
                                    0
                            }
                        }
                    },

                    horizonte_dias: {

                        bsonType:
                            "int",

                        minimum:
                            1
                    },

                    metodo_numerico: {

                        bsonType:
                            "string",

                        minLength:
                            1
                    }
                }
            },

            datos_entrada: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "historial_poblacion_ids",
                    "casos_enfermedades_ids"
                ],

                properties: {

                    analisis_ia_id: {
                        bsonType:
                            "objectId"
                    },

                    historial_poblacion_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    casos_enfermedades_ids: {

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
            },

            preprocesamiento: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "registros_considerados",
                    "registros_descartados"
                ],

                properties: {

                    registros_considerados: {

                        bsonType:
                            "int",

                        minimum:
                            0
                    },

                    registros_descartados: {

                        bsonType:
                            "int",

                        minimum:
                            0
                    },

                    observaciones: {
                        bsonType:
                            "string"
                    }
                }
            },

            trayectoria: {

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
                        "dia",
                        "susceptibles",
                        "infectados",
                        "recuperados"
                    ],

                    properties: {

                        dia: {

                            bsonType:
                                "int",

                            minimum:
                                0
                        },

                        susceptibles: {

                            bsonType: [
                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0
                        },

                        infectados: {

                            bsonType: [
                                "double",
                                "int",
                                "long",
                                "decimal"
                            ],

                            minimum:
                                0
                        },

                        recuperados: {

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

            registrado_por: {
                bsonType:
                    "objectId"
            },

            created_at: {
                bsonType:
                    "date"
            }
        }
    }
};


// ============================================================
// 10A. VALIDADOR - ALERTAS
// ============================================================
//
// Colección histórica con ciclo de vida.
//
// Una alerta puede pasar de activa=true a activa=false
// conservando el documento histórico.
//
// ============================================================

const validatorAlertas = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de alertas",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha_alerta",
            "nivel_riesgo",
            "tipo_alerta",
            "mensaje",
            "activa",
            "publica",
            "datos_origen",
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
                    "objectId",

                description:
                    "Referencia lógica hacia albergues._id"
            },

            fecha_alerta: {

                bsonType:
                    "date",

                description:
                    "Momento funcional en el que fue generada la alerta"
            },

            nivel_riesgo: {

                bsonType:
                    "string",

                enum: [
                    "verde",
                    "amarillo",
                    "rojo"
                ],

                description:
                    "Nivel de riesgo asociado a la alerta"
            },

            tipo_alerta: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Tipo funcional de alerta. Catálogo oficial pendiente."
            },

            mensaje: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Descripción legible de la alerta"
            },

            activa: {

                bsonType:
                    "bool",

                description:
                    "Indica si la alerta permanece vigente"
            },

            publica: {

                bsonType:
                    "bool",

                description:
                    "Marcador funcional que indica si la alerta puede ser expuesta públicamente"
            },

            datos_origen: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                properties: {

                    condicion_sanitaria_id: {

                        bsonType:
                            "objectId",

                        description:
                            "Referencia opcional hacia condiciones_sanitarias._id"
                    },

                    casos_enfermedades_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        },

                        description:
                            "Referencias opcionales hacia casos_enfermedades._id"
                    },

                    prediccion_sir_id: {

                        bsonType:
                            "objectId",

                        description:
                            "Referencia opcional hacia predicciones_sir._id"
                    }
                }
            },

            fuente_datos: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Origen funcional del evento. Catálogo oficial pendiente."
            },

            registrado_por: {

                bsonType:
                    "objectId",

                description:
                    "Referencia lógica hacia usuarios._id"
            },

            created_at: {

                bsonType:
                    "date",

                description:
                    "Fecha técnica de creación del documento"
            },

            updated_at: {

                bsonType:
                    "date",

                description:
                    "Fecha técnica de última actualización"
            },

            updated_by: {

                bsonType:
                    "objectId",

                description:
                    "Usuario responsable de la última actualización"
            }
        }
    }
};


// ============================================================
// 10B. VALIDADOR - ESTADOS SEMAFORO
// ============================================================
//
// Fuente histórica oficial del Semáforo Vital.
//
// Un nuevo cálculo genera un nuevo documento.
//
// metricas_albergue.estado_actual.semaforo_vital
// conserva el snapshot persistente del último estado.
//
// ============================================================

const validatorEstadosSemaforo = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de estados_semaforo",

        additionalProperties:
            false,

        required: [
            "albergue_id",
            "fecha_calculo",
            "nivel",
            "codigo",
            "datos_origen",
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
                    "objectId",

                description:
                    "Referencia lógica hacia albergues._id"
            },

            fecha_calculo: {

                bsonType:
                    "date",

                description:
                    "Momento funcional en el que fue calculado el estado"
            },

            nivel: {

                bsonType:
                    "string",

                enum: [
                    "verde",
                    "amarillo",
                    "rojo"
                ],

                description:
                    "Nivel oficial del Semáforo Vital"
            },

            codigo: {

                bsonType:
                    "int",

                description:
                    "Código numérico asociado al estado. La correspondencia oficial permanece pendiente."
            },

            datos_origen: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [
                    "condiciones_sanitarias_ids",
                    "casos_enfermedades_ids",
                    "alertas_ids",
                    "analisis_ia_ids",
                    "predicciones_sir_ids",
                    "metricas_albergue_ids"
                ],

                properties: {

                    condiciones_sanitarias_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    casos_enfermedades_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    alertas_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    analisis_ia_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    predicciones_sir_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {
                            bsonType:
                                "objectId"
                        }
                    },

                    metricas_albergue_ids: {

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
            },

            registrado_por: {

                bsonType:
                    "objectId",

                description:
                    "Referencia lógica hacia usuarios._id"
            },

            created_at: {

                bsonType:
                    "date",

                description:
                    "Fecha técnica de creación del documento"
            }
        }
    }
};

// ============================================================
// 10C. VALIDADOR - ESCENARIOS
// ============================================================
//
// Almacena hipótesis sanitarias e intervenciones simuladas.
//
// intervenciones
//     → acciones reales.
//
// escenarios.intervenciones_simuladas
//     → acciones hipotéticas.
//
// analisis_ia.escenario_id
// predicciones_sir.escenario_id
//     → referencias opcionales hacia escenarios._id.
//
// La colección se considera histórica / append-only.
// ============================================================

const validatorEscenarios = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de escenarios",

        additionalProperties:
            false,

        required: [

            "albergue_id",
            "nombre",
            "datos_base",
            "condiciones_simuladas",
            "intervenciones_simuladas",
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


            nombre: {

                bsonType:
                    "string",

                minLength:
                    1
            },


            descripcion: {

                bsonType:
                    "string"
            },


            datos_base: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [

                    "registros_diarios_ids",
                    "historial_poblacion_ids",
                    "condiciones_sanitarias_ids",
                    "casos_enfermedades_ids",
                    "metricas_albergue_ids",
                    "estados_semaforo_ids"
                ],

                properties: {

                    registros_diarios_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        }
                    },


                    historial_poblacion_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        }
                    },


                    condiciones_sanitarias_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        }
                    },


                    casos_enfermedades_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        }
                    },


                    metricas_albergue_ids: {

                        bsonType:
                            "array",

                        uniqueItems:
                            true,

                        items: {

                            bsonType:
                                "objectId"
                        }
                    },


                    estados_semaforo_ids: {

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
            },


            condiciones_simuladas: {

                bsonType:
                    "object",

                additionalProperties:
                    false,

                required: [

                    "agua_potable_disponible",
                    "banos_disponibles",
                    "estado_higiene",
                    "estado_saneamiento",
                    "otros_recursos_sanitarios"
                ],

                properties: {

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


                    letrinas: {

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
                    }
                }
            },


            intervenciones_simuladas: {

                bsonType:
                    "array",

                items: {

                    bsonType:
                        "object",

                    additionalProperties:
                        false,

                    required: [

                        "tipo_intervencion",
                        "descripcion"
                    ],

                    properties: {

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
                        }
                    }
                }
            },


            registrado_por: {

                bsonType:
                    "objectId"
            },


            created_at: {

                bsonType:
                    "date"
            }
        }
    }
};

// ============================================================
// 11. FUNCIÓN IDEMPOTENTE
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
// 12. CREAR / ACTUALIZAR COLECCIONES
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
    "historial_poblacion",
    validatorHistorialPoblacion
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


crearOActualizarColeccion(
    "analisis_ia",
    validatorAnalisisIA
);


crearOActualizarColeccion(
    "predicciones_sir",
    validatorPrediccionesSIR
);


crearOActualizarColeccion(
    "alertas",
    validatorAlertas
);


crearOActualizarColeccion(
    "estados_semaforo",
    validatorEstadosSemaforo
);

crearOActualizarColeccion(
    "escenarios",
    validatorEscenarios
);


// ============================================================
// 13. SCHEMA MIGRATIONS
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
// 14. ÍNDICES
// ============================================================

print("");
print("Configurando índices...");


// ------------------------------------------------------------
// usuarios
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
// albergues
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
// registros_diarios
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
// historial_poblacion
// ------------------------------------------------------------

db.historial_poblacion.createIndex(
    {
        albergue_id:
            1,

        fecha:
            -1
    },
    {
        name:
            "ux_historial_poblacion_albergue_fecha",

        unique:
            true
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ux_historial_poblacion_albergue_fecha"
);


// ------------------------------------------------------------
// condiciones_sanitarias
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
// casos_enfermedades
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
// intervenciones
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
// metricas_albergue
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
// analisis_ia
// ------------------------------------------------------------

db.analisis_ia.createIndex(
    {
        albergue_id:
            1,

        fecha_ejecucion:
            -1
    },
    {
        name:
            "ix_analisis_ia_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_analisis_ia_albergue_fecha"
);


db.analisis_ia.createIndex(
    {
        "modelo.nombre":
            1,

        "modelo.version":
            1,

        fecha_ejecucion:
            -1
    },
    {
        name:
            "ix_analisis_ia_modelo_version_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_analisis_ia_modelo_version_fecha"
);

db.analisis_ia.createIndex(
    {
        escenario_id:
            1,

        fecha_ejecucion:
            -1
    },
    {
        name:
            "ix_analisis_ia_escenario_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_analisis_ia_escenario_fecha"
);

// ------------------------------------------------------------
// predicciones_sir
// ------------------------------------------------------------

db.predicciones_sir.createIndex(
    {
        albergue_id:
            1,

        fecha_ejecucion:
            -1
    },
    {
        name:
            "ix_predicciones_sir_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_predicciones_sir_albergue_fecha"
);


db.predicciones_sir.createIndex(
    {
        albergue_id:
            1,

        enfermedad:
            1,

        fecha_ejecucion:
            -1
    },
    {
        name:
            "ix_predicciones_sir_albergue_enfermedad_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_predicciones_sir_albergue_enfermedad_fecha"
);


db.predicciones_sir.createIndex(
    {
        "modelo.nombre":
            1,

        "modelo.version":
            1,

        fecha_ejecucion:
            -1
    },
    {
        name:
            "ix_predicciones_sir_modelo_version_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_predicciones_sir_modelo_version_fecha"
);

db.predicciones_sir.createIndex(
    {
        escenario_id:
            1,

        fecha_ejecucion:
            -1
    },
    {
        name:
            "ix_predicciones_sir_escenario_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_predicciones_sir_escenario_fecha"
);

// ------------------------------------------------------------
// alertas
// ------------------------------------------------------------

db.alertas.createIndex(
    {
        albergue_id:
            1,

        fecha_alerta:
            -1
    },
    {
        name:
            "ix_alertas_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_alertas_albergue_fecha"
);


db.alertas.createIndex(
    {
        albergue_id:
            1,

        activa:
            1,

        fecha_alerta:
            -1
    },
    {
        name:
            "ix_alertas_albergue_activa_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_alertas_albergue_activa_fecha"
);


db.alertas.createIndex(
    {
        nivel_riesgo:
            1,

        activa:
            1
    },
    {
        name:
            "ix_alertas_nivel_activa"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_alertas_nivel_activa"
);


// ------------------------------------------------------------
// estados_semaforo
// ------------------------------------------------------------
//
// Histórico oficial.
// Ninguno de estos índices debe ser UNIQUE.
//
// ------------------------------------------------------------

db.estados_semaforo.createIndex(
    {
        albergue_id:
            1,

        fecha_calculo:
            -1
    },
    {
        name:
            "ix_estados_semaforo_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_estados_semaforo_albergue_fecha"
);


db.estados_semaforo.createIndex(
    {
        albergue_id:
            1,

        nivel:
            1,

        fecha_calculo:
            -1
    },
    {
        name:
            "ix_estados_semaforo_albergue_nivel_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_estados_semaforo_albergue_nivel_fecha"
);


db.estados_semaforo.createIndex(
    {
        nivel:
            1,

        fecha_calculo:
            -1
    },
    {
        name:
            "ix_estados_semaforo_nivel_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_estados_semaforo_nivel_fecha"
);

// ------------------------------------------------------------
// escenarios
// ------------------------------------------------------------
//
// Histórico de hipótesis sanitarias.
// El índice NO debe ser UNIQUE.
// ------------------------------------------------------------

db.escenarios.createIndex(
    {
        albergue_id:
            1,

        created_at:
            -1
    },
    {
        name:
            "ix_escenarios_albergue_created_at"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_escenarios_albergue_created_at"
);

// ------------------------------------------------------------
// schema_migrations
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
// 15. RESULTADO
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
    "✓ historial_poblacion disponible como fuente de población diaria"
);


print(
    "✓ Bucket Pattern disponible en metricas_albergue"
);


print(
    "✓ Computed Pattern disponible en metricas_albergue"
);


print(
    "✓ analisis_ia histórico disponible"
);


print(
    "✓ Trazabilidad de entradas IA disponible"
);


print(
    "✓ predicciones_sir histórico disponible"
);


print(
    "✓ Trazabilidad poblacional SIR mediante historial_poblacion"
);


print(
    "✓ Trayectoria epidemiológica SIR disponible"
);


print(
    "✓ alertas histórico disponible"
);


print(
    "✓ Ciclo de vida activa/inactiva disponible"
);


print(
    "✓ Visibilidad publica de alertas disponible"
);


print(
    "✓ Trazabilidad de origen de alertas disponible"
);


print(
    "✓ estados_semaforo histórico disponible"
);

print(
    "✓ escenarios hipotéticos disponibles"
);


print(
    "✓ Intervenciones simuladas separadas de intervenciones reales"
);


print(
    "✓ Integración de escenarios con analisis_ia y predicciones_sir disponible"
);

print(
    "✓ Snapshot actual del Semáforo Vital disponible en metricas_albergue.estado_actual"
);


print(
    "✓ Inicialización reejecutable"
);


print("");