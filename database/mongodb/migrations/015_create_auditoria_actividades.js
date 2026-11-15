// ============================================================
// SEMÁFORO VITAL
// Migración:
//   015_create_auditoria_actividades
//
// PROPÓSITO:
//
// Crear la colección auditoria_actividades para conservar
// registros históricos de actividades realizadas dentro del
// sistema.
//
// REQUISITOS RELACIONADOS:
//
// RF-52 Auditoría
// RF-61 Trazabilidad
// RNF-01 Seguridad
// RNF-05 Control de acceso
// RNF-12 Integridad de datos
//
// RF-52 establece que el súper administrador debe poder
// consultar los registros de actividades realizadas dentro
// del sistema.
//
// IMPORTANTE:
//
// Esta migración define exclusivamente el contrato de
// persistencia.
//
// MongoDB NO determina:
//
// - qué acciones funcionales deben auditarse;
// - cuándo debe generarse un evento;
// - qué controlador o servicio origina el evento;
// - qué actividades puede consultar cada rol;
// - la autorización para consultar auditoría.
//
// Estas responsabilidades corresponden al Backend.
//
// La colección se diseña como histórica / append-only:
//
//   1 actividad
//       =
//   1 documento nuevo
//
// NO se utilizan:
//
//   updated_at
//   updated_by
//
// porque un evento de auditoría no debe modificarse para
// representar una actividad posterior.
//
// El $jsonSchema no impide físicamente UPDATE o DELETE.
// La política append-only deberá complementarse mediante
// Backend y permisos de acceso cuando corresponda.
//
// NO se incorporan campos no definidos funcionalmente como:
//
// - ip;
// - user_agent;
// - before;
// - after;
// - valor_anterior;
// - valor_nuevo;
// - motivo;
// - resultado;
// - payload.
//
// Tampoco se crean enums artificiales para:
//
// - accion;
// - entidad.
//
// ============================================================


db = db.getSiblingDB("semaforo_vital");


const MIGRATION_VERSION =
    "015_create_auditoria_actividades";


print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 015");
print(" AUDITORÍA DE ACTIVIDADES");
print("====================================================");
print("Base de datos: " + db.getName());
print("");


// ============================================================
// 1. VERIFICAR COLECCIONES REQUERIDAS
// ============================================================

