// US-12: Authentication users. Safe to rerun (create or collMod + idempotent indexes).
db = db.getSiblingDB("semaforo_vital");

const validatorUsuarios = {
  $jsonSchema: {
    bsonType: "object",
    additionalProperties: false,
    required: ["email", "password_hash", "role", "active", "created_at", "updated_at"],
    properties: {
      _id: { bsonType: "objectId" },
      email: { bsonType: "string", minLength: 3, maxLength: 254, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
      password_hash: { bsonType: "string", minLength: 20 },
      role: { enum: ["administrador_albergue", "super_administrador"] },
      active: { bsonType: "bool" },
      nombre: { bsonType: "string", minLength: 1 },
      apellido: { bsonType: "string", minLength: 1 },
      albergue_id: { bsonType: ["objectId", "null"] },
      created_at: { bsonType: "date" },
      updated_at: { bsonType: "date" },
      last_login_at: { bsonType: ["date", "null"] }
    }
  }
};

if (!db.getCollectionNames().includes("usuarios")) {
  db.createCollection("usuarios", {
    validator: validatorUsuarios,
    validationLevel: "strict",
    validationAction: "error"
  });
} else {
  const result = db.runCommand({
    collMod: "usuarios",
    validator: validatorUsuarios,
    validationLevel: "strict",
    validationAction: "error"
  });
  if (result.ok !== 1) throw new Error("No fue posible actualizar usuarios");
}

// All inserts must normalize email to lowercase before writing.
db.usuarios.createIndex({ email: 1 }, {
  unique: true,
  name: "ux_usuarios_email"
});
db.usuarios.createIndex({ albergue_id: 1 }, {
  name: "ix_usuarios_albergue_id"
});

// Registrar migración de forma idempotente sin framework complejo
db.schema_migrations.updateOne(
  { version: "002_create_usuarios" },
  {
    $setOnInsert: {
      version: "002_create_usuarios",
      description: "Crear colección usuarios, validadores e índices para autenticación",
      executed_at: new Date()
    }
  },
  { upsert: true }
);

print("US-12 usuarios: validador, índices y registro de migración listos.");
