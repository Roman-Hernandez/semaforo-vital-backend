// Migración 003: el código de albergue no puede repetirse (US albergues, RF-41).
// Idempotente. Si ya hay códigos duplicados, createIndex falla: corríjalos antes.
db.albergues.createIndex({ codigo_albergue: 1 }, {
  unique: true,
  name: "ux_albergues_codigo_albergue"
});

db.schema_migrations.updateOne(
  { version: "003_unique_codigo_albergue" },
  {
    $setOnInsert: {
      version: "003_unique_codigo_albergue",
      description: "Índice único sobre albergues.codigo_albergue",
      executed_at: new Date()
    }
  },
  { upsert: true }
);