const coleccionesRequeridas = [

    "usuarios",
    "albergues",
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
// 2. VERIFICAR MIGRACIÓN ANTERIOR
// ============================================================

const migracionAnterior =
    db.schema_migrations.countDocuments({

        version:
            "014_create_escenarios"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 014_create_escenarios debe estar " +
        "aplicada exactamente una vez antes de ejecutar " +
        "la migración 015."
    );
}


print(
    "✓ Migración 014 verificada."
);


// ============================================================
// 3. DEFINIR VALIDADOR
// ============================================================

const validatorAuditoriaActividades = {

    $jsonSchema: {

        bsonType:
            "object",

        title:
            "Esquema de validación de auditoría de actividades",

        additionalProperties:
            false,

        required: [

            "usuario_id",
            "albergue_id",
            "fecha_actividad",
            "accion",
            "entidad",
            "entidad_id",
            "created_at"
        ],

        properties: {

            // =================================================
            // IDENTIFICACIÓN
            // =================================================

            _id: {

                bsonType:
                    "objectId",

                description:
                    "Identificador técnico del evento de auditoría"
            },


            // =================================================
            // USUARIO RESPONSABLE
            // =================================================

            usuario_id: {

                bsonType:
                    "objectId",

                description:
                    "Usuario que realizó la actividad. Referencia lógica hacia usuarios._id"
            },


            // =================================================
            // CONTEXTO DEL ALBERGUE
            // =================================================
            //
            // Puede ser null porque existen actividades
            // globales que no pertenecen a un albergue
            // específico.
            //
            // Ejemplos conceptuales:
            //
            // - gestión global realizada por superadministrador;
            // - autenticación;
            // - gestión de usuarios;
            // - otras operaciones globales.
            //
            // No se define aquí qué actividad debe utilizar
            // null. Esa decisión pertenece al Backend.
            //
            // =================================================

            albergue_id: {

                bsonType: [

                    "objectId",
                    "null"
                ],

                description:
                    "Albergue relacionado con la actividad cuando corresponda"
            },


            // =================================================
            // FECHA FUNCIONAL DEL EVENTO
            // =================================================

            fecha_actividad: {

                bsonType:
                    "date",

                description:
                    "Instante en el que ocurrió la actividad auditada"
            },


            // =================================================
            // ACCIÓN
            // =================================================
            //
            // No se establece enum.
            //
            // El documento de requisitos exige conservar
            // actividades, pero no define un catálogo oficial
            // de acciones.
            //
            // =================================================

            accion: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Acción realizada. Catálogo funcional pendiente"
            },


            // =================================================
            // ENTIDAD / RECURSO
            // =================================================
            //
            // No se establece enum porque no existe catálogo
            // funcional aprobado de entidades auditables.
            //
            // =================================================

            entidad: {

                bsonType:
                    "string",

                minLength:
                    1,

                description:
                    "Entidad o recurso sobre el cual se realizó la actividad"
            },


            // =================================================
            // DOCUMENTO AFECTADO
            // =================================================
            //
            // Puede ser null cuando:
            //
            // - la actividad no afecta un documento concreto;
            // - la operación es global;
            // - todavía no existe un documento destino.
            //
            // No se intenta validar automáticamente contra una
            // colección porque entidad es deliberadamente
            // abierta.
            //
            // =================================================

            entidad_id: {

                bsonType: [

                    "objectId",
                    "null"
                ],

                description:
                    "Identificador del documento relacionado con la actividad cuando exista"
            },


            // =================================================
            // DESCRIPCIÓN
            // =================================================

            descripcion: {

                bsonType:
                    "string",

                description:
                    "Descripción opcional y legible de la actividad"
            },


            // =================================================
            // TRAZABILIDAD TÉCNICA
            // =================================================

            created_at: {

                bsonType:
                    "date",

                description:
                    "Instante técnico de persistencia del registro de auditoría"
            }
        }
    }
};


// ============================================================
// 4. CREAR O ACTUALIZAR COLECCIÓN
// ============================================================

const existeAuditoriaActividades =
    db
        .getCollectionNames()
        .includes(
            "auditoria_actividades"
        );


if (
    !existeAuditoriaActividades
) {

    db.createCollection(

        "auditoria_actividades",

        {

            validator:
                validatorAuditoriaActividades,

            validationLevel:
                "strict",

            validationAction:
                "error"
        }
    );


    print(
        "✓ Colección creada: auditoria_actividades"
    );

} else {

    const resultadoCollMod =
        db.runCommand({

            collMod:
                "auditoria_actividades",

            validator:
                validatorAuditoriaActividades,

            validationLevel:
                "strict",

            validationAction:
                "error"
        });


    if (
        resultadoCollMod.ok !== 1
    ) {

        throw new Error(
            "No fue posible actualizar el validator " +
            "de auditoria_actividades."
        );
    }


    print(
        "✓ Validador actualizado: auditoria_actividades"
    );
}


// ============================================================
// 5. CREAR ÍNDICES
// ============================================================
//
// Ningún índice es UNIQUE.
//
// Pueden existir múltiples actividades:
//
// - realizadas por el mismo usuario;
// - para el mismo albergue;
// - sobre la misma entidad;
// - sobre el mismo documento;
// - ocurridas en el mismo instante.
//
// ============================================================


// ------------------------------------------------------------
// 5.1 Consulta cronológica global
// ------------------------------------------------------------

db.auditoria_actividades.createIndex(

    {

        fecha_actividad:
            -1
    },

    {

        name:
            "ix_auditoria_fecha"
    }
);


print(
    "✓ Índice creado/verificado: ix_auditoria_fecha"
);


// ------------------------------------------------------------
// 5.2 Consulta por usuario
// ------------------------------------------------------------

