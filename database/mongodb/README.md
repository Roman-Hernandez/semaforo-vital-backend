# MongoDB - Semáforo Vital

## Infraestructura de persistencia MongoDB

Este directorio contiene la infraestructura MongoDB del proyecto **Semáforo Vital**.

La implementación inicial fue desarrollada en la US-08 y posteriormente ha evolucionado mediante migraciones versionadas, validadores `$jsonSchema`, índices, controles de integridad y pruebas DBA.

La solución utiliza **MongoDB Atlas** como motor documental persistente y scripts versionados dentro del repositorio backend para garantizar que la estructura pueda reproducirse y evolucionar de forma controlada.

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

Actualmente se encuentran implementadas:

```text
usuarios
albergues
registros_diarios
condiciones_sanitarias
casos_enfermedades
schema_migrations
```

`schema_migrations` es una colección técnica utilizada para controlar la evolución versionada del modelo.

---

# 1. Estructura del directorio

```text
database/
└── mongodb/
    ├── init/
    │   └── init_semaforo_vital.js
    │
    ├── migrations/
    │   ├── 001_fix_colombia_timezone.js
    │   ├── 002_create_usuarios.js
    │   ├── 003_harden_data_integrity.js
    │   ├── 004_add_update_traceability.js
    │   ├── 005_create_condiciones_sanitarias.js
    │   └── 006_create_casos_enfermedades.js
    │
    ├── seeds/
    │   ├── seed_admin.py
    │   └── seed_semaforo_vital.js
    │
    ├── tests/
    │   ├── test_validaciones.js
    │   ├── test_integridad_qa.js
    │   ├── test_condiciones_sanitarias.js
    │   └── test_casos_enfermedades.js
    │
    ├── docs/
    │   ├── evidencias_US-08.md
    │   └── contrato_datos_backend.md
    │
    ├── migrate.py
    └── README.md
```

## `init/`

Contiene:

```text
init_semaforo_vital.js
```

Este archivo representa el **estado estructural vigente** de MongoDB para instalaciones nuevas.

Su responsabilidad es:

- crear colecciones cuando no existen;
- actualizar validadores mediante `collMod`;
- establecer `validationLevel: strict`;
- establecer `validationAction: error`;
- crear o verificar índices;
- permitir ejecución repetida sin generar duplicados.

---

## `migrations/`

Contiene la evolución versionada de la base de datos.

Cada cambio estructural nuevo debe implementarse mediante una migración nueva.

Una migración que ya haya sido aplicada en un ambiente compartido:

> No debe modificarse retroactivamente.

---

## `migrate.py`

Es el orquestador general de migraciones MongoDB.

Su función es:

1. localizar migraciones con formato `NNN_*.js`;
2. ordenarlas por versión;
3. consultar `schema_migrations`;
4. detectar cuáles se encuentran pendientes;
5. ejecutarlas mediante `mongosh`;
6. verificar que queden registradas correctamente.

La migración:

```text
001_fix_colombia_timezone
```

es tratada como migración legacy debido a que fue ejecutada antes de existir `schema_migrations`.

---

## `seeds/`

Contiene datos iniciales y datos simulados utilizados para desarrollo y pruebas.

Los seeds deben ser reejecutables y no deben generar duplicados.

---

## `tests/`

Contiene pruebas DBA para:

- validadores `$jsonSchema`;
- tipos BSON;
- campos obligatorios;
- rangos numéricos;
- índices;
- unicidad;
- trazabilidad;
- referencias lógicas;
- detección de documentos huérfanos.

---

## `docs/`

Contiene:

- evidencia técnica;
- decisiones del modelo;
- contrato vigente de datos entre MongoDB y las capas consumidoras.

---

# 2. Requisitos

Para ejecutar la infraestructura MongoDB se requiere:

- acceso autorizado al proyecto MongoDB Atlas;
- acceso al cluster `semaforo-vital-dev`;
- `mongosh` instalado;
- Python disponible para ejecutar `migrate.py`;
- usuario MongoDB con permisos suficientes sobre `semaforo_vital`.

Durante la implementación inicial se utilizó:

```text
mongosh 2.13.0
```

---

# 3. Variables de entorno

El backend utiliza `pydantic-settings` y carga variables desde `.env`.

Variables principales:

```env
MONGODB_URI=
MONGODB_DB=semaforo_vital
APP_TIMEZONE=America/Bogota
```

En Python se encuentran disponibles mediante:

```python
settings.mongodb_uri
settings.mongodb_db
settings.app_timezone
```

El archivo `.env` está excluido por `.gitignore`.

No deben versionarse:

- usuarios de MongoDB;
- contraseñas;
- URI privadas;
- credenciales de Atlas;
- secretos del backend.

---

# 4. Conexión a MongoDB Atlas

La cadena de conexión debe obtenerse desde MongoDB Atlas.

Conceptualmente:

```text
MongoDB Atlas
        ↓
SemaforoVital
        ↓
semaforo-vital-dev
        ↓
Connect
```

Validación desde `mongosh`:

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

Las credenciales nunca deben almacenarse dentro de scripts versionados.

---

# 5. Migraciones

El mecanismo recomendado para ambientes existentes es:

```powershell
python -m database.mongodb.migrate
```

El orquestador detecta automáticamente las migraciones pendientes.

Migraciones vigentes:

```text
001_fix_colombia_timezone.js
002_create_usuarios.js
003_harden_data_integrity.js
004_add_update_traceability.js
005_create_condiciones_sanitarias.js
006_create_casos_enfermedades.js
```

## Estado conceptual

```text
001
Ajuste histórico de zona horaria
        ↓
002
Creación de usuarios
        ↓
003
Fortalecimiento de integridad
        ↓
004
Trazabilidad de modificaciones
        ↓
005
Condiciones sanitarias
        ↓
006
Casos de enfermedades
```

---

# 6. Inicialización reproducible

Archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

Ejecución:

```powershell
mongosh "$env:MONGODB_URI" --quiet --file "database/mongodb/init/init_semaforo_vital.js"
```

Actualmente administra:

```text
usuarios
albergues
registros_diarios
condiciones_sanitarias
casos_enfermedades
schema_migrations
```

Cuando una colección no existe:

```text
createCollection
```

Cuando ya existe:

```text
collMod
```

Los validadores utilizan:

```text
validationLevel: strict
validationAction: error
```

Los índices también se crean de manera reejecutable.

---

# 7. Colección `usuarios`

## Propósito

Almacena los usuarios autorizados para utilizar el sistema.

Campos principales:

```text
_id
email
password_hash
role
active
nombre
apellido
albergue_id
created_at
updated_at
last_login_at
```

Roles permitidos:

```text
super_administrador
administrador_albergue
```

El correo debe almacenarse normalizado en minúsculas.

`password_hash` debe utilizar formato Argon2id.

Nunca deben almacenarse contraseñas en texto plano.

## Índices

Correo único:

```text
ux_usuarios_email
```

Consulta por albergue:

```text
ix_usuarios_albergue_id
```

---

# 8. Colección `albergues`

Estructura funcional:

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
            coordinates: [
                Number,
                Number
            ]
        }
    },

    capacidad_instalada: Int32,

    activo: Boolean,

    registrado_por: ObjectId,

    fecha: Date,

    created_at: Date,

    updated_at: Date,

    updated_by: ObjectId
}
```

## GeoJSON

Las coordenadas utilizan:

```text
[longitud, latitud]
```

Ejemplo:

```javascript
{
    type: "Point",
    coordinates: [
        -75.6946,
        4.8143
    ]
}
```

## Índice

```text
ux_albergues_codigo_albergue
```

`codigo_albergue` debe ser único.

---

# 9. Colección `registros_diarios`

## Propósito

Representa el consolidado operativo de un albergue para un día específico.

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

    created_at: Date,

    updated_at: Date,

    updated_by: ObjectId
}
```

## Restricciones

```text
poblacion   >= 0
litros_agua >= 0
letrinas    >= 0
casos_eda   >= 0
casos_ira   >= 0
```

## Regla funcional

Solo puede existir:

