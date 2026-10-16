// ============================================================
// SEMÁFORO VITAL
// FIX US-08 - Normalización de fecha a America/Bogota
//
// Objetivo:
//   Corregir los campos "fecha" creados bajo la convención
//   anterior de medianoche UTC.
//
// Regla nueva:
//   00:00 Colombia (America/Bogota)
//   se almacena como el instante BSON Date equivalente.
//
// Ejemplo:
//   2026-10-14 00:00 Colombia
//   = 2026-10-14T05:00:00.000Z
//
// IMPORTANTE:
//   created_at NO se modifica.
// ============================================================

db = db.getSiblingDB("semaforo_vital");

const TIMEZONE = "America/Bogota";

print("");
print("==============================================");
print(" SEMÁFORO VITAL - MIGRACIÓN ZONA HORARIA");
print("==============================================");
print("Base de datos: " + db.getName());
print("Zona funcional: " + TIMEZONE);
print("");


// ============================================================
// 1. VALIDACIONES PREVIAS
// ============================================================

const coleccionesRequeridas = [
    "albergues",
    "registros_diarios"
];

const coleccionesExistentes = db.getCollectionNames();

coleccionesRequeridas.forEach(function (coleccion) {

    if (!coleccionesExistentes.includes(coleccion)) {
        throw new Error(
            "No existe la colección requerida: " + coleccion
        );
    }
});

print("✓ Colecciones requeridas encontradas.");


// ============================================================
// 2. COMPROBAR POSIBLES DUPLICADOS ANTES DE MIGRAR
// ============================================================

const duplicados = db.registros_diarios.aggregate([
    {
        $group: {
            _id: {
                albergue_id: "$albergue_id",

                fecha_nominal: {
                    $dateToString: {
                        date: "$fecha",
                        format: "%Y-%m-%d",
                        timezone: "UTC"
                    }
                }
            },

            cantidad: {
                $sum: 1
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


if (duplicados.length > 0) {

    printjson(duplicados);

    throw new Error(
        "Existen registros diarios potencialmente duplicados. " +
        "Migración cancelada."
    );
}

print("✓ No se detectaron conflictos de fecha por albergue.");


// ============================================================
// 3. MIGRAR FECHA EN ALBERGUES
// ============================================================
//
// Se conserva el año, mes y día nominal existente,
// pero se reconstruye como 00:00 en America/Bogota.
//
// Ejemplo:
//
// antes:
// 2026-10-14T00:00:00Z
//
// después:
// 2026-10-14T05:00:00Z
//
// equivalente local:
// 2026-10-14 00:00 America/Bogota
//

const resultadoAlbergues = db.albergues.updateMany(
    {
        fecha: {
            $type: "date"
        }
    },
    [
        {
            $set: {
                fecha: {
                    $dateFromParts: {

                        year: {
                            $year: "$fecha"
                        },

                        month: {
                            $month: "$fecha"
                        },

                        day: {
                            $dayOfMonth: "$fecha"
                        },

                        hour: 0,
                        minute: 0,
                        second: 0,
                        millisecond: 0,

                        timezone: TIMEZONE
                    }
                }
            }
        }
    ]
);

print("");
print("Albergues:");
print(
    "  documentos encontrados: " +
    resultadoAlbergues.matchedCount
);
print(
    "  documentos modificados: " +
    resultadoAlbergues.modifiedCount
);


// ============================================================
// 4. MIGRAR FECHA EN REGISTROS DIARIOS
// ============================================================

const resultadoRegistros = db.registros_diarios.updateMany(
    {
        fecha: {
            $type: "date"
        }
    },
    [
        {
            $set: {
                fecha: {
                    $dateFromParts: {

                        year: {
                            $year: "$fecha"
                        },

                        month: {
                            $month: "$fecha"
                        },

                        day: {
                            $dayOfMonth: "$fecha"
                        },

                        hour: 0,
                        minute: 0,
                        second: 0,
                        millisecond: 0,

                        timezone: TIMEZONE
                    }
                }
            }
        }
    ]
);

print("");
print("Registros diarios:");
print(
    "  documentos encontrados: " +
    resultadoRegistros.matchedCount
);
print(
    "  documentos modificados: " +
    resultadoRegistros.modifiedCount
);


// ============================================================
// 5. VERIFICACIÓN
// ============================================================

print("");
print("Verificación de albergues:");

db.albergues.aggregate([
    {
        $project: {

            codigo_albergue: 1,

            fecha_bson: "$fecha",

            fecha_colombia: {
                $dateToString: {
                    date: "$fecha",
                    timezone: TIMEZONE,
                    format: "%Y-%m-%d %H:%M:%S"
                }
            },

            created_at_bson: "$created_at",

            created_at_colombia: {
                $dateToString: {
                    date: "$created_at",
                    timezone: TIMEZONE,
                    format: "%Y-%m-%d %H:%M:%S"
                }
            }
        }
    }
]).forEach(printjson);


print("");
print("Verificación de registros_diarios:");

db.registros_diarios.aggregate([
    {
        $project: {

            albergue_id: 1,

            fecha_bson: "$fecha",

            fecha_colombia: {
                $dateToString: {
                    date: "$fecha",
                    timezone: TIMEZONE,
                    format: "%Y-%m-%d %H:%M:%S"
                }
            },

            created_at_bson: "$created_at",

            created_at_colombia: {
                $dateToString: {
                    date: "$created_at",
                    timezone: TIMEZONE,
                    format: "%Y-%m-%d %H:%M:%S"
                }
            }
        }
    }
]).forEach(printjson);


print("");
print("✓ Migración de zona horaria finalizada.");
print("✓ created_at no fue modificado.");