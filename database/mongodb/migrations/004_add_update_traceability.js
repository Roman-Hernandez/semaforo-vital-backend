// ============================================================
// SEMÁFORO VITAL
// US-08 - QA: Trazabilidad de modificaciones
//
// Migración:
//   004_add_update_traceability
//
// Responsabilidad DBA:
//   - preservar created_at como fecha original de creación
//   - incorporar updated_at para última modificación
//   - incorporar updated_by para usuario modificador
//   - mantener compatibilidad con documentos existentes
//   - validar referencias existentes de updated_by, si las hay
//
// Colecciones afectadas:
//   - albergues
//   - registros_diarios
//
// IMPORTANTE:
// MongoDB $jsonSchema puede validar estructura y tipo,
// pero no puede garantizar por sí mismo que un ObjectId
// referenciado exista en otra colección.
//
// La existencia de updated_by → usuarios._id debe ser validada
// por la aplicación y mediante controles de integridad DBA.
//
// created_at debe considerarse inmutable por contrato.
// Esta migración NO modifica los valores existentes de created_at.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

const MIGRATION_VERSION =
    "004_add_update_traceability";

print("");
print("====================================================");
print(" SEMÁFORO VITAL - MIGRACIÓN 004");
print(" TRAZABILIDAD DE MODIFICACIONES");
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
// 2. VERIFICAR MIGRACIÓN ANTERIOR
// ============================================================

const migracionAnterior =
    db.schema_migrations.countDocuments({
        version:
            "003_harden_data_integrity"
    });


if (
    migracionAnterior !== 1
) {

    throw new Error(
        "La migración 003_harden_data_integrity " +
        "debe estar aplicada exactamente una vez antes de ejecutar la 004."
    );
}


print(
    "✓ Migración 003 verificada."
);


// ============================================================
// 3. PREVALIDAR updated_by EXISTENTES
// ============================================================
//
// En condiciones normales todavía no deberían existir estos
// campos. La validación permite detectar datos huérfanos si
// algún documento hubiese sido modificado previamente.
// ============================================================


// ------------------------------------------------------------
// 3.1 albergues.updated_by → usuarios._id
// ------------------------------------------------------------

const alberguesUpdatedByHuerfanos =
    db.albergues.aggregate([
        {
            $match: {
                updated_by: {
                    $exists: true
                }
            }
        },

        {
            $lookup: {
                from:
                    "usuarios",

                localField:
                    "updated_by",

                foreignField:
                    "_id",

                as:
                    "usuario_actualizador"
            }
        },

        {
            $match: {
                "usuario_actualizador.0": {
                    $exists: false
                }
            }
        },

        {
            $project: {
                codigo_albergue: 1,
                updated_by: 1
            }
        }
    ]).toArray();