> Un registro consolidado por albergue y día.

Índice:

```text
ux_registros_diarios_albergue_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

con:

```text
unique: true
```

## Casos EDA e IRA

Los campos:

```text
casos_eda
casos_ira
```

representan:

> Casos nuevos reportados durante el día.

No representan casos activos ni valores acumulados.

---

# 10. Colección `condiciones_sanitarias`

Fue incorporada mediante:

```text
005_create_condiciones_sanitarias.js
```

## Propósito

Almacena condiciones sanitarias observadas en un albergue para una fecha determinada.

Estructura:

```javascript
{
    _id: ObjectId,

    albergue_id: ObjectId,

    fecha: Date,

    agua_potable_disponible: Boolean,

    banos_disponibles: Int32,

    estado_higiene: String,

    estado_saneamiento: String,

    otros_recursos_sanitarios: [
        {
            nombre: String,
            cantidad: Int32,
            observacion: String
        }
    ],

    observaciones: String,

    fuente_datos: String,

    registrado_por: ObjectId,

    created_at: Date,

    updated_at: Date,

    updated_by: ObjectId
}
```

## Reglas principales

Son obligatorios:

```text
albergue_id
fecha
agua_potable_disponible
banos_disponibles
estado_higiene
estado_saneamiento
fuente_datos
registrado_por
created_at
```

`banos_disponibles` debe ser:

```text
>= 0
```

Cuando exista `otros_recursos_sanitarios`, cada elemento requiere:

```text
nombre
cantidad
```

y:

```text
cantidad >= 0
```

Los catálogos de:

```text
estado_higiene
estado_saneamiento
fuente_datos
```

permanecen abiertos hasta que exista definición funcional aprobada.

## Índice

```text
ix_condiciones_sanitarias_albergue_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

No es único.

---

# 11. Colección `casos_enfermedades`

Fue incorporada mediante:

```text
006_create_casos_enfermedades.js
```

## Propósito

Almacena la cantidad de casos activos de una enfermedad específica para un albergue y una fecha determinada.

Estructura:

```javascript
{
    _id: ObjectId,

    albergue_id: ObjectId,

    fecha: Date,

    enfermedad: String,

    cantidad_casos_activos: Int32,

    observaciones: String,

    fuente_datos: String,

    registrado_por: ObjectId,

    created_at: Date,

    updated_at: Date,

    updated_by: ObjectId
}
```

## Semántica de `cantidad_casos_activos`

`cantidad_casos_activos` representa:

> La cantidad de personas que tienen activa una enfermedad determinada en la fecha del registro.

Ejemplo:

```text
Albergue A
Fecha: 2026-11-10
Enfermedad: EDA
cantidad_casos_activos: 7
```

significa:

```text
7 personas presentan EDA activa en esa fecha.
```

No representa:

```text
casos nuevos del día
```

ni:

```text
casos acumulados históricos
```

Esta semántica es diferente a:

```text
registros_diarios.casos_eda
registros_diarios.casos_ira
```

que representan casos nuevos del día.

## Campos obligatorios

```text
albergue_id
fecha
enfermedad
cantidad_casos_activos
fuente_datos
registrado_por
created_at
```

## Campos opcionales

```text
observaciones
updated_at
updated_by
```

## Reglas

`enfermedad`:

```text
String no vacío
```

`cantidad_casos_activos`:

```text
Int32 >= 0
```

`fuente_datos`:

```text
String no vacío
```

El catálogo definitivo de enfermedades permanece pendiente de definición funcional.

Por esta razón:

```text
enfermedad
```

no utiliza actualmente un `enum`.

La misma decisión aplica a:

```text
fuente_datos
```

## Índices

Consulta temporal por albergue:

