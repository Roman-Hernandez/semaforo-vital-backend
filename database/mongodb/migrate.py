"""Script sencillo para ejecutar migraciones MongoDB sin mongosh."""

from datetime import datetime, timezone

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import OperationFailure

from app.core.config import settings

VALIDATOR_USUARIOS = {
    "$jsonSchema": {
        "bsonType": "object",
        "additionalProperties": False,
        "required": ["email", "password_hash", "role", "active", "created_at", "updated_at"],
        "properties": {
            "_id": {"bsonType": "objectId"},
            "email": {
                "bsonType": "string",
                "minLength": 3,
                "maxLength": 254,
                "pattern": r"^[^\s@]+@[^\s@]+\.[^\s@]+$",
            },
            "password_hash": {"bsonType": "string", "minLength": 20},
            "role": {"enum": ["administrador_albergue", "super_administrador"]},
            "active": {"bsonType": "bool"},
            "nombre": {"bsonType": "string", "minLength": 1},
            "apellido": {"bsonType": "string", "minLength": 1},
            "albergue_id": {"bsonType": ["objectId", "null"]},
            "created_at": {"bsonType": "date"},
            "updated_at": {"bsonType": "date"},
            "last_login_at": {"bsonType": ["date", "null"]},
        },
    }
}


def migrate_002_create_usuarios(db: Database) -> None:
    if "usuarios" not in db.list_collection_names():
        db.create_collection(
            "usuarios",
            validator=VALIDATOR_USUARIOS,
            validationLevel="strict",
            validationAction="error",
        )
        print("  ✓ Colección 'usuarios' creada con validador strict.")
    else:
        try:
            db.command({
                "collMod": "usuarios",
                "validator": VALIDATOR_USUARIOS,
                "validationLevel": "strict",
                "validationAction": "error",
            })
            print("  ✓ Validador de colección 'usuarios' actualizado (collMod).")
        except Exception as exc:
            if "collMod" in str(exc):
                print("  ℹ Colección 'usuarios' ya existe (usuario sin privilegio collMod, validador actual conservado).")
            else:
                raise

    db.usuarios.create_index("email", unique=True, name="ux_usuarios_email")
    db.usuarios.create_index("albergue_id", name="ix_usuarios_albergue_id")
    print("  ✓ Índices 'ux_usuarios_email' e 'ix_usuarios_albergue_id' verificados.")

    db.schema_migrations.update_one(
        {"version": "002_create_usuarios"},
        {
            "$setOnInsert": {
                "version": "002_create_usuarios",
                "description": "Crear colección usuarios, validadores e índices",
                "executed_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    print("  ✓ Registro en 'schema_migrations' guardado.")


def migrate_003_unique_codigo_albergue(db: Database) -> None:
    db.albergues.create_index(
        "codigo_albergue", unique=True, name="ux_albergues_codigo_albergue"
    )
    print("  ✓ Índice único 'ux_albergues_codigo_albergue' verificado.")

    db.schema_migrations.update_one(
        {"version": "003_unique_codigo_albergue"},
        {
            "$setOnInsert": {
                "version": "003_unique_codigo_albergue",
                "description": "Índice único sobre albergues.codigo_albergue",
                "executed_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    print("  ✓ Registro en 'schema_migrations' guardado.")


_NUM = ["double", "int", "long", "decimal"]

VALIDATOR_ALBERGUES = {
    "$jsonSchema": {
        "bsonType": "object",
        "additionalProperties": False,
        "required": [
            "codigo_albergue", "nombre", "ubicacion", "capacidad_instalada",
            "activo", "registrado_por", "created_at",
        ],
        "properties": {
            "_id": {"bsonType": "objectId"},
            "codigo_albergue": {"bsonType": "string", "minLength": 1},
            "nombre": {"bsonType": "string", "minLength": 1},
            "ubicacion": {
                "bsonType": "object",
                "additionalProperties": False,
                "required": ["departamento", "municipio", "coordenadas"],
                "properties": {
                    "departamento": {"bsonType": "string", "minLength": 1},
                    "municipio": {"bsonType": "string", "minLength": 1},
                    "direccion": {"bsonType": ["string", "null"]},
                    "coordenadas": {
                        "bsonType": "object",
                        "additionalProperties": False,
                        "required": ["type", "coordinates"],
                        "properties": {
                            "type": {"bsonType": "string", "enum": ["Point"]},
                            "coordinates": {
                                "bsonType": "array",
                                "minItems": 2,
                                "maxItems": 2,
                                "items": [
                                    {"bsonType": _NUM, "minimum": -180, "maximum": 180},
                                    {"bsonType": _NUM, "minimum": -90, "maximum": 90},
                                ],
                            },
                        },
                    },
                },
            },
            "capacidad_instalada": {"bsonType": "int", "minimum": 1},
            "activo": {"bsonType": "bool"},
            "registrado_por": {"bsonType": "objectId"},
            "fecha": {"bsonType": "date"},
            "created_at": {"bsonType": "date"},
            "updated_at": {"bsonType": "date"},
            "desactivado_en": {"bsonType": "date"},
        },
    }
}


def migrate_004_albergues_validator(db: Database) -> None:
    """Alinea el validador de 'albergues' con lo que escribe la API."""
    if "albergues" not in db.list_collection_names():
        db.create_collection(
            "albergues",
            validator=VALIDATOR_ALBERGUES,
            validationLevel="strict",
            validationAction="error",
        )
        print("  ✓ Colección 'albergues' creada con validador strict.")
    else:
        try:
            db.command({
                "collMod": "albergues",
                "validator": VALIDATOR_ALBERGUES,
                "validationLevel": "strict",
                "validationAction": "error",
            })
        except OperationFailure as exc:
            if exc.code == 8000:  # sin privilegio collMod
                raise RuntimeError(
                    "El usuario de MONGODB_URI no tiene privilegio collMod sobre 'albergues'. "
                    "Ejecute migrations/004_albergues_validator.js con un usuario admin, "
                    "o pegue el validador en Atlas > Collections > albergues > Validation."
                ) from exc
            raise
        print("  ✓ Validador de 'albergues' actualizado (collMod).")

    db.schema_migrations.update_one(
        {"version": "004_albergues_validator"},
        {
            "$setOnInsert": {
                "version": "004_albergues_validator",
                "description": "Validador de albergues: fecha y direccion opcionales; permite updated_at y desactivado_en",
                "executed_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    print("  ✓ Registro en 'schema_migrations' guardado.")


MIGRATIONS = [
    ("002_create_usuarios", migrate_002_create_usuarios),
    ("003_unique_codigo_albergue", migrate_003_unique_codigo_albergue),
    ("004_albergues_validator", migrate_004_albergues_validator),
]


def run_migrations() -> None:
    if not settings.mongodb_uri:
        raise RuntimeError("MONGODB_URI no está configurada en .env")

    print(f"Conectando a base de datos '{settings.mongodb_db}'...")
    client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
        db = client[settings.mongodb_db]
        print(f"✓ Conexión establecida con MongoDB Atlas ({settings.mongodb_db}).\n")

        # Verificar si la migración ya fue aplicada
        aplicadas = set(db.schema_migrations.distinct("version")) if "schema_migrations" in db.list_collection_names() else set()
        pendientes = [(v, fn) for v, fn in MIGRATIONS if v not in aplicadas]
        if not pendientes:
            print("✓ Todas las migraciones ya fueron aplicadas. Nada pendiente.")
            return

        for version, fn in pendientes:
            print(f"Ejecutando migración {version}...")
            fn(db)
        print("\nTodas las migraciones se aplicaron con éxito.")
    finally:
        client.close()


if __name__ == "__main__":
    run_migrations()

