// ============================================================
// SEMÁFORO VITAL
// Pruebas DBA - auditoria_actividades
//
// Migración asociada:
//   015_create_auditoria_actividades
//
// Cobertura:
//
// - documento válido
// - campos obligatorios
// - tipos BSON
// - albergue global o específico
// - acción abierta
// - entidad abierta
// - entidad_id opcional funcionalmente mediante null
// - descripción opcional
// - naturaleza histórica / append-only
// - additionalProperties false
// - referencias lógicas
// - índices
// - migración registrada
// - validación strict/error
//
// IMPORTANTE:
//
// auditoria_actividades registra eventos históricos.
//
// 1 actividad
//     =
// 1 documento nuevo
//
// La colección NO implementa versionamiento completo de
// documentos ni auditoría forense.
//
// accion y entidad permanecen como Strings abiertas porque
// no existe todavía un catálogo funcional aprobado.
// ============================================================


db = db.getSiblingDB("semaforo_vital");


print("");
print("====================================================");
print(" SEMÁFORO VITAL");
print(" PRUEBAS DBA - auditoria_actividades");
print("====================================================");
print("");


let pruebasExitosas = 0;
let pruebasFallidas = 0;


// ============================================================
// 1. UTILIDADES
// ============================================================

function prueba(
    nombre,
    funcion
) {

    try {

        funcion();

        pruebasExitosas++;

        print(
            "✓ " +
            nombre
        );

    } catch (error) {

        pruebasFallidas++;

        print(
            "✗ " +
            nombre
        );

        print(
            "  " +
            error.message
        );
    }
}


function assertTrue(
    condicion,
    mensaje
) {

    if (!condicion) {

        throw new Error(
            mensaje
        );
    }
}


function esperarErrorValidacion(
    funcion
) {

    let errorDetectado =
        false;

    try {

        funcion();

    } catch (error) {

        if (
            error.code === 121
        ) {

            errorDetectado =
                true;

        } else {

            throw error;
        }
    }


    if (!errorDetectado) {

        throw new Error(
            "Se esperaba error de validación MongoDB 121."
        );
    }
}


// ============================================================
// 2. PRECONDICIONES
// ============================================================

const coleccionesRequeridas = [

    "usuarios",
    "albergues",
    "auditoria_actividades",
    "schema_migrations"
];


coleccionesRequeridas.forEach(

    function (coleccion) {

        assertTrue(

            db
                .getCollectionNames()
                .includes(
                    coleccion
                ),

            "No existe la colección requerida: " +
            coleccion
        );
    }
);


const usuarioPrueba =
    db.usuarios.findOne({});


assertTrue(
    usuarioPrueba !== null,
    "Se requiere al menos un usuario para ejecutar las pruebas."
);


const alberguePrueba =
    db.albergues.findOne({});


assertTrue(
    alberguePrueba !== null,
    "Se requiere al menos un albergue para ejecutar las pruebas."
);


const USUARIO_TEST_ID =
    usuarioPrueba._id;


const ALBERGUE_TEST_ID =
    alberguePrueba._id;


const MARCADOR =
    "DBA_TEST_AUDITORIA";


const FECHA_BASE =
    ISODate(
        "2099-12-01T13:00:00.000Z"
    );


function fechaPrueba(
    minutos
) {

    return new Date(

        FECHA_BASE.getTime() +

        (
            minutos *
            60 *
            1000
        )
    );
}


// ============================================================
// 3. LIMPIEZA PREVIA
// ============================================================

db.auditoria_actividades.deleteMany({

    accion: {

        $regex:
            "^" + MARCADOR
    }
});


print(
    "✓ Limpieza previa completada."
);


// ============================================================
// 4. FACTORÍA DE DOCUMENTO VÁLIDO
// ============================================================

