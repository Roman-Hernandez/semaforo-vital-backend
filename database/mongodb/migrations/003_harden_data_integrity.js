// ============================================================
// SEMÁFORO VITAL
// US-08 - QA: Endurecimiento de integridad del modelo de datos
//
// Migración:
//   003_harden_data_integrity
//
// Responsabilidad DBA:
//   - fortalecer el validador de usuarios
//   - exigir correo normalizado
//   - exigir hash Argon2id
//   - validar reglas según rol
//   - crear índice único para codigo_albergue
//   - proteger las versiones de schema_migrations
//   - verificar índices existentes
//
// IMPORTANTE:
// MongoDB puede garantizar estructura, tipos, rangos y unicidad.
// La existencia de referencias entre colecciones debe validarse
// desde la aplicación y mediante controles de integridad DBA.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

const MIGRATION_VERSION =
    "003_harden_data_integrity";

print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 003");
print(" ENDURECIMIENTO DE INTEGRIDAD DEL MODELO");
print("====================================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES REQUERIDAS
// ============================================================

const coleccionesRequeridas = [
    "usuarios",
    "albergues",
    "registros_diarios",
    "schema_migrations"
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
                "No existe la colección requerida: " +
                coleccion
            );
        }
    }
);

print(
    "✓ Colecciones requeridas disponibles."
);


// ============================================================
// 2. PREVALIDACIÓN - DUPLICADOS
// ============================================================


// ------------------------------------------------------------
// 2.1 codigo_albergue duplicado
// ------------------------------------------------------------

const codigosAlbergueDuplicados =
    db.albergues.aggregate([
        {
            $group: {
                _id: "$codigo_albergue",

                cantidad: {
                    $sum: 1
                },

                documentos: {
                    $push: "$_id"
                }
            }
        },

        {
            $match: {
                cantidad: {
                    $gt: 1
                }
            }
        }
    ]).toArray();


if (
    codigosAlbergueDuplicados.length > 0
) {

    printjson(
        codigosAlbergueDuplicados
    );

    throw new Error(
        "Existen valores duplicados de codigo_albergue."
    );
}

print(
    "✓ Sin duplicados en codigo_albergue."
);


// ------------------------------------------------------------
// 2.2 versiones de migración duplicadas
// ------------------------------------------------------------

const versionesDuplicadas =
    db.schema_migrations.aggregate([
        {
            $group: {
                _id: "$version",

                cantidad: {
                    $sum: 1
                },

                documentos: {
                    $push: "$_id"
                }
            }
        },

        {
            $match: {
                cantidad: {
                    $gt: 1
                }
            }
        }
    ]).toArray();


if (
    versionesDuplicadas.length > 0
) {

    printjson(
        versionesDuplicadas
    );

    throw new Error(
        "Existen versiones duplicadas en schema_migrations."
    );
}

print(
    "✓ Sin versiones de migración duplicadas."
);


// ------------------------------------------------------------
// 2.3 emails duplicados después de normalización
// ------------------------------------------------------------

const emailsDuplicados =
    db.usuarios.aggregate([
        {
            $project: {
                email_original:
                    "$email",

                email_normalized: {
                    $toLower:
                        "$email"
                }
            }
        },

        {
            $group: {
                _id:
                    "$email_normalized",

                cantidad: {
                    $sum: 1
                },

                emails: {
                    $push:
                        "$email_original"
                }
            }
        },

        {
            $match: {
                cantidad: {
                    $gt: 1
                }
            }
        }
    ]).toArray();


if (
    emailsDuplicados.length > 0
) {

    printjson(
        emailsDuplicados
    );

    throw new Error(
        "Existen emails duplicados después de normalización."
    );
}

print(
    "✓ Sin emails duplicados después de normalización."
);


// ============================================================
// 3. PREVALIDACIÓN DE USUARIOS EXISTENTES
// ============================================================


