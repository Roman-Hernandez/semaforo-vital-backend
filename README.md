# semaforo-vital-backend

Estructura inicial de backend en Python con FastAPI y arquitectura en capas.

## Estructura base

- `app/api`: capa de transporte HTTP (rutas/controladores)
- `app/application`: casos de uso y lógica de aplicación
- `app/domain`: entidades y reglas de dominio
- `app/infrastructure`: integraciones externas (DB, servicios, etc.)
- `app/core`: configuración transversal

## Endpoint de healthcheck

- `GET /api/v1/health`
- Respuesta esperada: `{"status":"ok"}`

## Ejecución local

```bash
uvicorn app.main:app --reload
```

## Migraciones y Seeder (MongoDB)

```bash
# Ejecutar migraciones
python -m database.mongodb.migrate

# Crear superadministrador inicial
python -m database.mongodb.seeds.seed_admin

# Actualizar contraseña de superadministrador existente
python -m database.mongodb.seeds.seed_admin --reset
```

## Ejecución con Docker

```bash
docker build -t semaforo-vital-backend .
docker run --rm -p 8000:8000 semaforo-vital-backend
```