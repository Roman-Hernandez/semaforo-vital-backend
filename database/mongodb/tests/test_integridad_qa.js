// ============================================================
// SEMÁFORO VITAL
// US-08 - QA: Pruebas de integridad del modelo MongoDB
//
// Valida:
//   - esquema de usuarios
//   - normalización de email
//   - password_hash Argon2id
//   - roles permitidos
//   - relación role → albergue_id
//   - email único
//   - codigo_albergue único
//   - albergue_id + fecha único
//   - tipos de trazabilidad
//   - detección de referencias inexistentes
//
// IMPORTANTE:
// MongoDB $jsonSchema NO aplica claves foráneas.
//
// Por esta razón, las pruebas de referencias inexistentes
// demuestran que:
//
// 1. el documento puede ser estructuralmente válido;
// 2. un control de integridad mediante $lookup detecta
//    la referencia huérfana.
//
// Estas relaciones también deberán ser verificadas por la
// capa de aplicación antes de persistir información.
//
// Base de datos:
//   semaforo_vital
// ============================================================

db = db.getSiblingDB("semaforo_vital");

print("");
print("====================================================");
print(" SEMÁFORO VITAL - PRUEBAS QA DE INTEGRIDAD");
print("====================================================");
print("Base de datos: " + db.getName());
print("");

let pruebasExitosas = 0;
let pruebasFallidas = 0;


// ============================================================
// 1. IDENTIFICADORES TEMPORALES
// ============================================================

const USUARIO_TEST_ID =
    ObjectId("dddddddddddddddddddddddd");

const ALBERGUE_REF_USUARIO_ID =
    ObjectId("111111111111111111111111");

const ALBERGUE_INEXISTENTE_ID =
    ObjectId("222222222222222222222222");

const REGISTRO_REF_ALBERGUE_ID =
    ObjectId("333333333333333333333333");


// ============================================================
// 2. FUNCIONES AUXILIARES
// ============================================================

function pruebaDebeFallar(
    nombre,
    operacion,
    codigoEsperado
) {

    try {

        operacion();

        print(
            "✗ FALLÓ: " +
            nombre +
            " - la operación fue aceptada."
        );

        pruebasFallidas++;

    } catch (e) {

        if (e.code === codigoEsperado) {

            print(
                "✓ OK: " +
                nombre +
                " - código " +
                e.code
            );

            pruebasExitosas++;

        } else {

            print(
                "✗ FALLÓ: " +
                nombre +
                " - código recibido: " +
                e.code +
                ", esperado: " +
                codigoEsperado
            );

            print(
                "  Mensaje: " +
                e.message
            );

            pruebasFallidas++;
        }
    }
}


function pruebaDebeCumplir(
    nombre,
    operacion
) {

    try {

        const resultado =
            operacion();

        if (
            resultado === false
        ) {

            throw new Error(
                "La condición evaluada retornó false."
            );
        }

        print(
            "✓ OK: " +
            nombre
        );

        pruebasExitosas++;

    } catch (e) {

        print(
            "✗ FALLÓ: " +
            nombre +
            " - " +
            e.message
        );

        pruebasFallidas++;
    }
}


// ============================================================
// 3. LIMPIEZA
// ============================================================

function limpiarDatosTemporales() {

    db.usuarios.deleteMany({
        email: {
            $regex:
                "^qa-us08-"
        }
    });


    db.albergues.deleteMany({
        $or: [
            {
                _id:
                    ALBERGUE_REF_USUARIO_ID
            },

            {
                codigo_albergue: {
                    $regex:
                        "^QA-US08-"
                }
            }
        ]
    });


    db.registros_diarios.deleteMany({
        _id:
            REGISTRO_REF_ALBERGUE_ID
    });
}


// ============================================================
// 4. PREPARACIÓN
// ============================================================

limpiarDatosTemporales();


const usuarioReal =
    db.usuarios.findOne({
        role:
            "super_administrador",

        active:
            true
    });


if (
    !usuarioReal
) {

    throw new Error(
        "No existe un super_administrador activo para ejecutar las pruebas."
    );
}


const albergueReal =
    db.albergues.findOne({
        codigo_albergue:
            "SIM-PER-001"
    });


if (
    !albergueReal
) {

    throw new Error(
        "No existe el albergue SIM-PER-001 requerido para las pruebas."
    );
}