```text
ix_casos_enfermedades_albergue_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

Consulta histórica de una enfermedad:

```text
ix_casos_enfermedades_albergue_enfermedad_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    enfermedad: 1,
    fecha: -1
}
```

Ninguno de los dos índices es único.

Actualmente no existe una regla funcional aprobada que limite a un único documento por:

```text
albergue + enfermedad + fecha
```

---

# 12. Manejo de fechas

La zona horaria funcional del proyecto es:

```text
America/Bogota
```

Una fecha funcional:

```text
2026-10-14 00:00:00 America/Bogota
```

se almacena en MongoDB como:

```text
2026-10-14T05:00:00.000Z
```

MongoDB almacena BSON Date como un instante UTC.

`created_at` representa el momento real de creación:

```javascript
created_at: new Date()
```

`fecha` representa la fecha funcional asociada al dato.

---

# 13. Integridad referencial

MongoDB `$jsonSchema` valida tipos pero no implementa claves foráneas tradicionales.

Las principales referencias lógicas actuales son:

```text
usuarios.albergue_id
    → albergues._id

albergues.registrado_por
    → usuarios._id

albergues.updated_by
    → usuarios._id

registros_diarios.albergue_id
    → albergues._id

registros_diarios.registrado_por
    → usuarios._id

registros_diarios.updated_by
    → usuarios._id

condiciones_sanitarias.albergue_id
    → albergues._id

condiciones_sanitarias.registrado_por
    → usuarios._id

condiciones_sanitarias.updated_by
    → usuarios._id

casos_enfermedades.albergue_id
    → albergues._id

casos_enfermedades.registrado_por
    → usuarios._id

casos_enfermedades.updated_by
    → usuarios._id
```

MongoDB puede verificar:

```text
albergue_id es ObjectId
```

pero no puede garantizar mediante `$jsonSchema`:

```text
el ObjectId existe realmente en albergues
```

La aplicación debe validar estas referencias antes de persistir información.

Adicionalmente, los controles DBA utilizan `$lookup` para detectar referencias huérfanas.

---

# 14. Trazabilidad

Los documentos operativos utilizan:

```text
registrado_por
created_at
```

para identificar la creación original.

Cuando el documento sea modificado pueden utilizarse:

```text
updated_at
updated_by
```

Reglas:

```text
created_at
```

no debe sustituirse durante una actualización.

```text
registrado_por
```

identifica al creador original y no debe utilizarse como identificador del último modificador.

---

# 15. Datos semilla

Archivo:

```text
database/mongodb/seeds/seed_semaforo_vital.js
```

Los seeds existentes fueron diseñados para pruebas del modelo inicial.

Utilizan identificadores determinísticos y operaciones reejecutables.

El usuario responsable se obtiene desde un:

```text
super_administrador
```

con:

```text
active = true
```

No deben utilizarse identificadores ficticios para `registrado_por`.

---

# 16. Pruebas DBA

## Pruebas originales

```text
database/mongodb/tests/test_validaciones.js
```

Resultado esperado:

```text
Pruebas exitosas: 8
Pruebas fallidas: 0
```

---

## Pruebas de integridad QA

```text
database/mongodb/tests/test_integridad_qa.js
```

Resultado esperado:

```text
12 pruebas exitosas
0 pruebas fallidas
```

---

## Condiciones sanitarias

```text
database/mongodb/tests/test_condiciones_sanitarias.js
```

Valida:

- documento válido;
- campos obligatorios;
- tipos BSON;
- valores negativos;
- recursos embebidos;
- `additionalProperties: false`;
- trazabilidad;
- índice;
- referencias huérfanas.

Resultado validado:

```text
Pruebas exitosas: 14
Pruebas fallidas: 0
```

---

## Casos de enfermedades

```text
database/mongodb/tests/test_casos_enfermedades.js
```

Valida:

- documento válido;
- obligatoriedad de `albergue_id`;
- obligatoriedad de `fecha`;
- obligatoriedad de `enfermedad`;
- obligatoriedad de `cantidad_casos_activos`;
- obligatoriedad de `fuente_datos`;
- rechazo de enfermedad vacía;
- rechazo de cantidades negativas;
- tipo BSON de `cantidad_casos_activos`;
- tipo de `registrado_por`;
- rechazo de propiedades adicionales;
- trazabilidad mediante `updated_at` y `updated_by`;
- existencia de los índices epidemiológicos;
- detección de referencias huérfanas.

Resultado validado:

```text
Pruebas exitosas: 14
Pruebas fallidas: 0
```

---

# 17. Índices vigentes

## `usuarios`

```text
ux_usuarios_email
ix_usuarios_albergue_id
```

## `albergues`

```text
ux_albergues_codigo_albergue
```

## `registros_diarios`

```text
ux_registros_diarios_albergue_fecha
```

Único.

## `condiciones_sanitarias`

```text
ix_condiciones_sanitarias_albergue_fecha
```

No único.

## `casos_enfermedades`

```text
ix_casos_enfermedades_albergue_fecha
ix_casos_enfermedades_albergue_enfermedad_fecha
```

No únicos.

## `schema_migrations`

```text
ux_schema_migrations_version
```

Único.

---

# 18. Orden recomendado de preparación

Para un ambiente nuevo, conceptualmente:

```text
Inicialización estructural
        ↓