db.auditoria_actividades.createIndex(

    {

        usuario_id:
            1,

        fecha_actividad:
            -1
    },

    {

        name:
            "ix_auditoria_usuario_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_auditoria_usuario_fecha"
);


// ------------------------------------------------------------
// 5.3 Consulta por albergue
// ------------------------------------------------------------

db.auditoria_actividades.createIndex(

    {

        albergue_id:
            1,

        fecha_actividad:
            -1
    },

    {

        name:
            "ix_auditoria_albergue_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_auditoria_albergue_fecha"
);


// ------------------------------------------------------------
// 5.4 Consulta por entidad/documento
// ------------------------------------------------------------

db.auditoria_actividades.createIndex(

    {

        entidad:
            1,

        entidad_id:
            1,

        fecha_actividad:
            -1
    },

    {

        name:
            "ix_auditoria_entidad_fecha"
    }
);


print(
    "✓ Índice creado/verificado: " +
    "ix_auditoria_entidad_fecha"
);


// ============================================================
// 6. VERIFICAR usuario_id → usuarios._id
// ============================================================
//
// Todos los eventos de auditoría requieren usuario_id.
//
// Para procesos automáticos será necesario definir
// funcionalmente un usuario técnico.
//
// No se inventa dicho usuario dentro de esta migración.
//
// ============================================================

const auditoriasUsuarioHuerfano =
    db.auditoria_actividades.aggregate([

        {

            $lookup: {

                from:
                    "usuarios",

                localField:
                    "usuario_id",

                foreignField:
                    "_id",

                as:
                    "usuario_ref"
            }
        },


        {

            $match: {

                "usuario_ref.0": {

                    $exists:
                        false
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                usuario_id:
                    1,

                fecha_actividad:
                    1,

                accion:
                    1,

                entidad:
                    1
            }
        }

    ]).toArray();


if (
    auditoriasUsuarioHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron actividades con usuario_id huérfano:"
    );


    printjson(
        auditoriasUsuarioHuerfano
    );


    throw new Error(
        "Existen documentos de auditoria_actividades " +
        "con usuario_id inexistente."
    );
}


print(
    "✓ auditoria_actividades.usuario_id verificado."
);


// ============================================================
// 7. VERIFICAR albergue_id → albergues._id
// ============================================================
//
// albergue_id puede ser:
//
// ObjectId
// null
//
// Solo se verifica referencia cuando existe un ObjectId.
//
// ============================================================

const auditoriasAlbergueHuerfano =
    db.auditoria_actividades.aggregate([

        {

            $match: {

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
                    "albergue_ref"
            }
        },


        {

            $match: {

                "albergue_ref.0": {

                    $exists:
                        false
                }
            }
        },


        {

            $project: {

                _id:
                    1,

                usuario_id:
                    1,

                albergue_id:
                    1,

                fecha_actividad:
                    1,

                accion:
                    1,

                entidad:
                    1
            }
        }

    ]).toArray();


if (
    auditoriasAlbergueHuerfano.length > 0
) {

    print("");

    print(
        "Se detectaron actividades con albergue_id huérfano:"
    );


    printjson(
        auditoriasAlbergueHuerfano
    );


    throw new Error(
        "Existen documentos de auditoria_actividades " +
        "con albergue_id inexistente."
    );
}


print(
    "✓ auditoria_actividades.albergue_id verificado."
);


// ============================================================
// 8. DECISIONES DEL CONTRATO
// ============================================================
//
// usuario_id
//     → obligatorio.
//     → referencia lógica hacia usuarios._id.
//
// albergue_id
//     → obligatorio estructuralmente.
//     → puede contener ObjectId o null.
//     → null permite actividades globales.
//
// fecha_actividad
//     → momento funcional de la actividad.
//
// accion
//     → String abierto.
//     → no se inventa enum.
//
// entidad
//     → String abierto.
//     → no se inventa catálogo.
//
// entidad_id
//     → ObjectId o null.
//     → no se implementa foreign key dinámica.
//
// descripcion
//     → opcional.
//
// created_at
//     → fecha técnica de persistencia.
//
// updated_at / updated_by
//     → NO forman parte del contrato.
//
// ============================================================

print(
    "✓ usuario_id definido como referencia obligatoria."
);


print(
    "✓ albergue_id admite contexto específico o global."
);


print(
    "✓ accion permanece como catálogo funcional abierto."
);


print(
    "✓ entidad permanece como catálogo funcional abierto."
);


print(
    "✓ entidad_id admite documento específico o null."
);


print(
    "✓ Auditoría definida como histórica / append-only."
);


// ============================================================
// 9. RELACIÓN usuario ↔ albergue NO IMPUESTA
// ============================================================
//
// Esta migración NO obliga:
//
// administrador_albergue.albergue_id
//     =
// auditoria_actividades.albergue_id
//
// porque:
//
// - un superadministrador puede operar sobre cualquier albergue;
// - la autorización se valida antes de ejecutar la acción;
// - la auditoría registra lo que ocurrió;
// - RNF-05 corresponde al control funcional del Backend.
//
// MongoDB valida existencia de las referencias, no permisos.
//
// ============================================================

print(
    "✓ La autorización usuario/albergue permanece en Backend."
);


// ============================================================
// 10. entidad_id NO SE VALIDA CONTRA COLECCIÓN DINÁMICA
// ============================================================
//
// No se construye un switch artificial como:
//
// entidad = "albergues"
//     → buscar albergues._id
//
// entidad = "usuarios"
//     → buscar usuarios._id
//
// entidad = "alertas"
//     → buscar alertas._id
//
// etc.
//
// Los requisitos no establecen un catálogo cerrado de
// entidades auditables.
//
// Cerrar dicho catálogo desde DBA impediría incorporar nuevas
// entidades sin una definición funcional previa.
//
// ============================================================

print(
    "✓ entidad_id permanece como referencia contextual abierta."
);


// ============================================================
// 11. CAMPOS DELIBERADAMENTE NO INCORPORADOS
// ============================================================
//
// No forman parte del contrato actual:
//
// ip
// user_agent
// session_id
// request_id
// endpoint
// metodo_http
// valor_anterior
// valor_nuevo
// before
// after
// motivo
// resultado
// payload
//
// Si posteriormente existe un requerimiento explícito de
// auditoría forense o versionamiento de datos, deberá
// evolucionarse mediante una nueva migración.
//
// ============================================================

print(
    "✓ No se incorporan campos de auditoría forense no aprobados."
);


// ============================================================
// 12. USUARIO TÉCNICO
// ============================================================
//
// usuario_id es obligatorio.
//
// Para actividades automáticas deberá existir una decisión
// funcional sobre el usuario técnico que represente esos
// procesos.
//
// Esta migración NO:
//
// - crea usuarios técnicos;
// - inventa correos;
// - inventa credenciales;
// - inventa roles adicionales.
//
// Hasta que exista una definición aprobada, la responsabilidad
// permanece pendiente.
//
// ============================================================

print(
    "✓ Usuario técnico automático permanece como decisión pendiente."
);


// ============================================================
// 13. REGISTRAR MIGRACIÓN
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
                "Crear auditoría histórica de actividades realizadas dentro del sistema",

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
// 14. VERIFICAR REGISTRO ÚNICO
// ============================================================

const cantidadMigracion =
    db.schema_migrations.countDocuments({

        version:
            MIGRATION_VERSION
    });


if (
    cantidadMigracion !== 1
) {

    throw new Error(
        "La migración 015 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 15. VERIFICAR ÍNDICES
// ============================================================

const indicesAuditoria =
    db.auditoria_actividades
        .getIndexes();


// ------------------------------------------------------------
// 15.1 ix_auditoria_fecha
// ------------------------------------------------------------

const indiceAuditoriaFecha =
    indicesAuditoria.find(

        function (indice) {

            return (
                indice.name ===
                "ix_auditoria_fecha"
            );
        }
    );


if (
    !indiceAuditoriaFecha
) {

    throw new Error(
        "No existe ix_auditoria_fecha."
    );
}


if (
    indiceAuditoriaFecha.unique === true
) {

    throw new Error(
        "ix_auditoria_fecha no debe ser UNIQUE."
    );
}


if (
    indiceAuditoriaFecha.key.fecha_actividad !== -1
) {

    throw new Error(
        "La definición de ix_auditoria_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_auditoria_fecha confirmado."
);


// ------------------------------------------------------------
// 15.2 ix_auditoria_usuario_fecha
// ------------------------------------------------------------

const indiceAuditoriaUsuarioFecha =
    indicesAuditoria.find(

        function (indice) {

            return (
                indice.name ===
                "ix_auditoria_usuario_fecha"
            );
        }
    );


if (
    !indiceAuditoriaUsuarioFecha
) {

    throw new Error(
        "No existe ix_auditoria_usuario_fecha."
    );
}


if (
    indiceAuditoriaUsuarioFecha.unique === true
) {

    throw new Error(
        "ix_auditoria_usuario_fecha no debe ser UNIQUE."
    );
}


if (
    indiceAuditoriaUsuarioFecha.key.usuario_id !== 1 ||
    indiceAuditoriaUsuarioFecha.key.fecha_actividad !== -1
) {

    throw new Error(
        "La definición de ix_auditoria_usuario_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_auditoria_usuario_fecha confirmado."
);


// ------------------------------------------------------------
// 15.3 ix_auditoria_albergue_fecha
// ------------------------------------------------------------

const indiceAuditoriaAlbergueFecha =
    indicesAuditoria.find(

        function (indice) {

            return (
                indice.name ===
                "ix_auditoria_albergue_fecha"
            );
        }
    );


if (
    !indiceAuditoriaAlbergueFecha
) {

    throw new Error(
        "No existe ix_auditoria_albergue_fecha."
    );
}


if (
    indiceAuditoriaAlbergueFecha.unique === true
) {

    throw new Error(
        "ix_auditoria_albergue_fecha no debe ser UNIQUE."
    );
}


if (
    indiceAuditoriaAlbergueFecha.key.albergue_id !== 1 ||
    indiceAuditoriaAlbergueFecha.key.fecha_actividad !== -1
) {

    throw new Error(
        "La definición de ix_auditoria_albergue_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_auditoria_albergue_fecha confirmado."
);


// ------------------------------------------------------------
// 15.4 ix_auditoria_entidad_fecha
// ------------------------------------------------------------

const indiceAuditoriaEntidadFecha =
    indicesAuditoria.find(

        function (indice) {

            return (
                indice.name ===
                "ix_auditoria_entidad_fecha"
            );
        }
    );


if (
    !indiceAuditoriaEntidadFecha
) {

    throw new Error(
        "No existe ix_auditoria_entidad_fecha."
    );
}


if (
    indiceAuditoriaEntidadFecha.unique === true
) {

    throw new Error(
        "ix_auditoria_entidad_fecha no debe ser UNIQUE."
    );
}


if (
    indiceAuditoriaEntidadFecha.key.entidad !== 1 ||
    indiceAuditoriaEntidadFecha.key.entidad_id !== 1 ||
    indiceAuditoriaEntidadFecha.key.fecha_actividad !== -1
) {

    throw new Error(
        "La definición de ix_auditoria_entidad_fecha " +
        "no corresponde al contrato."
    );
}


print(
    "✓ Índice ix_auditoria_entidad_fecha confirmado."
);


// ============================================================
// 16. VERIFICAR VALIDACIÓN STRICT
// ============================================================

const infoColeccion =
    db
        .getCollectionInfos({

            name:
                "auditoria_actividades"
        })[0];


if (
    !infoColeccion
) {

    throw new Error(
        "No fue posible consultar la colección " +
        "auditoria_actividades."
    );
}


if (
    infoColeccion.options.validationLevel !== "strict"
) {

    throw new Error(
        "auditoria_actividades debe utilizar " +
        "validationLevel strict."
    );
}


if (
    infoColeccion.options.validationAction !== "error"
) {

    throw new Error(
        "auditoria_actividades debe utilizar " +
        "validationAction error."
    );
}


print(
    "✓ Validación strict/error confirmada."
);


// ============================================================
// 17. VERIFICAR CONFIGURACIÓN DEL VALIDADOR
// ============================================================
//
// Esta comprobación no intenta comparar todo el JSON Schema.
// Confirma que la colección tenga validator persistido.
//
// ============================================================

if (
    !infoColeccion.options.validator ||
    !infoColeccion.options.validator.$jsonSchema
) {

    throw new Error(
        "auditoria_actividades no tiene un " +
        "$jsonSchema configurado."
    );
}


print(
    "✓ $jsonSchema de auditoria_actividades confirmado."
);


// ============================================================
// 18. VERIFICAR CAMPOS HISTÓRICOS NO PERMITIDOS
// ============================================================
//
// additionalProperties:false provoca que documentos nuevos con
// updated_at o updated_by sean rechazados.
//
// Aquí también se comprueba que no existan documentos previos
// con dichos campos en caso de que la colección ya existiera.
//
// ============================================================

const auditoriasConCamposActualizacion =
    db.auditoria_actividades.find({

        $or: [

            {

                updated_at: {

                    $exists:
                        true
                }
            },

            {

                updated_by: {

                    $exists:
                        true
                }
            }
        ]
    }).toArray();


if (
    auditoriasConCamposActualizacion.length > 0
) {

    print("");

    print(
        "Se detectaron registros de auditoría con " +
        "campos de actualización:"
    );


    printjson(
        auditoriasConCamposActualizacion
    );


    throw new Error(
        "auditoria_actividades es append-only y no debe " +
        "contener updated_at ni updated_by."
    );
}


print(
    "✓ No existen campos updated_at/updated_by."
);


// ============================================================
// 19. CONTRATO IMPLEMENTADO
// ============================================================

print("");
print("----------------------------------------------------");
print(" CONTRATO IMPLEMENTADO");
print("----------------------------------------------------");


print(
    "✓ usuario_id obligatorio"
);


print(
    "✓ albergue_id ObjectId o null"
);


print(
    "✓ fecha_actividad obligatoria"
);


print(
    "✓ accion String abierta"
);


print(
    "✓ entidad String abierta"
);


print(
    "✓ entidad_id ObjectId o null"
);


print(
    "✓ descripcion opcional"
);


print(
    "✓ created_at obligatorio"
);


print(
    "✓ referencia usuario verificada"
);


print(
    "✓ referencia albergue verificada cuando aplica"
);


print(
    "✓ cuatro índices de consulta"
);


print(
    "✓ colección histórica / append-only"
);


// ============================================================
// 20. RESPONSABILIDAD DEL BACKEND
// ============================================================
//
// La existencia de la colección NO captura automáticamente
// actividades.
//
// Backend deberá insertar un documento en
// auditoria_actividades cuando corresponda.
//
// También deberá definir:
//
// - qué operaciones generan auditoría;
// - qué valor utiliza accion;
// - qué valor utiliza entidad;
// - cuándo albergue_id debe ser null;
// - cuándo entidad_id debe ser null;
// - qué descripción debe persistirse;
// - qué roles pueden consultar los registros;
// - cómo representar procesos automáticos cuando exista
//   usuario técnico.
//
// ============================================================

print(
    "✓ Contrato preparado para integración con Backend."
);


// ============================================================
// 21. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" MIGRACIÓN 015 FINALIZADA");
print("====================================================");


print(
    "✓ Colección auditoria_actividades disponible"
);


print(
    "✓ Validator $jsonSchema strict"
);


print(
    "✓ Índice cronológico global"
);


print(
    "✓ Índice por usuario"
);


print(
    "✓ Índice por albergue"
);


print(
    "✓ Índice por entidad/documento"
);


print(
    "✓ usuario_id controlado"
);


print(
    "✓ albergue_id controlado cuando aplica"
);


print(
    "✓ Catálogos accion/entidad no inventados"
);


print(
    "✓ Auditoría forense no ampliada artificialmente"
);


print(
    "✓ Migración registrada"
);


print("");