const registroReal =
    db.registros_diarios.findOne({
        albergue_id:
            albergueReal._id
    });


if (
    !registroReal
) {

    throw new Error(
        "No existe registro diario para SIM-PER-001."
    );
}


print(
    "✓ Datos base disponibles para pruebas."
);


// ============================================================
// 5. EJECUCIÓN DE PRUEBAS
// ============================================================

try {

    // ========================================================
    // PRUEBA 1
    // administrador_albergue válido
    // ========================================================

    pruebaDebeCumplir(
        "usuario administrador_albergue válido",

        function () {

            db.usuarios.insertOne({
                _id:
                    USUARIO_TEST_ID,

                email:
                    "qa-us08-admin@semaforovital.com",

                password_hash:
                    "$argon2id$v=19$m=65536,t=3,p=4$cWE$dGVzdF9oYXNoX3VzMDg",

                role:
                    "administrador_albergue",

                active:
                    true,

                nombre:
                    "Usuario QA",

                apellido:
                    "Integridad",

                albergue_id:
                    albergueReal._id,

                created_at:
                    new Date(),

                updated_at:
                    new Date(),

                last_login_at:
                    null
            });

            return true;
        }
    );


    // ========================================================
    // PRUEBA 2
    // email duplicado
    // ========================================================

    pruebaDebeFallar(
        "email duplicado",

        function () {

            db.usuarios.insertOne({

                email:
                    "qa-us08-admin@semaforovital.com",

                password_hash:
                    "$argon2id$v=19$m=65536,t=3,p=4$cWI$dGVzdF9kdXBsaWNhZG8",

                role:
                    "administrador_albergue",

                active:
                    true,

                nombre:
                    "Duplicado",

                apellido:
                    "QA",

                albergue_id:
                    albergueReal._id,

                created_at:
                    new Date(),

                updated_at:
                    new Date(),

                last_login_at:
                    null
            });
        },

        11000
    );


    // ========================================================
    // PRUEBA 3
    // email con mayúsculas
    // ========================================================

    pruebaDebeFallar(
        "email no normalizado",

        function () {

            db.usuarios.insertOne({

                email:
                    "QA-US08-uppercase@semaforovital.com",

                password_hash:
                    "$argon2id$v=19$m=65536,t=3,p=4$cWM$dGVzdF9lbWFpbA",

                role:
                    "super_administrador",

                active:
                    true,

                nombre:
                    "Email QA",

                albergue_id:
                    null,

                created_at:
                    new Date(),

                updated_at:
                    new Date(),

                last_login_at:
                    null
            });
        },

        121
    );


    // ========================================================
    // PRUEBA 4
    // password_hash que no es Argon2id
    // ========================================================

    pruebaDebeFallar(
        "password_hash sin formato Argon2id",

        function () {

            db.usuarios.insertOne({

                email:
                    "qa-us08-password@semaforovital.com",

                password_hash:
                    "password_en_texto_plano_123456",

                role:
                    "super_administrador",

                active:
                    true,

                nombre:
                    "Password QA",

                albergue_id:
                    null,

                created_at:
                    new Date(),

                updated_at:
                    new Date(),

                last_login_at:
                    null
            });
        },

        121
    );


    // ========================================================
    // PRUEBA 5
    // rol inválido
    // ========================================================

    pruebaDebeFallar(
        "rol de usuario inválido",

        function () {

            db.usuarios.insertOne({

                email:
                    "qa-us08-role@semaforovital.com",

                password_hash:
                    "$argon2id$v=19$m=65536,t=3,p=4$cWQ$dGVzdF9yb2xl",

                role:
                    "usuario_invalido",

                active:
                    true,

                nombre:
                    "Role QA",

                albergue_id:
                    null,

                created_at:
                    new Date(),

                updated_at:
                    new Date(),

                last_login_at:
                    null
            });
        },

        121
    );


    // ========================================================
    // PRUEBA 6
    // administrador_albergue sin albergue_id
    // ========================================================

    pruebaDebeFallar(
        "administrador_albergue sin albergue_id",

        function () {

            db.usuarios.insertOne({

                email:
                    "qa-us08-no-shelter@semaforovital.com",

                password_hash:
                    "$argon2id$v=19$m=65536,t=3,p=4$cWU$dGVzdF9zaGVsdGVy",

                role:
                    "administrador_albergue",

                active:
                    true,

                nombre:
                    "Shelter QA",

                created_at:
                    new Date(),

                updated_at:
                    new Date(),

                last_login_at:
                    null
            });
        },

        121
    );


    // ========================================================
    // PRUEBA 7
    // super_administrador asociado a un albergue
    // ========================================================

    pruebaDebeFallar(
        "super_administrador con albergue_id",

        function () {

            db.usuarios.insertOne({

                email:
                    "qa-us08-super-shelter@semaforovital.com",

                password_hash:
                    "$argon2id$v=19$m=65536,t=3,p=4$cWY$dGVzdF9zdXBlcg",

                role:
                    "super_administrador",

                active:
                    true,

                nombre:
                    "Super QA",

                albergue_id:
                    albergueReal._id,

                created_at:
                    new Date(),

                updated_at:
                    new Date(),

                last_login_at:
                    null
            });
        },

        121
    );


    // ========================================================
    // PRUEBA 8
    // codigo_albergue duplicado
    // ========================================================

    pruebaDebeFallar(
        "codigo_albergue duplicado",

        function () {

            db.albergues.insertOne({

                codigo_albergue:
                    albergueReal.codigo_albergue,

                nombre:
                    "Albergue QA Duplicado",

                ubicacion: {

                    departamento:
                        "Risaralda",

                    municipio:
                        "Pereira",

                    direccion:
                        "Ubicación temporal QA",

                    coordenadas: {

                        type:
                            "Point",

                        coordinates: [
                            -75.6900,
                            4.8100
                        ]
                    }
                },

                capacidad_instalada:
                    NumberInt(10),

                activo:
                    true,

                registrado_por:
                    usuarioReal._id,

                fecha:
                    ISODate(
                        "2099-01-01T05:00:00.000Z"
                    ),

                created_at:
                    new Date()
            });
        },

        11000
    );


    // ========================================================
    // PRUEBA 9
    // registro duplicado albergue_id + fecha
    // ========================================================

    pruebaDebeFallar(
        "registro diario duplicado albergue_id + fecha",

        function () {

            db.registros_diarios.insertOne({

                albergue_id:
                    registroReal.albergue_id,

                fecha:
                    registroReal.fecha,

                poblacion:
                    NumberInt(1),

                litros_agua:
                    20.0,

                letrinas:
                    NumberInt(1),

                casos_eda:
                    NumberInt(0),

                casos_ira:
                    NumberInt(0),

                registrado_por:
                    usuarioReal._id,

                created_at:
                    new Date()
            });
        },

        11000
    );


    // ========================================================
    // PRUEBA 10
    // tipo inválido de updated_by
    // ========================================================

    pruebaDebeFallar(
        "updated_by con tipo inválido",

        function () {

            db.albergues.insertOne({

                codigo_albergue:
                    "QA-US08-UPDATED-BY",

                nombre:
                    "Albergue QA Trazabilidad",

                ubicacion: {

                    departamento:
                        "Risaralda",

                    municipio:
                        "Pereira",

                    direccion:
                        "Ubicación temporal QA",

                    coordenadas: {

                        type:
                            "Point",

                        coordinates: [
                            -75.6900,
                            4.8100
                        ]
                    }
                },

                capacidad_instalada:
                    NumberInt(10),

                activo:
                    true,

                registrado_por:
                    usuarioReal._id,

                fecha:
                    ISODate(
                        "2099-01-03T05:00:00.000Z"
                    ),

                created_at:
                    new Date(),

                updated_at:
                    new Date(),

                updated_by:
                    "usuario-invalido"
            });
        },

        121
    );


    // ========================================================
    // PRUEBA 11
    // registrado_por inexistente
    //
    // MongoDB permite el ObjectId porque no existen FK.
    // La auditoría DBA debe detectarlo.
    // ========================================================

    pruebaDebeCumplir(
        "detección de albergue con registrado_por inexistente",

        function () {

            const usuarioInexistente =
                ObjectId(
                    "eeeeeeeeeeeeeeeeeeeeeeee"
                );


            db.albergues.insertOne({

                _id:
                    ALBERGUE_REF_USUARIO_ID,

                codigo_albergue:
                    "QA-US08-REF-USUARIO",

                nombre:
                    "Albergue QA Referencia Usuario",

                ubicacion: {

                    departamento:
                        "Risaralda",

                    municipio:
                        "Pereira",

                    direccion:
                        "Ubicación temporal QA",

                    coordenadas: {

                        type:
                            "Point",

                        coordinates: [
                            -75.6900,
                            4.8100
                        ]
                    }
                },

                capacidad_instalada:
                    NumberInt(10),

                activo:
                    true,

                registrado_por:
                    usuarioInexistente,

                fecha:
                    ISODate(
                        "2099-01-04T05:00:00.000Z"
                    ),

                created_at:
                    new Date()
            });


            const referenciasHuerfanas =
                db.albergues.aggregate([
                    {
                        $match: {
                            _id:
                                ALBERGUE_REF_USUARIO_ID
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
                    }
                ]).toArray();


            if (
                referenciasHuerfanas.length !== 1
            ) {

                throw new Error(
                    "El control DBA no detectó la referencia huérfana de registrado_por."
                );
            }


            db.albergues.deleteOne({
                _id:
                    ALBERGUE_REF_USUARIO_ID
            });


            return true;
        }
    );


    // ========================================================
    // PRUEBA 12
    // albergue_id inexistente en registros_diarios
    //
    // Nuevamente MongoDB permite el ObjectId.
    // El control de integridad debe detectarlo.
    // ========================================================

    pruebaDebeCumplir(
        "detección de registro diario con albergue_id inexistente",

        function () {

            db.registros_diarios.insertOne({

                _id:
                    REGISTRO_REF_ALBERGUE_ID,

                albergue_id:
                    ALBERGUE_INEXISTENTE_ID,

                fecha:
                    ISODate(
                        "2099-01-05T05:00:00.000Z"
                    ),

                poblacion:
                    NumberInt(10),

                litros_agua:
                    150.0,

                letrinas:
                    NumberInt(1),

                casos_eda:
                    NumberInt(0),

                casos_ira:
                    NumberInt(0),

                registrado_por:
                    usuarioReal._id,

                created_at:
                    new Date()
            });


            const referenciasHuerfanas =
                db.registros_diarios.aggregate([
                    {
                        $match: {
                            _id:
                                REGISTRO_REF_ALBERGUE_ID
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
                    }
                ]).toArray();


            if (
                referenciasHuerfanas.length !== 1
            ) {

                throw new Error(
                    "El control DBA no detectó el albergue_id inexistente."
                );
            }


            db.registros_diarios.deleteOne({
                _id:
                    REGISTRO_REF_ALBERGUE_ID
            });


            return true;
        }
    );

} finally {

    // ========================================================
    // LIMPIEZA FINAL GARANTIZADA
    // ========================================================

    limpiarDatosTemporales();
}


// ============================================================
// 6. VERIFICAR LIMPIEZA
// ============================================================

const usuariosTemporales =
    db.usuarios.countDocuments({
        email: {
            $regex:
                "^qa-us08-"
        }
    });


const alberguesTemporales =
    db.albergues.countDocuments({
        codigo_albergue: {
            $regex:
                "^QA-US08-"
        }
    });


const registrosTemporales =
    db.registros_diarios.countDocuments({
        _id:
            REGISTRO_REF_ALBERGUE_ID
    });


if (
    usuariosTemporales !== 0 ||
    alberguesTemporales !== 0 ||
    registrosTemporales !== 0
) {

    print(
        "✗ FALLÓ: quedaron documentos temporales después de las pruebas."
    );

    pruebasFallidas++;

} else {

    print(
        "✓ OK: limpieza de documentos temporales"
    );
}


// ============================================================
// 7. RESULTADO FINAL
// ============================================================

print("");
print("====================================================");
print(" RESULTADO QA");
print("====================================================");

print(
    "Pruebas exitosas: " +
    pruebasExitosas
);

print(
    "Pruebas fallidas: " +
    pruebasFallidas
);

print("====================================================");


if (
    pruebasFallidas > 0
) {

    throw new Error(
        "La batería QA de integridad presentó fallos."
    );
}


print("");
print(
    "✓ TODAS LAS PRUEBAS QA FINALIZARON CORRECTAMENTE."
);