if (
    alberguesUpdatedByHuerfanos.length > 0
) {

    printjson(
        alberguesUpdatedByHuerfanos
    );

    throw new Error(
        "Existen albergues con updated_by inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en albergues.updated_by."
);


// ------------------------------------------------------------
// 3.2 registros_diarios.updated_by → usuarios._id
// ------------------------------------------------------------

const registrosUpdatedByHuerfanos =
    db.registros_diarios.aggregate([
        {
            $match: {
                updated_by: {
                    $exists: true
                }
            }
        },

        {
            $lookup: {
                from:
                    "usuarios",

                localField:
                    "updated_by",

                foreignField:
                    "_id",

                as:
                    "usuario_actualizador"
            }
        },

        {
            $match: {
                "usuario_actualizador.0": {
                    $exists: false
                }
            }
        },

        {
            $project: {
                albergue_id: 1,
                fecha: 1,
                updated_by: 1
            }
        }
    ]).toArray();


if (
    registrosUpdatedByHuerfanos.length > 0
) {

    printjson(
        registrosUpdatedByHuerfanos
    );

    throw new Error(
        "Existen registros diarios con updated_by inexistente."
    );
}


print(
    "✓ Sin referencias huérfanas en registros_diarios.updated_by."
);


// ============================================================
// 4. FUNCIÓN PARA EXTENDER VALIDADORES EXISTENTES
// ============================================================

function agregarTrazabilidadActualizacion(
    nombreColeccion
) {

    const informacionColeccion =
        db.getCollectionInfos({
            name:
                nombreColeccion
        });


    if (
        informacionColeccion.length !== 1
    ) {

        throw new Error(
            "No fue posible obtener la configuración de la colección: " +
            nombreColeccion
        );
    }


    const validatorActual =
        informacionColeccion[0]
            .options
            .validator;


    if (
        !validatorActual ||
        !validatorActual.$jsonSchema
    ) {

        throw new Error(
            "La colección " +
            nombreColeccion +
            " no tiene un validator $jsonSchema válido."
        );
    }


    if (
        !validatorActual.$jsonSchema.properties
    ) {

        throw new Error(
            "El validator de " +
            nombreColeccion +
            " no contiene properties."
        );
    }


    // --------------------------------------------------------
    // updated_at
    // --------------------------------------------------------

    validatorActual
        .$jsonSchema
        .properties
        .updated_at = {

            bsonType:
                "date",

            description:
                "Fecha y hora de la última modificación del documento"
        };


    // --------------------------------------------------------
    // updated_by
    // --------------------------------------------------------

    validatorActual
        .$jsonSchema
        .properties
        .updated_by = {

            bsonType:
                "objectId",

            description:
                "Referencia lógica al usuario responsable de la última modificación"
        };


    const resultado =
        db.runCommand({

            collMod:
                nombreColeccion,

            validator:
                validatorActual,

            validationLevel:
                "strict",

            validationAction:
                "error"
        });


    if (
        resultado.ok !== 1
    ) {

        throw new Error(
            "No fue posible actualizar el validator de: " +
            nombreColeccion
        );
    }


    print(
        "✓ Trazabilidad de actualización incorporada en: " +
        nombreColeccion
    );
}


// ============================================================
// 5. ACTUALIZAR VALIDADORES
// ============================================================

agregarTrazabilidadActualizacion(
    "albergues"
);


agregarTrazabilidadActualizacion(
    "registros_diarios"
);


// ============================================================
// 6. CONFIRMAR QUE created_at NO FUE MODIFICADO
// ============================================================
//
// Esta migración no ejecuta updateMany ni modifica documentos.
// Únicamente actualiza los validadores.
//
// Los valores existentes de created_at permanecen intactos.
// ============================================================

const alberguesSinCreatedAt =
    db.albergues.countDocuments({
        created_at: {
            $exists: false
        }
    });


const registrosSinCreatedAt =
    db.registros_diarios.countDocuments({
        created_at: {
            $exists: false
        }
    });


if (
    alberguesSinCreatedAt > 0
) {

    throw new Error(
        "Existen albergues sin created_at."
    );
}


if (
    registrosSinCreatedAt > 0
) {

    throw new Error(
        "Existen registros diarios sin created_at."
    );
}


print(
    "✓ created_at permanece presente en todos los documentos."
);


// ============================================================
// 7. REGISTRAR MIGRACIÓN
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
                "Agregar updated_at y updated_by a albergues y registros_diarios",

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
// 8. VERIFICAR REGISTRO ÚNICO
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
        "La migración 004 no quedó registrada exactamente una vez."
    );
}


print(
    "✓ Registro único de migración confirmado."
);


// ============================================================
// 9. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" MIGRACIÓN 004 FINALIZADA");
print("====================================================");

print(
    "✓ created_at preservado"
);

print(
    "✓ updated_at incorporado como campo opcional"
);

print(
    "✓ updated_by incorporado como campo opcional"
);

print(
    "✓ Documentos existentes compatibles"
);

print(
    "✓ Sin alteración de datos históricos"
);

print("");