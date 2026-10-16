# MongoDB - Semáforo Vital

## US-08 - Implementación de validadores, índices y datos semilla

Este directorio contiene la infraestructura MongoDB implementada para la US-08 del proyecto **Semáforo Vital**.

La solución utiliza **MongoDB Atlas** como motor documental persistente y scripts versionados dentro del repositorio backend para garantizar que la estructura pueda reproducirse de forma controlada.

---

## Base de datos

```text
semaforo_vital
```

## Cluster de desarrollo

```text
semaforo-vital-dev
```

## Colecciones implementadas

```text
albergues
registros_diarios
```

---

# 1. Estructura del directorio

```text
database/
└── mongodb/
    ├── init/
    │   └── init_semaforo_vital.js
    ├── seeds/
    │   └── seed_semaforo_vital.js
    ├── tests/
    │   └── test_validaciones.js
    ├── docs/
    │   └── evidencias_US-08.md
    └── README.md
```

### `init/`

Contiene el script de inicialización de MongoDB:

- creación de colecciones;
- actualización de colecciones existentes;
- validadores `$jsonSchema`;
- configuración de índices.

### `seeds/`

Contiene datos semilla simulados para pruebas funcionales del backend.

### `tests/`

Contiene pruebas automáticas de validación de esquema, restricciones de rangos y unicidad.

### `docs/`

Contiene la evidencia técnica de cumplimiento de la US-08.

---

# 2. Requisitos

Para ejecutar los scripts se requiere:

- acceso autorizado al proyecto de MongoDB Atlas;
- acceso al cluster `semaforo-vital-dev`;
- `mongosh` instalado;
- usuario de base de datos con permisos suficientes sobre `semaforo_vital`.

Durante la implementación se utilizó:

```text
mongosh 2.13.0
```

---

# 3. Variables de entorno

El backend utiliza `pydantic-settings` y carga variables desde `.env`.

Variables definidas:

```env
MONGODB_URI=
MONGODB_DB=semaforo_vital
```

En Python pueden consultarse como:

```python
settings.mongodb_uri
settings.mongodb_db
```

El archivo `.env` está excluido por `.gitignore`.

No deben versionarse:

- usuarios de MongoDB;
- contraseñas;
- cadenas de conexión privadas;
- credenciales de Atlas.

---

# 4. Conexión a MongoDB Atlas

La conexión debe obtenerse desde:

```text
MongoDB Atlas
→ SemaforoVital
→ semaforo-vital-dev
→ Connect
→ Shell
```

Por seguridad, la contraseña no debe incluirse directamente en comandos versionados.

Después de conectarse, seleccionar la base:

```javascript
use semaforo_vital
```

Validar conexión:

```javascript
db.getName()
```

Resultado esperado:

```text
semaforo_vital
```

Prueba de conectividad:

```javascript
db.runCommand({ ping: 1 })
```

Resultado esperado:

```javascript
{ ok: 1 }
```

---

# 5. Inicialización de la base de datos

Archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

Ejecución desde `mongosh`:

```javascript
load("database/mongodb/init/init_semaforo_vital.js")
```

El script administra las colecciones:

```text
albergues
registros_diarios
```

El script es reejecutable:

- si la colección no existe, utiliza `createCollection`;
- si ya existe, actualiza el validador mediante `collMod`.

Las colecciones usan:

```text
validationLevel: strict
validationAction: error
```

Los documentos que incumplen las reglas son rechazados por MongoDB.

---

# 6. Colección `albergues`

Estructura funcional principal:

```javascript
{
    _id: ObjectId,
    codigo_albergue: String,
    nombre: String,

    ubicacion: {
        departamento: String,
        municipio: String,
        direccion: String,

        coordenadas: {
            type: "Point",
            coordinates: [Number, Number]
        }
    },

    capacidad_instalada: Int32,
    activo: Boolean,

    registrado_por: ObjectId,
    fecha: Date,
    created_at: Date
}
```

### Reglas principales

```text
codigo_albergue      obligatorio
nombre               obligatorio
ubicacion            obligatoria
capacidad_instalada  >= 0
activo               obligatorio
registrado_por       obligatorio
fecha                obligatoria
created_at           obligatorio
```

GeoJSON utiliza el orden:

```text
[longitud, latitud]
```

Ejemplo:

```javascript
{
    type: "Point",
    coordinates: [-75.6946, 4.8143]
}
```

---

# 7. Colección `registros_diarios`

Estructura:

```javascript
{
    _id: ObjectId,
    albergue_id: ObjectId,
    fecha: Date,

    poblacion: Int32,
    litros_agua: Number,
    letrinas: Int32,
    casos_eda: Int32,
    casos_ira: Int32,

    registrado_por: ObjectId,
    created_at: Date
}
```

## Campos obligatorios

```text
albergue_id
fecha
poblacion
litros_agua
letrinas
casos_eda
casos_ira
registrado_por
created_at
```

## Restricciones de rango

```text
poblacion   >= 0
litros_agua >= 0
letrinas    >= 0
casos_eda   >= 0
casos_ira   >= 0
```

---

# 8. Manejo de fechas

`fecha` representa el **día operativo del registro**.

Debe normalizarse a medianoche de la zona horaria funcional `America/Bogota`.

MongoDB almacena BSON Date como un instante UTC, por lo tanto:

- Hora funcional Colombia: `2026-10-14 00:00:00 UTC-05:00`
- Instante BSON equivalente: `ISODate("2026-10-14T05:00:00.000Z")`

`created_at` representa el instante real en el que se crea el documento:

```javascript
created_at: new Date()
```

