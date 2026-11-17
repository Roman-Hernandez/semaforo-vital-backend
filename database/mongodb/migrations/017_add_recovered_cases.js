// Conserva los datos existentes. La ausencia de recuperados significa dato desconocido, nunca cero.
db = db.getSiblingDB("semaforo_vital");
const version = "017_add_recovered_cases";
const info = db.getCollectionInfos({ name: "casos_enfermedades" })[0];
if (!info?.options?.validator?.$jsonSchema) throw new Error("Falta el validador de casos_enfermedades");
const validator = info.options.validator;
validator.$jsonSchema.properties.cantidad_recuperados = { bsonType: "int", minimum: 0 };
const result = db.runCommand({ collMod: "casos_enfermedades", validator, validationLevel: "strict", validationAction: "error" });
if (result.ok !== 1) throw new Error("No fue posible extender el validador de enfermedades");
db.schema_migrations.updateOne({ version }, {
  $setOnInsert: { version, description: "Recuperados observados para estimación automática SIR", executed_at: new Date() }
}, { upsert: true });
