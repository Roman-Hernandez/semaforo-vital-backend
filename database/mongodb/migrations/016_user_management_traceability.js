// Extiende el validador existente; conserva las reglas y los registros previos.
db = db.getSiblingDB("semaforo_vital");
const version = "016_user_management_traceability";
const info = db.getCollectionInfos({ name: "usuarios" })[0];
if (!info?.options?.validator?.$jsonSchema) throw new Error("Falta el validador de usuarios");
const validator = info.options.validator;
validator.$jsonSchema.properties.registrado_por = { bsonType: "objectId" };
validator.$jsonSchema.properties.updated_by = { bsonType: "objectId" };
const result = db.runCommand({ collMod: "usuarios", validator, validationLevel: "strict", validationAction: "error" });
if (result.ok !== 1) throw new Error("No fue posible extender el validador de usuarios");
db.schema_migrations.updateOne({ version }, {
  $setOnInsert: { version, description: "Trazabilidad de gestión de administradores", executed_at: new Date() }
}, { upsert: true });
