"""Seeder para crear el superadministrador inicial con Argon2id."""

import argparse
import getpass
import os
from datetime import datetime, timezone

from pwdlib import PasswordHash
from pymongo import MongoClient

from app.core.config import settings

passwords = PasswordHash.recommended()


def seed_superadmin(email: str | None = None, password: str | None = None, reset: bool = False) -> None:
    # 1. Resolver email y password (prioridad: argumentos -> .env -> prompt interactivo)
    email = email or os.getenv("INITIAL_SUPERADMIN_EMAIL")
    password = password or os.getenv("INITIAL_SUPERADMIN_PASSWORD")

    if not email:
        email = input("Email del superadministrador: ").strip()

    normalized_email = email.strip().lower()
    if not normalized_email or "@" not in normalized_email:
        raise ValueError("Email inválido.")

    if not password:
        password = getpass.getpass("Contraseña del superadministrador (mínimo 8 caracteres): ")

    if len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres.")

    if not settings.mongodb_uri:
        raise RuntimeError("MONGODB_URI no está configurada.")

    print(f"Conectando a base de datos '{settings.mongodb_db}'...")
    client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
        db = client[settings.mongodb_db]

        # 2. Generar hash Argon2id (nunca texto plano)
        password_hash = passwords.hash(password)
        now = datetime.now(timezone.utc)

        # 3. Si se solicita reset y el usuario ya existe, actualizar contraseña
        existing = db.usuarios.find_one({"email": normalized_email})
        if existing and reset:
            db.usuarios.update_one(
                {"_id": existing["_id"]},
                {"$set": {"password_hash": password_hash, "active": True, "updated_at": now}},
            )
            print(f"✓ Contraseña del superadministrador '{normalized_email}' actualizada exitosamente.")
            return

        # 4. Insertar solo si no existe ($setOnInsert para no sobrescribir)
        result = db.usuarios.update_one(
            {"email": normalized_email},
            {
                "$setOnInsert": {
                    "email": normalized_email,
                    "password_hash": password_hash,
                    "role": "super_administrador",
                    "active": True,
                    "nombre": "Super",
                    "apellido": "Admin",
                    "albergue_id": None,
                    "created_at": now,
                    "updated_at": now,
                    "last_login_at": None,
                }
            },
            upsert=True,
        )

        if result.upserted_id:
            print(f"✓ Superadministrador '{normalized_email}' creado exitosamente (ID: {result.upserted_id}).")
        else:
            print(f"ℹ El usuario '{normalized_email}' ya existe. Usa --reset para actualizar su contraseña.")
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Crear o actualizar superadministrador inicial.")
    parser.add_argument("--email", help="Email del superadministrador")
    parser.add_argument("--password", help="Contraseña del superadministrador")
    parser.add_argument("--reset", action="store_true", help="Actualizar contraseña si ya existe")
    args = parser.parse_args()
    seed_superadmin(email=args.email, password=args.password, reset=args.reset)


if __name__ == "__main__":
    main()

