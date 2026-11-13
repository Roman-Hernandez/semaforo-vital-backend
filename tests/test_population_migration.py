import shutil
import subprocess
from pathlib import Path

import pytest


def test_population_migration_preserves_original_collections_and_is_repeatable():
    node = shutil.which("node")
    if not node:
        pytest.skip("Node.js requerido para verificar la migración JavaScript")
    migration = Path("database/mongodb/migrations/010_create_historial_poblacion.js")
    assert not migration.with_name("010_allow_population_only_daily_records.js").exists()
    script = r'''
const assert = require('node:assert/strict');
const fs = require('node:fs');
const original = {
    albergue_id: 'shelter', fecha: 'day', poblacion: 12,
    registrado_por: 'user', created_at: 'created', updated_by: 'editor',
    litros_agua: 100, letrinas: 4, casos_eda: 2, casos_ira: 1
};
const originalCopy = JSON.stringify(original);
let definition;
let creates = 0;
let indexCalls = 0;
let versionWrites = 0;
const history = new Map();
const database = {
    getSiblingDB: name => {assert.equal(name, 'semaforo_vital'); return database;},
    getCollectionNames: () => definition ? ['historial_poblacion'] : [],
    createCollection: (name, options) => {
        assert.equal(name, 'historial_poblacion');
        definition = options;
        creates++;
    },
    registros_diarios: {find: query => {
        assert.deepEqual(query, {});
        return {forEach: callback => callback(original)};
    }},
    historial_poblacion: {
        createIndex: (keys, options) => {
            assert.deepEqual(keys, {albergue_id: 1, fecha: -1});
            assert.equal(options.unique, true);
            indexCalls++;
        },
        updateOne: (query, update, options) => {
            assert.deepEqual(query, {albergue_id: 'shelter', fecha: 'day'});
            assert.equal(options.upsert, true);
            assert.deepEqual(Object.keys(update), ['$setOnInsert']);
            assert.equal(update.$setOnInsert.litros_agua, undefined);
            const key = query.albergue_id + query.fecha;
            if (!history.has(key)) history.set(key, update.$setOnInsert);
        }
    },
    schema_migrations: {updateOne: (query, update, options) => {
        assert.equal(query.version, '010_create_historial_poblacion');
        assert.equal(options.upsert, true);
        versionWrites++;
    }}
};
const code = fs.readFileSync(process.argv[1], 'utf8');
// Each execution has its own shell lexical context, like the migration runner.
function run() {new Function('db', code)(database);}
run();
assert.equal(definition.validationAction, 'error');
assert.equal(definition.validator.$jsonSchema.additionalProperties, false);
assert.equal(definition.validator.$jsonSchema.properties.poblacion.minimum, 0);
assert.equal(definition.validator.$jsonSchema.properties.poblacion.bsonType, 'int');
assert.deepEqual(definition.validator.$jsonSchema.required,
    ['albergue_id', 'fecha', 'poblacion', 'registrado_por', 'created_at']);
const row = history.get('shelterday');
assert.equal(row.registrado_por, 'user');
assert.equal(row.updated_by, 'editor');
assert.equal(row.poblacion, 12);
row.poblacion = 20;
run();
assert.equal(history.get('shelterday').poblacion, 20);
assert.equal(history.size, 1);
assert.equal(creates, 1);
assert.equal(indexCalls, 2);
assert.equal(versionWrites, 2);
assert.equal(JSON.stringify(original), originalCopy);
'''
    subprocess.run([node, "-e", script, str(migration)], check=True, capture_output=True, text=True)