// ------------------------------------------------------------
// 3.1 campos mínimos
// ------------------------------------------------------------

const usuariosCamposInvalidos =
    db.usuarios.countDocuments({
        $or: [
            {
                email: {
                    $exists: false
                }
            },

            {
                password_hash: {
                    $exists: false
                }
            },

            {
                role: {
                    $exists: false
                }
            },

            {
                active: {
                    $exists: false
                }
            },

            {
                nombre: {
                    $exists: false
                }
            },

            {
                created_at: {
                    $exists: false
                }
            },

            {
                updated_at: {
                    $exists: false
                }
            }
        ]
    });


if (
    usuariosCamposInvalidos > 0
) {

    throw new Error(
        "Existen usuarios sin los campos mínimos requeridos."
    );
}

print(
    "✓ Usuarios con campos mínimos requeridos."
);


// ------------------------------------------------------------
// 3.2 correo normalizado
// ------------------------------------------------------------

const usuariosEmailNoNormalizado =
    db.usuarios.countDocuments({
        $expr: {
            $ne: [
                "$email",

                {
                    $toLower:
                        "$email"
                }
            ]
        }
    });


if (
    usuariosEmailNoNormalizado > 0
) {

    throw new Error(
        "Existen usuarios con email no normalizado."
    );
}

print(
    "✓ Emails almacenados en minúsculas."
);


// ------------------------------------------------------------
// 3.3 password_hash Argon2id
// ------------------------------------------------------------

const usuariosHashInvalido =
    db.usuarios.countDocuments({
        password_hash: {
            $not:
                /^\$argon2id\$/
        }
    });


if (
    usuariosHashInvalido > 0
) {

    throw new Error(
        "Existen usuarios cuyo password_hash no utiliza Argon2id."
    );
}

print(
    "✓ password_hash utiliza formato Argon2id."
);


// ------------------------------------------------------------
// 3.4 roles permitidos
// ------------------------------------------------------------

const usuariosRolInvalido =
    db.usuarios.countDocuments({
        role: {
            $nin: [
                "super_administrador",
                "administrador_albergue"
            ]
        }
    });


if (
    usuariosRolInvalido > 0
) {

    throw new Error(
        "Existen usuarios con roles no permitidos."
    );
}

print(
    "✓ Roles de usuarios válidos."
);


// ------------------------------------------------------------
// 3.5 administrador_albergue debe tener albergue_id
// ------------------------------------------------------------

const administradoresSinAlbergue =
    db.usuarios.countDocuments({
        role:
            "administrador_albergue",

        $or: [
            {
                albergue_id: {
                    $exists: false
                }
            },

            {
                albergue_id:
                    null
            }
        ]
    });


if (
    administradoresSinAlbergue > 0
) {

    throw new Error(
        "Existen administradores de albergue sin albergue_id."
    );
}

print(
    "✓ administradores_albergue con albergue_id."
);


// ------------------------------------------------------------
// 3.6 super_administrador no debe tener ObjectId de albergue
// ------------------------------------------------------------

const superAdminsConAlbergue =
    db.usuarios.countDocuments({
        role:
            "super_administrador",

        albergue_id: {
            $type:
                "objectId"
        }
    });


if (
    superAdminsConAlbergue > 0
) {

    throw new Error(
        "Existen super_administradores asociados a un albergue."
    );
}

print(
    "✓ super_administradores sin asociación a albergue."
);


// ------------------------------------------------------------
// 3.7 albergue_id de administradores debe existir
// ------------------------------------------------------------

const administradoresAlbergueHuerfanos =
    db.usuarios.aggregate([
        {
            $match: {
                role:
                    "administrador_albergue",

                albergue_id: {
                    $type:
                        "objectId"
                }
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
                email: 1,
                albergue_id: 1
            }
        }
    ]).toArray();


if (
    administradoresAlbergueHuerfanos.length > 0
) {

    printjson(
        administradoresAlbergueHuerfanos
    );

    throw new Error(
        "Existen administradores asociados a albergues inexistentes."
    );
}

