"""Script sencillo para ejecutar migraciones MongoDB sin mongosh."""

from datetime import datetime, timezone

from pymongo import MongoClient
from pymongo.database import Database

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
        if "002_create_usuarios" in aplicadas:
            print("✓ Migración 002_create_usuarios ya aplicada previamente. Nada pendiente.")
            return

        print("Ejecutando migración 002_create_usuarios...")
        migrate_002_create_usuarios(db)
        print("\nTodas las migraciones se aplicaron con éxito.")
    finally:
        client.close()


if __name__ == "__main__":
    run_migrations()