function documentoValido(
    sufijo
) {

    return {

        usuario_id:
            USUARIO_TEST_ID,

        albergue_id:
            ALBERGUE_TEST_ID,

        fecha_actividad:
            fechaPrueba(1),

        accion:
            MARCADOR +
            "_" +
            sufijo,

        entidad:
            "albergues",

        entidad_id:
            ALBERGUE_TEST_ID,

        descripcion:
            "Actividad generada por pruebas DBA",

        created_at:
            new Date()
    };
}


// ============================================================
// 5. DOCUMENTO BASE
// ============================================================


// ------------------------------------------------------------
// PRUEBA 1
// ------------------------------------------------------------

prueba(
    "1. Permite insertar una actividad válida",

    function () {

        const resultado =
            db.auditoria_actividades.insertOne(

                documentoValido(
                    "VALIDO"
                )
            );


        assertTrue(

            resultado.acknowledged === true,

            "MongoDB no confirmó la inserción."
        );
    }
);


// ============================================================
// 6. usuario_id
// ============================================================


// ------------------------------------------------------------
// PRUEBA 2
// ------------------------------------------------------------

prueba(
    "2. usuario_id es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_USUARIO"
            );


        delete documento.usuario_id;


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 3
// ------------------------------------------------------------

prueba(
    "3. usuario_id debe ser ObjectId",

    function () {

        const documento =
            documentoValido(
                "USUARIO_TIPO"
            );


        documento.usuario_id =
            "usuario_invalido";


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 7. albergue_id
// ============================================================


// ------------------------------------------------------------
// PRUEBA 4
// ------------------------------------------------------------

prueba(
    "4. albergue_id es obligatorio estructuralmente",

    function () {

        const documento =
            documentoValido(
                "SIN_ALBERGUE"
            );


        delete documento.albergue_id;


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 5
// ------------------------------------------------------------

prueba(
    "5. albergue_id puede ser null para actividad global",

    function () {

        const documento =
            documentoValido(
                "ALBERGUE_NULL"
            );


        documento.albergue_id =
            null;


        db.auditoria_actividades.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 6
// ------------------------------------------------------------

prueba(
    "6. albergue_id rechaza tipos distintos de ObjectId o null",

    function () {

        const documento =
            documentoValido(
                "ALBERGUE_TIPO"
            );


        documento.albergue_id =
            "albergue_invalido";


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 8. fecha_actividad
// ============================================================


// ------------------------------------------------------------
// PRUEBA 7
// ------------------------------------------------------------

prueba(
    "7. fecha_actividad es obligatoria",

    function () {

        const documento =
            documentoValido(
                "SIN_FECHA"
            );


        delete documento.fecha_actividad;


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 8
// ------------------------------------------------------------

prueba(
    "8. fecha_actividad debe ser Date",

    function () {

        const documento =
            documentoValido(
                "FECHA_TIPO"
            );


        documento.fecha_actividad =
            "2099-12-01";


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 9. accion
// ============================================================


// ------------------------------------------------------------
// PRUEBA 9
// ------------------------------------------------------------

prueba(
    "9. accion es obligatoria",

    function () {

        const documento =
            documentoValido(
                "SIN_ACCION"
            );


        delete documento.accion;


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 10
// ------------------------------------------------------------

prueba(
    "10. accion no puede estar vacía",

    function () {

        const documento =
            documentoValido(
                "ACCION_VACIA"
            );


        documento.accion =
            "";


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 11
// ------------------------------------------------------------

prueba(
    "11. accion debe ser String",

    function () {

        const documento =
            documentoValido(
                "ACCION_TIPO"
            );


        documento.accion =
            NumberInt(10);


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 12
// ------------------------------------------------------------

prueba(
    "12. accion permite valores abiertos sin enum artificial",

    function () {

        const documento =
            documentoValido(
                "ACCION_ABIERTA"
            );


        documento.accion =
            MARCADOR +
            "_ACCION_FUNCIONAL_NO_CATALOGADA";


        db.auditoria_actividades.insertOne(
            documento
        );
    }
);


// ============================================================
// 10. entidad
// ============================================================


// ------------------------------------------------------------
// PRUEBA 13
// ------------------------------------------------------------

prueba(
    "13. entidad es obligatoria",

    function () {

        const documento =
            documentoValido(
                "SIN_ENTIDAD"
            );


        delete documento.entidad;


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 14
// ------------------------------------------------------------

prueba(
    "14. entidad no puede estar vacía",

    function () {

        const documento =
            documentoValido(
                "ENTIDAD_VACIA"
            );


        documento.entidad =
            "";


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 15
// ------------------------------------------------------------

prueba(
    "15. entidad debe ser String",

    function () {

        const documento =
            documentoValido(
                "ENTIDAD_TIPO"
            );


        documento.entidad =
            NumberInt(10);


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 16
// ------------------------------------------------------------

prueba(
    "16. entidad permite valores abiertos sin catálogo artificial",

    function () {

        const documento =
            documentoValido(
                "ENTIDAD_ABIERTA"
            );


        documento.entidad =
            "recurso_funcional_futuro";


        db.auditoria_actividades.insertOne(
            documento
        );
    }
);


// ============================================================
// 11. entidad_id
// ============================================================


// ------------------------------------------------------------
// PRUEBA 17
// ------------------------------------------------------------

prueba(
    "17. entidad_id es obligatorio estructuralmente",

    function () {

        const documento =
            documentoValido(
                "SIN_ENTIDAD_ID"
            );


        delete documento.entidad_id;


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 18
// ------------------------------------------------------------

prueba(
    "18. entidad_id puede ser null",

    function () {

        const documento =
            documentoValido(
                "ENTIDAD_ID_NULL"
            );


        documento.entidad_id =
            null;


        db.auditoria_actividades.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 19
// ------------------------------------------------------------

prueba(
    "19. entidad_id permite ObjectId",

    function () {

        const documento =
            documentoValido(
                "ENTIDAD_ID_OBJECTID"
            );


        documento.entidad_id =
            new ObjectId();


        db.auditoria_actividades.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 20
// ------------------------------------------------------------

prueba(
    "20. entidad_id rechaza tipos distintos de ObjectId o null",

    function () {

        const documento =
            documentoValido(
                "ENTIDAD_ID_TIPO"
            );


        documento.entidad_id =
            "identificador_invalido";


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 12. descripcion
// ============================================================


// ------------------------------------------------------------
// PRUEBA 21
// ------------------------------------------------------------

prueba(
    "21. descripcion es opcional",

    function () {

        const documento =
            documentoValido(
                "SIN_DESCRIPCION"
            );


        delete documento.descripcion;


        db.auditoria_actividades.insertOne(
            documento
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 22
// ------------------------------------------------------------

prueba(
    "22. descripcion debe ser String cuando existe",

    function () {

        const documento =
            documentoValido(
                "DESCRIPCION_TIPO"
            );


        documento.descripcion =
            NumberInt(123);


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 13. created_at
// ============================================================


// ------------------------------------------------------------
// PRUEBA 23
// ------------------------------------------------------------

prueba(
    "23. created_at es obligatorio",

    function () {

        const documento =
            documentoValido(
                "SIN_CREATED_AT"
            );


        delete documento.created_at;


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 24
// ------------------------------------------------------------

prueba(
    "24. created_at debe ser Date",

    function () {

        const documento =
            documentoValido(
                "CREATED_AT_TIPO"
            );


        documento.created_at =
            "2099-12-01";


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 14. CONTRATO CERRADO / APPEND-ONLY
// ============================================================


// ------------------------------------------------------------
// PRUEBA 25
// ------------------------------------------------------------

prueba(
    "25. Rechaza propiedades adicionales de primer nivel",

    function () {

        const documento =
            documentoValido(
                "CAMPO_EXTRA"
            );


        documento.campo_no_permitido =
            true;


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 26
// ------------------------------------------------------------

prueba(
    "26. updated_at no pertenece al contrato histórico",

    function () {

        const documento =
            documentoValido(
                "UPDATED_AT"
            );


        documento.updated_at =
            new Date();


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 27
// ------------------------------------------------------------

prueba(
    "27. updated_by no pertenece al contrato histórico",

    function () {

        const documento =
            documentoValido(
                "UPDATED_BY"
            );


        documento.updated_by =
            USUARIO_TEST_ID;


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 28
// ------------------------------------------------------------

prueba(
    "28. Permite eventos históricos equivalentes",

    function () {

        const documento1 =
            documentoValido(
                "HISTORICO"
            );


        const documento2 =
            documentoValido(
                "HISTORICO"
            );


        documento1.fecha_actividad =
            fechaPrueba(28);


        documento2.fecha_actividad =
            fechaPrueba(28);


        documento1.created_at =
            fechaPrueba(29);


        documento2.created_at =
            fechaPrueba(29);


        const resultado =
            db.auditoria_actividades.insertMany([

                documento1,
                documento2
            ]);


        assertTrue(

            Object.keys(
                resultado.insertedIds
            ).length === 2,

            "No se pudieron insertar ambos eventos históricos."
        );
    }
);


// ============================================================
// 15. REFERENCIA usuario_id
// ============================================================


// ------------------------------------------------------------
// PRUEBA 29
// ------------------------------------------------------------

prueba(
    "29. usuario_id válido resuelve hacia usuarios",

    function () {

        const insercion =
            db.auditoria_actividades.insertOne(

                documentoValido(
                    "USUARIO_VALIDO_REF"
                )
            );


        const encontrados =
            db.auditoria_actividades.aggregate([

                {

                    $match: {

                        _id:
                            insercion.insertedId
                    }
                },

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
                }

            ]).toArray();


        assertTrue(

            encontrados.length === 1 &&
            encontrados[0]
                .usuario_ref
                .length === 1,

            "No se resolvió usuario_id hacia usuarios."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 30
// ------------------------------------------------------------

prueba(
    "30. Detecta usuario_id huérfano",

    function () {

        const documento =
            documentoValido(
                "USUARIO_HUERFANO"
            );


        documento.usuario_id =
            new ObjectId();


        const insercion =
            db.auditoria_actividades.insertOne(
                documento
            );


        const encontrados =
            db.auditoria_actividades.aggregate([

                {

                    $match: {

                        _id:
                            insercion.insertedId
                    }
                },

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
                }

            ]).toArray();


        assertTrue(

            encontrados.length === 1,

            "No se detectó usuario_id huérfano."
        );
    }
);


// ============================================================
// 16. REFERENCIA albergue_id
// ============================================================


// ------------------------------------------------------------
// PRUEBA 31
// ------------------------------------------------------------

prueba(
    "31. albergue_id válido resuelve hacia albergues",

    function () {

        const insercion =
            db.auditoria_actividades.insertOne(

                documentoValido(
                    "ALBERGUE_VALIDO_REF"
                )
            );


        const encontrados =
            db.auditoria_actividades.aggregate([

                {

                    $match: {

                        _id:
                            insercion.insertedId
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
                }

            ]).toArray();


        assertTrue(

            encontrados.length === 1 &&
            encontrados[0]
                .albergue_ref
                .length === 1,

            "No se resolvió albergue_id hacia albergues."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 32
// ------------------------------------------------------------

prueba(
    "32. Detecta albergue_id huérfano",

    function () {

        const documento =
            documentoValido(
                "ALBERGUE_HUERFANO"
            );


        documento.albergue_id =
            new ObjectId();


        const insercion =
            db.auditoria_actividades.insertOne(
                documento
            );


        const encontrados =
            db.auditoria_actividades.aggregate([

                {

                    $match: {

                        _id:
                            insercion.insertedId,

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
                }

            ]).toArray();


        assertTrue(

            encontrados.length === 1,

            "No se detectó albergue_id huérfano."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 33
// ------------------------------------------------------------

prueba(
    "33. albergue_id null no se considera referencia huérfana",

    function () {

        const documento =
            documentoValido(
                "ALBERGUE_GLOBAL"
            );


        documento.albergue_id =
            null;


        const insercion =
            db.auditoria_actividades.insertOne(
                documento
            );


        const huerfanos =
            db.auditoria_actividades.aggregate([

                {

                    $match: {

                        _id:
                            insercion.insertedId,

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
                }

            ]).toArray();


        assertTrue(

            huerfanos.length === 0,

            "Una actividad global con albergue_id null " +
            "no debe considerarse huérfana."
        );
    }
);


// ============================================================
// 17. ÍNDICES
// ============================================================


// ------------------------------------------------------------
// PRUEBA 34
// ------------------------------------------------------------

prueba(
    "34. ix_auditoria_fecha es correcto y no único",

    function () {

        const indice =
            db.auditoria_actividades
                .getIndexes()
                .find(

                    function (item) {

                        return (
                            item.name ===
                            "ix_auditoria_fecha"
                        );
                    }
                );


        assertTrue(

            indice !== undefined,

            "No existe ix_auditoria_fecha."
        );


        assertTrue(

            indice.unique !== true,

            "ix_auditoria_fecha no debe ser UNIQUE."
        );


        assertTrue(

            indice.key.fecha_actividad === -1,

            "La definición de ix_auditoria_fecha es incorrecta."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 35
// ------------------------------------------------------------

prueba(
    "35. ix_auditoria_usuario_fecha es correcto y no único",

    function () {

        const indice =
            db.auditoria_actividades
                .getIndexes()
                .find(

                    function (item) {

                        return (
                            item.name ===
                            "ix_auditoria_usuario_fecha"
                        );
                    }
                );


        assertTrue(

            indice !== undefined,

            "No existe ix_auditoria_usuario_fecha."
        );


        assertTrue(

            indice.unique !== true,

            "ix_auditoria_usuario_fecha no debe ser UNIQUE."
        );


        assertTrue(

            indice.key.usuario_id === 1 &&
            indice.key.fecha_actividad === -1,

            "La definición de ix_auditoria_usuario_fecha " +
            "es incorrecta."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 36
// ------------------------------------------------------------

prueba(
    "36. ix_auditoria_albergue_fecha es correcto y no único",

    function () {

        const indice =
            db.auditoria_actividades
                .getIndexes()
                .find(

                    function (item) {

                        return (
                            item.name ===
                            "ix_auditoria_albergue_fecha"
                        );
                    }
                );


        assertTrue(

            indice !== undefined,

            "No existe ix_auditoria_albergue_fecha."
        );


        assertTrue(

            indice.unique !== true,

            "ix_auditoria_albergue_fecha no debe ser UNIQUE."
        );


        assertTrue(

            indice.key.albergue_id === 1 &&
            indice.key.fecha_actividad === -1,

            "La definición de ix_auditoria_albergue_fecha " +
            "es incorrecta."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 37
// ------------------------------------------------------------

prueba(
    "37. ix_auditoria_entidad_fecha es correcto y no único",

    function () {

        const indice =
            db.auditoria_actividades
                .getIndexes()
                .find(

                    function (item) {

                        return (
                            item.name ===
                            "ix_auditoria_entidad_fecha"
                        );
                    }
                );


        assertTrue(

            indice !== undefined,

            "No existe ix_auditoria_entidad_fecha."
        );


        assertTrue(

            indice.unique !== true,

            "ix_auditoria_entidad_fecha no debe ser UNIQUE."
        );


        assertTrue(

            indice.key.entidad === 1 &&
            indice.key.entidad_id === 1 &&
            indice.key.fecha_actividad === -1,

            "La definición de ix_auditoria_entidad_fecha " +
            "es incorrecta."
        );
    }
);


// ============================================================
// 18. MIGRACIÓN Y VALIDACIÓN
// ============================================================


// ------------------------------------------------------------
// PRUEBA 38
// ------------------------------------------------------------

prueba(
    "38. Migración 015 está registrada exactamente una vez",

    function () {

        const cantidad =
            db.schema_migrations
                .countDocuments({

                    version:
                        "015_create_auditoria_actividades"
                });


        assertTrue(

            cantidad === 1,

            "La migración 015 no está registrada " +
            "exactamente una vez."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 39
// ------------------------------------------------------------

prueba(
    "39. auditoria_actividades utiliza strict/error",

    function () {

        const info =
            db.getCollectionInfos({

                name:
                    "auditoria_actividades"
            })[0];


        assertTrue(

            info !== undefined,

            "No fue posible consultar auditoria_actividades."
        );


        assertTrue(

            info.options.validationLevel ===
            "strict",

            "validationLevel debe ser strict."
        );


        assertTrue(

            info.options.validationAction ===
            "error",

            "validationAction debe ser error."
        );
    }
);


// ------------------------------------------------------------
// PRUEBA 40
// ------------------------------------------------------------

prueba(
    "40. auditoria_actividades tiene $jsonSchema configurado",

    function () {

        const info =
            db.getCollectionInfos({

                name:
                    "auditoria_actividades"
            })[0];


        assertTrue(

            info !== undefined,

            "No fue posible consultar auditoria_actividades."
        );


        assertTrue(

            info.options.validator !== undefined &&
            info.options.validator.$jsonSchema !== undefined,

            "No existe $jsonSchema en auditoria_actividades."
        );
    }
);


// ============================================================
// 19. REFERENCIA CONTEXTUAL entidad_id
// ============================================================


// ------------------------------------------------------------
// PRUEBA 41
// ------------------------------------------------------------

prueba(
    "41. entidad_id no exige foreign key dinámica",

    function () {

        const documento =
            documentoValido(
                "ENTIDAD_ID_ABIERTO"
            );


        documento.entidad =
            "entidad_futura";


        documento.entidad_id =
            new ObjectId();


        const resultado =
            db.auditoria_actividades.insertOne(
                documento
            );


        assertTrue(

            resultado.acknowledged === true,

            "entidad_id debería admitir una referencia " +
            "contextual sin catálogo cerrado."
        );
    }
);


// ============================================================
// 20. CAMPOS FORENSES NO INCORPORADOS
// ============================================================


// ------------------------------------------------------------
// PRUEBA 42
// ------------------------------------------------------------

prueba(
    "42. Rechaza campos forenses no definidos en el contrato",

    function () {

        const documento =
            documentoValido(
                "CAMPO_FORENSE"
            );


        documento.ip =
            "127.0.0.1";


        esperarErrorValidacion(

            function () {

                db.auditoria_actividades.insertOne(
                    documento
                );
            }
        );
    }
);


// ============================================================
// 21. LIMPIEZA FINAL
// ============================================================

const resultadoLimpieza =
    db.auditoria_actividades.deleteMany({

        accion: {

            $regex:
                "^" + MARCADOR
        }
    });


print("");
print(
    "✓ Limpieza final completada. " +
    "Documentos eliminados: " +
    resultadoLimpieza.deletedCount
);


// ============================================================
// 22. RESULTADO
// ============================================================

print("");
print("====================================================");
print(" RESULTADO PRUEBAS DBA - auditoria_actividades");
print("====================================================");

print(
    "Pruebas exitosas: " +
    pruebasExitosas
);

print(
    "Pruebas fallidas: " +
    pruebasFallidas
);

print("");


if (
    pruebasFallidas > 0
) {

    throw new Error(
        "La suite DBA de auditoria_actividades " +
        "presentó pruebas fallidas."
    );
}


assertTrue(

    pruebasExitosas === 42,

    "Se esperaban exactamente 42 pruebas exitosas."
);


print(
    "✓ RESULTADO FINAL: 42/42"
);

print("");