Esta separación es necesaria para garantizar correctamente la unicidad diaria.

---

# 9. Índice compuesto único

En `registros_diarios` se implementa:

```javascript
db.registros_diarios.createIndex(
    {
        albergue_id: 1,
        fecha: -1
    },
    {
        name: "ux_registros_diarios_albergue_fecha",
        unique: true
    }
);
```

Objetivos:

1. evitar dos registros para el mismo albergue y la misma fecha;
2. acelerar consultas temporales por albergue.

Un intento de duplicado genera:

```text
E11000 duplicate key error
```

Código:

```text
11000
```

---

# 10. Datos semilla

Archivo:

```text
database/mongodb/seeds/seed_semaforo_vital.js
```

Ejecución:

```javascript
load("database/mongodb/seeds/seed_semaforo_vital.js")
```

El script verifica primero que existan:

```text
albergues
registros_diarios
```

## Escenario crítico

```text
Población: 200
Agua: 800 L
Letrinas: 4
Casos EDA: 8
Casos IRA: 3
```

Indicador:

```text
800 / 200 = 4 L/persona/día
```

Cumple:

```text
< 5 L/persona/día
```

## Escenario óptimo

```text
Población: 100
Agua: 1800 L
Letrinas: 8
Casos EDA: 0
Casos IRA: 1
```

Indicador:

```text
1800 / 100 = 18 L/persona/día
```

Cumple:

```text
>= 15 L/persona/día
```

El indicador no se persiste como campo. Se calcula mediante:

```text
litros_agua / poblacion
```

## Reejecución

Los datos utilizan identificadores determinísticos y:

```javascript
updateOne(..., { upsert: true })
```

Esto permite ejecutar el script varias veces sin duplicar las semillas.

Resultado esperado después de cualquier reejecución:

```text
albergues: 2
registros_diarios: 2
```

---

# 11. Pruebas automáticas

Archivo:

```text
database/mongodb/tests/test_validaciones.js
```

Ejecución:

```javascript
load("database/mongodb/tests/test_validaciones.js")
```

Pruebas implementadas:

| # | Prueba | Resultado esperado |
|---:|---|---|
| 1 | `poblacion = -1` | Error 121 |
| 2 | `litros_agua = -1` | Error 121 |
| 3 | `letrinas = -1` | Error 121 |
| 4 | `casos_eda = -1` | Error 121 |
| 5 | `casos_ira = -1` | Error 121 |
| 6 | falta `registrado_por` | Error 121 |
| 7 | documento válido | Aceptado |
| 8 | duplicado `albergue_id + fecha` | Error 11000 |

Resultado esperado:

```text
Pruebas exitosas: 8
Pruebas fallidas: 0
```

Los datos temporales usados durante las pruebas son eliminados al finalizar.

---

# 12. Integridad referencial

`albergue_id` se valida como:

```text
ObjectId
```

MongoDB `$jsonSchema` no implementa una restricción de clave foránea tradicional entre colecciones.

Por tanto:

```text
$jsonSchema
    ↓
puede validar que albergue_id sea ObjectId
    ↓
pero no puede verificar que exista en albergues
```

La existencia del albergue debe validarse desde la capa de aplicación antes de registrar información diaria.

Los datos semilla sí utilizan referencias existentes y consistentes.

---

# 13. Orden recomendado de ejecución

Desde una sesión autenticada de `mongosh`:

```javascript
load("database/mongodb/init/init_semaforo_vital.js")
```

Después:

```javascript
load("database/mongodb/seeds/seed_semaforo_vital.js")
```

Finalmente:

```javascript
load("database/mongodb/tests/test_validaciones.js")
```

Flujo:

```text
MongoDB Atlas
      ↓
init_semaforo_vital.js
      ↓
colecciones + $jsonSchema + índices
      ↓
seed_semaforo_vital.js
      ↓
2 albergues + 2 registros diarios
      ↓
test_validaciones.js
      ↓
8 pruebas exitosas / 0 fallidas
```

---

# 14. Verificaciones rápidas

## Listar colecciones

```javascript
db.getCollectionNames().sort()
```

Esperado:

```javascript
[
    "albergues",
    "registros_diarios"
]
```

## Ver índices

```javascript
db.registros_diarios.getIndexes()
```

Debe aparecer:

```text
ux_registros_diarios_albergue_fecha
```

con:

```text
unique: true
```

## Contar semillas

```javascript
db.albergues.countDocuments({})
db.registros_diarios.countDocuments({})
```

Esperado:

```text
2
2
```

---

# 15. Seguridad

Para el entorno de desarrollo se creó un usuario limitado a la base `semaforo_vital` con los roles necesarios para inicialización y administración de la US.

No deben utilizarse credenciales administrativas globales dentro del backend.

Recomendaciones:

- mantener `.env` fuera de Git;
- no registrar contraseñas en scripts;
- no almacenar la URI privada en documentación;
- limitar Network Access a direcciones autorizadas;
- utilizar usuarios con privilegios mínimos necesarios.

---

# 16. Evidencia

La evidencia detallada de cumplimiento de los criterios de aceptación se encuentra en:

```text
database/mongodb/docs/evidencias_US-08.md
```

---

# 17. Resultado de la US-08

```text
CA-01  $jsonSchema                    CUMPLE
CA-02  índice compuesto único         CUMPLE
CA-03  trazabilidad obligatoria       CUMPLE
CA-04  datos semilla                  CUMPLE
CA-05  rechazo de valores negativos   CUMPLE
```

La infraestructura documental necesaria para iniciar integración y pruebas del backend se encuentra implementada en MongoDB Atlas y es reproducible desde los scripts versionados en el repositorio.