print(
    "✓ Referencias usuario → albergue existentes."
);


// ============================================================
// 4. VALIDADOR FORTALECIDO DE USUARIOS
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
                    "objectId",

                description:
                    "Identificador único del usuario"
            },


            email: {
                bsonType:
                    "string",

                minLength:
                    3,

                maxLength:
                    254,

                pattern:
                    "^[^\\s@A-Z]+@[^\\s@A-Z]+\\.[^\\s@A-Z]+$",

                description:
                    "Correo normalizado en minúsculas y sin espacios"
            },


            password_hash: {
                bsonType:
                    "string",

                minLength:
                    20,

                pattern:
                    "^\\$argon2id\\$",

                description:
                    "Hash Argon2id. Nunca debe almacenarse contraseña en texto plano"
            },


            role: {
                bsonType:
                    "string",

                enum: [
                    "administrador_albergue",
                    "super_administrador"
                ],

                description:
                    "Rol autorizado del usuario"
            },


            active: {
                bsonType:
                    "bool",

                description:
                    "Estado lógico del usuario"
            },


            nombre: {
                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Nombre del usuario"
            },


            apellido: {
                bsonType:
                    "string",

                minLength:
                    1,

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
                bsonType:
                    "date",

                description:
                    "Fecha original de creación"
            },


            updated_at: {
                bsonType:
                    "date",

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

            // ------------------------------------------------
            // SUPER ADMINISTRADOR
            // ------------------------------------------------

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


            // ------------------------------------------------
            // ADMINISTRADOR DE ALBERGUE
            // ------------------------------------------------

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


const resultadoValidatorUsuarios =
    db.runCommand({

        collMod:
            "usuarios",

        validator:
            validatorUsuarios,

        validationLevel:
            "strict",

        validationAction:
            "error"
    });


if (
    resultadoValidatorUsuarios.ok !== 1
) {

    throw new Error(
        "No fue posible actualizar el validador de usuarios."
    );
}

print(
    "✓ Validador de usuarios fortalecido."
);


// ============================================================
// 5. ÍNDICES
// ============================================================

print("");
print("Configurando índices...");


// ------------------------------------------------------------
// 5.1 email único
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
    "✓ Índice verificado: ux_usuarios_email"
);


// ------------------------------------------------------------
// 5.2 usuario → albergue
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
    "✓ Índice verificado: ix_usuarios_albergue_id"
);


// ------------------------------------------------------------
// 5.3 codigo_albergue único
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
    "✓ Índice creado/verificado: " +
    "ux_albergues_codigo_albergue"
);


// ------------------------------------------------------------
// 5.4 registro consolidado por albergue + día
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
    "✓ Índice verificado: " +
    "ux_registros_diarios_albergue_fecha"
);


// ------------------------------------------------------------
// 5.5 versión de migración única
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
    "✓ Índice creado/verificado: " +
    "ux_schema_migrations_version"
);


// ============================================================
// 6. REGISTRAR MIGRACIÓN
// ============================================================

db.schema_migrations.updateOne(
    {
        version:
            MIGRATION_VERSION
    },

    {
        $setOnInsert: {

            version:
                MIGRATION_VERSION,

            description:
                "Fortalecer validadores e índices de integridad del modelo",

            executed_at:
                new Date()
        }
    },

    {
        upsert:
            true
    }
);

print("");
print(
    "✓ Migración registrada: " +
    MIGRATION_VERSION
);


// ============================================================
// 7. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" MIGRACIÓN 003 FINALIZADA");
print("====================================================");

print(
    "✓ Validador de usuarios fortalecido"
);

print(
    "✓ codigo_albergue protegido por índice unique"
);

print(
    "✓ version de schema_migrations protegida por índice unique"
);

print(
    "✓ índice albergue_id + fecha verificado"
);

print("");