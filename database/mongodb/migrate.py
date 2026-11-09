"""
Ejecutor de migraciones MongoDB - Semáforo Vital.

Responsabilidad:
- detectar migraciones JavaScript pendientes;
- ejecutarlas en orden mediante mongosh;
- utilizar schema_migrations como control de versiones;
- evitar duplicar la lógica de las migraciones en Python.

Las migraciones .js son la fuente única de evolución del esquema.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings


# ============================================================
# CONFIGURACIÓN
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

MIGRATIONS_DIR = BASE_DIR / "migrations"

# La migración 001 fue ejecutada antes de existir
# schema_migrations y se conserva únicamente como histórico.
LEGACY_MIGRATIONS = {
    "001_fix_colombia_timezone"
}


# ============================================================
# UTILIDADES
# ============================================================

def verificar_mongosh() -> None:
    """
    Verifica que mongosh esté disponible en el equipo DBA.
    """

    if shutil.which("mongosh") is None:
        raise RuntimeError(
            "mongosh no está instalado o no está disponible en PATH. "
            "Instálelo antes de ejecutar las migraciones MongoDB."
        )


def obtener_migraciones_aplicadas(db: Database) -> set[str]:
    """
    Obtiene las versiones registradas en schema_migrations.
    """

    if "schema_migrations" not in db.list_collection_names():
        return set()

    return set(
        db.schema_migrations.distinct("version")
    )


def obtener_archivos_migracion() -> list[Path]:
    """
    Obtiene los archivos .js ordenados por número de migración.
    """

    if not MIGRATIONS_DIR.exists():
        raise RuntimeError(
            f"No existe el directorio de migraciones: "
            f"{MIGRATIONS_DIR}"
        )

    return sorted(
        MIGRATIONS_DIR.glob("[0-9][0-9][0-9]_*.js"),
        key=lambda path: path.name
    )


def ejecutar_migracion(
    migration_file: Path
) -> None:
    """
    Ejecuta una migración JavaScript utilizando mongosh.
    """

    print(
        f"\n→ Ejecutando {migration_file.name}"
    )

    command = [
        "mongosh",
        settings.mongodb_uri,
        "--quiet",
        "--file",
        str(migration_file),
    ]

    result = subprocess.run(
        command,
        check=False,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"La migración {migration_file.name} "
            f"finalizó con código {result.returncode}."
        )


def verificar_migracion_registrada(
    db: Database,
    version: str,
) -> None:
    """
    Verifica que la migración haya quedado registrada.
    """

    cantidad = db.schema_migrations.count_documents(
        {
            "version": version
        }
    )

    if cantidad != 1:
        raise RuntimeError(
            f"La migración {version} fue ejecutada, "
            "pero no quedó registrada exactamente una vez "
            "en schema_migrations."
        )


# ============================================================
# EJECUTOR PRINCIPAL
# ============================================================

def run_migrations() -> None:

    if not settings.mongodb_uri:
        raise RuntimeError(
            "MONGODB_URI no está configurada en .env"
        )

    if not settings.mongodb_db:
        raise RuntimeError(
            "MONGODB_DB no está configurada en .env"
        )

    verificar_mongosh()

    print(
        f"Conectando a base de datos "
        f"'{settings.mongodb_db}'..."
    )

    client = MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=5000,
    )

    try:

        client.admin.command("ping")

        db = client[
            settings.mongodb_db
        ]

        print(
            f"✓ Conexión establecida con MongoDB Atlas "
            f"({settings.mongodb_db})."
        )

        aplicadas = obtener_migraciones_aplicadas(
            db
        )

        archivos = obtener_archivos_migracion()

        print(
            f"✓ Migraciones encontradas: "
            f"{len(archivos)}"
        )

        pendientes = []

        for migration_file in archivos:

            version = migration_file.stem

            # ----------------------------------------------
            # Migraciones históricas anteriores al control
            # schema_migrations
            # ----------------------------------------------

            if version in LEGACY_MIGRATIONS:

                print(
                    f"↷ {version} "
                    "(legacy - no se reejecuta)"
                )

                continue

            # ----------------------------------------------
            # Migración ya aplicada
            # ----------------------------------------------

            if version in aplicadas:

                print(
                    f"✓ {version} "
                    "(ya aplicada)"
                )

                continue

            pendientes.append(
                migration_file
            )

        if not pendientes:

            print(
                "\n✓ No existen migraciones pendientes."
            )

            return

        print(
            f"\nMigraciones pendientes: "
            f"{len(pendientes)}"
        )

        # ==================================================
        # EJECUCIÓN SECUENCIAL
        # ==================================================

        for migration_file in pendientes:

            version = migration_file.stem

            ejecutar_migracion(
                migration_file
            )

            # Refrescar estado después de ejecutar
            verificar_migracion_registrada(
                db,
                version,
            )

            print(
                f"✓ {version} aplicada correctamente."
            )

        print("")
        print(
            "============================================"
        )
        print(
            " MIGRACIONES COMPLETADAS"
        )
        print(
            "============================================"
        )

        print(
            f"✓ Migraciones aplicadas en esta ejecución: "
            f"{len(pendientes)}"
        )

    finally:

        client.close()


if __name__ == "__main__":
    run_migrations()