Migraciones versionadas
        ↓
Usuario administrativo inicial
        ↓
Datos semilla
        ↓
Pruebas DBA
```

Para un ambiente existente:

```text
main actualizado
        ↓
python -m database.mongodb.migrate
        ↓
migraciones pendientes
        ↓
pruebas específicas
        ↓
actualización del init
        ↓
nueva ejecución de pruebas
```

---

# 19. Verificaciones rápidas

## Colecciones

```javascript
db.getCollectionNames().sort()
```

Entre las colecciones del modelo deben encontrarse:

```text
usuarios
albergues
registros_diarios
condiciones_sanitarias
casos_enfermedades
schema_migrations
```

## Migraciones

```javascript
db.schema_migrations
    .find({})
    .sort({ version: 1 })
```

Deben encontrarse registradas las migraciones gestionadas por el mecanismo vigente.

La migración `001` puede no tener registro histórico porque antecede a `schema_migrations`.

## Índices de casos de enfermedades

```javascript
db.casos_enfermedades.getIndexes()
```

Deben encontrarse:

```text
ix_casos_enfermedades_albergue_fecha
ix_casos_enfermedades_albergue_enfermedad_fecha
```

---

# 20. Seguridad

No deben versionarse:

- contraseñas;
- credenciales MongoDB;
- URI privadas;
- tokens;
- secretos;
- cuentas administrativas globales.

Recomendaciones:

- mantener `.env` fuera de Git;
- utilizar usuarios con privilegios mínimos;
- restringir Network Access;
- evitar credenciales dentro de scripts;
- utilizar hashes seguros para contraseñas;
- limitar información sensible almacenada.

Las colecciones epidemiológicas implementadas actualmente manejan cantidades agregadas.

`casos_enfermedades` no almacena identificadores individuales de pacientes.

---

# 21. Reglas para evolución del modelo

Todo cambio nuevo debe seguir este proceso:

```text
análisis
    ↓
nueva migración
    ↓
pruebas
    ↓
actualización de init
    ↓
documentación
    ↓
commit
    ↓
Pull Request
```

No deben modificarse migraciones ya aplicadas para representar cambios posteriores.

Si un nuevo campo requiere información que no puede determinarse para documentos históricos:

> No debe inventarse información para completar el modelo.

Los catálogos funcionales pendientes tampoco deben convertirse unilateralmente en restricciones `enum` desde la base de datos.

---

# 22. Estado actual

La infraestructura MongoDB cuenta actualmente con:

```text
usuarios                        ✓
albergues                       ✓
registros_diarios               ✓
condiciones_sanitarias          ✓
casos_enfermedades              ✓
schema_migrations               ✓
```

Migraciones:

```text
001_fix_colombia_timezone                 ✓ legacy
002_create_usuarios                       ✓
003_harden_data_integrity                 ✓
004_add_update_traceability               ✓
005_create_condiciones_sanitarias         ✓
006_create_casos_enfermedades             ✓
```

Pruebas específicas recientes:

```text
condiciones_sanitarias     14/14
casos_enfermedades         14/14
```

El estado estructural vigente se encuentra reproducido en:

```text
database/mongodb/init/init_semaforo_vital.js
```

y la evolución histórica se conserva mediante:

```text
database/mongodb/migrations/
```