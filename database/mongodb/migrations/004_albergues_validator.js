// Migración 004: alinea el validador de 'albergues' con lo que escribe la API.
// Debe ejecutarse con un usuario con privilegio collMod (p. ej. dbAdmin / atlasAdmin).
// mongosh "<URI_ADMIN>/semaforo_vital" --file 004_albergues_validator.js
const NUM = ["double", "int", "long", "decimal"];

const validator = {
  $jsonSchema: {
    bsonType: "object",
    additionalProperties: false,
    required: ["codigo_albergue", "nombre", "ubicacion", "capacidad_instalada",
               "activo", "registrado_por", "created_at"],
    properties: {
      _id: { bsonType: "objectId" },
      codigo_albergue: { bsonType: "string", minLength: 1 },
      nombre: { bsonType: "string", minLength: 1 },
      ubicacion: {
        bsonType: "object",
        additionalProperties: false,
        required: ["departamento", "municipio", "coordenadas"],
        properties: {
          departamento: { bsonType: "string", minLength: 1 },
          municipio: { bsonType: "string", minLength: 1 },
          direccion: { bsonType: ["string", "null"] },
          coordenadas: {
            bsonType: "object",
            additionalProperties: false,
            required: ["type", "coordinates"],
            properties: {
              type: { bsonType: "string", enum: ["Point"] },
              coordinates: {
                bsonType: "array", minItems: 2, maxItems: 2,
                items: [
                  { bsonType: NUM, minimum: -180, maximum: 180 },
                  { bsonType: NUM, minimum: -90, maximum: 90 }
                ]
              }
            }
          }
        }
      },
      capacidad_instalada: { bsonType: "int", minimum: 1 },
      activo: { bsonType: "bool" },
      registrado_por: { bsonType: "objectId" },
      fecha: { bsonType: "date" },
      created_at: { bsonType: "date" },
      updated_at: { bsonType: "date" },
      desactivado_en: { bsonType: "date" }
    }
  }
};

const r = db.runCommand({
  collMod: "albergues",
  validator: validator,
  validationLevel: "strict",
  validationAction: "error"
});
if (r.ok !== 1) throw new Error("collMod falló: " + JSON.stringify(r));

db.schema_migrations.updateOne(
  { version: "004_albergues_validator" },
  {
    $setOnInsert: {
      version: "004_albergues_validator",
      description: "Validador de albergues: fecha y direccion opcionales; permite updated_at y desactivado_en",
      executed_at: new Date()
    }
  },
  { upsert: true }
);
print("✓ Validador de albergues actualizado.");
