// ============================================================
// SEMÁFORO VITAL
// US-08 - Inicialización MongoDB Atlas
//
// Colecciones:
//   - albergues
//   - registros_diarios
//
// Responsabilidad:
//   - creación de colecciones
//   - validadores $jsonSchema
//   - índices
//
// Base de datos:
//   semaforo_vital
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("==========================================");
print(" SEMÁFORO VITAL - INICIALIZACIÓN MONGODB");
print("==========================================");
print("Base de datos: " + db.getName());
print("");

const validatorAlbergues = {
    $jsonSchema: {
        bsonType: "object",

        title: "Esquema de validación de albergues",

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
                description: "Identificador único del albergue"
            },

            codigo_albergue: {
                bsonType: "string",
                minLength: 1,
                description: "Código funcional del albergue"
            },

            nombre: {
                bsonType: "string",
                minLength: 1,
                description: "Nombre del albergue"
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
                                enum: ["Point"]
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
                                        description: "Longitud válida"
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
                                        description: "Latitud válida"
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
                description: "Debe ser un entero mayor o igual a cero"
            },

            activo: {
                bsonType: "bool",
                description: "Estado lógico del albergue"
            },

            registrado_por: {
                bsonType: "objectId",
                description: "Usuario responsable del registro"
            },

            fecha: {
                bsonType: "date",
                description: "Fecha asociada al registro"
            },

            created_at: {
                bsonType: "date",
                description: "Fecha y hora técnica de creación"
            }
        }
    }
};

const validatorRegistrosDiarios = {
    $jsonSchema: {
        bsonType: "object",

        title: "Esquema de validación de registros diarios",

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
                description: "Identificador único del registro diario"
            },

            albergue_id: {
                bsonType: "objectId",
                description: "Referencia lógica al documento de albergues"
            },

            fecha: {
                bsonType: "date",
                description: "Fecha correspondiente al registro diario"
            },

            poblacion: {
                bsonType: "int",
                minimum: 0,
                description: "Cantidad de personas alojadas. Debe ser mayor o igual a cero"
            },

            litros_agua: {
                bsonType: [
                    "double",
                    "int",
                    "long",
                    "decimal"
                ],
                minimum: 0,
                description: "Litros totales de agua disponibles durante el día. Debe ser mayor o igual a cero"
            },

            letrinas: {
                bsonType: "int",
                minimum: 0,
                description: "Cantidad de letrinas disponibles. Debe ser mayor o igual a cero"
            },

            casos_eda: {
                bsonType: "int",
                minimum: 0,
                description: "Casos diarios de Enfermedad Diarreica Aguda. Debe ser mayor o igual a cero"
            },

            casos_ira: {
                bsonType: "int",
                minimum: 0,
                description: "Casos diarios de Infección Respiratoria Aguda. Debe ser mayor o igual a cero"
            },

            registrado_por: {
                bsonType: "objectId",
                description: "Usuario responsable del registro"
            },

            created_at: {
                bsonType: "date",
                description: "Fecha y hora técnica de creación del documento"
            }
        }
    }
};


function crearOActualizarColeccion(nombre, validator) {

    const existe = db
        .getCollectionNames()
        .includes(nombre);

    if (!existe) {

        db.createCollection(nombre, {
            validator: validator,
            validationLevel: "strict",
            validationAction: "error"
        });

        print("✓ Colección creada: " + nombre);

    } else {

        const resultado = db.runCommand({
            collMod: nombre,
            validator: validator,
            validationLevel: "strict",
            validationAction: "error"
        });

        if (resultado.ok === 1) {
            print("✓ Validador actualizado: " + nombre);
        } else {
            throw new Error(
                "No fue posible actualizar la colección: " + nombre
            );
        }
    }
}

crearOActualizarColeccion(
    "albergues",
    validatorAlbergues
);

crearOActualizarColeccion(
    "registros_diarios",
    validatorRegistrosDiarios
);

print("");
print("Configurando índices...");

db.registros_diarios.createIndex(
    {
        albergue_id: 1,
        fecha: -1
    },
    {
        name: "ux_registros_diarios_albergue_fecha",
        unique: true
    }
);

print(
    "✓ Índice creado/verificado: ux_registros_diarios_albergue_fecha"
);