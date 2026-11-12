# MongoDB - Semáforo Vital

## Infraestructura de persistencia MongoDB

Este directorio contiene la infraestructura MongoDB del proyecto **Semáforo Vital**.

La implementación inicial fue desarrollada en la US-08 y posteriormente ha evolucionado mediante migraciones versionadas, validadores `$jsonSchema`, índices, controles de integridad, patrones de modelado documental y pruebas DBA.

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
intervenciones
metricas_albergue
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
    │   ├── 006_create_casos_enfermedades.js
    │   ├── 007_create_intervenciones.js
    │   └── 008_create_metricas_albergue.js
    │
    ├── seeds/
    │   ├── seed_admin.py
    │   └── seed_semaforo_vital.js
    │
    ├── tests/
    │   ├── test_validaciones.js
    │   ├── test_integridad_qa.js
    │   ├── test_condiciones_sanitarias.js
    │   ├── test_casos_enfermedades.js
    │   ├── test_intervenciones.js
    │   └── test_metricas_albergue.js
    │
    ├── docs/
    │   ├── evidencias_US-08.md
    │   └── contrato_datos_backend.md
    │
    ├── migrate.py
    └── README.md
```

---

# 2. Inicialización estructural

Archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

Representa el **estado estructural vigente** de MongoDB.

Su responsabilidad es:

- crear colecciones cuando no existen;
- actualizar validadores mediante `collMod`;
- establecer `validationLevel: strict`;
- establecer `validationAction: error`;
- crear o verificar índices;
- reproducir los patrones estructurales vigentes;
- permitir ejecución repetida sin generar duplicados.

La inicialización no reemplaza el mecanismo de migraciones.

Las migraciones conservan la evolución histórica de ambientes existentes.

---

# 3. Migraciones

Cada cambio estructural nuevo debe implementarse mediante una migración versionada.

Una migración ya aplicada:

> No debe modificarse retroactivamente.

El orquestador general es:

```text
database/mongodb/migrate.py
```

Ejecución:

```powershell
python -m database.mongodb.migrate
```

Su responsabilidad es:

1. localizar archivos `NNN_*.js`;
2. ordenarlos por versión;
3. consultar `schema_migrations`;
4. detectar migraciones pendientes;
5. ejecutarlas mediante `mongosh`;
6. verificar su registro.

La migración:

```text
001_fix_colombia_timezone
```

es legacy porque fue aplicada antes de existir `schema_migrations`.

---

# 4. Migraciones vigentes

```text
001_fix_colombia_timezone.js
002_create_usuarios.js
003_harden_data_integrity.js
004_add_update_traceability.js
005_create_condiciones_sanitarias.js
006_create_casos_enfermedades.js
007_create_intervenciones.js
008_create_metricas_albergue.js
```

Evolución conceptual:

```text
001
Zona horaria
    ↓
002
Usuarios
    ↓
003
Integridad
    ↓
004
Trazabilidad
    ↓
005
Condiciones sanitarias
    ↓
006
Casos de enfermedades
    ↓
007
Intervenciones reales
    ↓
008
Métricas de albergue
Bucket Pattern + Computed Pattern
```

---

# 5. Requisitos

Para operar la infraestructura MongoDB se requiere:

- acceso autorizado a MongoDB Atlas;
- acceso al cluster `semaforo-vital-dev`;
- `mongosh`;
- Python;
- usuario MongoDB con permisos sobre `semaforo_vital`.

Durante la implementación se utilizó:

```text
mongosh 2.13.0
```

---

# 6. Variables de entorno

Variables principales:

```env
MONGODB_URI=
MONGODB_DB=semaforo_vital
APP_TIMEZONE=America/Bogota
```

En Python:

```python
settings.mongodb_uri
settings.mongodb_db
settings.app_timezone
```

El archivo `.env` está excluido del repositorio.

No deben versionarse:

- usuarios MongoDB;
- contraseñas;
- URI privadas;
- tokens;
- secretos;
- credenciales de Atlas.

Cuando `mongosh` se utiliza directamente desde PowerShell, la URI debe estar disponible en la sesión actual.

Ejemplo:

```powershell
$env:MONGODB_URI = ((Get-Content .env | Where-Object { $_ -match '^MONGODB_URI=' }) -replace '^MONGODB_URI=', '').Trim()
```

---

# 7. Colección `usuarios`

Almacena usuarios autorizados.

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

Roles:

```text
super_administrador
administrador_albergue
```

Índices:

```text
ux_usuarios_email
ix_usuarios_albergue_id
```

Nunca deben almacenarse contraseñas en texto plano.

---

# 8. Colección `albergues`

Representa los albergues del sistema.

Estructura principal:

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

GeoJSON utiliza:

```text
[longitud, latitud]
```

Índice:

```text
ux_albergues_codigo_albergue
```

Único.

---

# 9. Colección `registros_diarios`

Representa el consolidado oficial diario de cada albergue.

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

Regla:

> Solo puede existir un registro consolidado por albergue y día.

Índice:

```text
ux_registros_diarios_albergue_fecha
```

Único.

Los campos:

```text
casos_eda
casos_ira
```

representan casos nuevos durante el día.

No representan casos activos ni acumulados.

---

# 10. Colección `condiciones_sanitarias`

Incorporada mediante:

```text
005_create_condiciones_sanitarias.js
```

Almacena condiciones sanitarias observadas.

Campos principales:

```text
albergue_id
fecha
agua_potable_disponible
banos_disponibles
estado_higiene
estado_saneamiento
otros_recursos_sanitarios
observaciones
fuente_datos
registrado_por
created_at
updated_at
updated_by
```

Índice:

```text
ix_condiciones_sanitarias_albergue_fecha
```

No único.

Los catálogos de:

```text
estado_higiene
estado_saneamiento
fuente_datos
```

permanecen abiertos hasta tener definición funcional aprobada.

---

# 11. Colección `casos_enfermedades`

Incorporada mediante:

```text
006_create_casos_enfermedades.js
```

Almacena casos activos de una enfermedad para una fecha determinada.

Estructura principal:

```javascript
{
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

`cantidad_casos_activos` significa:

> Personas que presentan activamente la enfermedad en esa fecha.

No representa casos nuevos ni acumulados.

Índices:

```text
ix_casos_enfermedades_albergue_fecha
ix_casos_enfermedades_albergue_enfermedad_fecha
```

No únicos.

---

# 12. Colección `intervenciones`

Incorporada mediante:

```text
007_create_intervenciones.js
```

Almacena exclusivamente acciones reales ejecutadas.

Estructura:

```javascript
{
    albergue_id: ObjectId,
    fecha_intervencion: Date,
    tipo_intervencion: String,
    descripcion: String,
    observaciones: String,
    fuente_datos: String,
    registrado_por: ObjectId,
    created_at: Date,
    updated_at: Date,
    updated_by: ObjectId
}
```

No almacena:

```text
intervenciones simuladas
escenarios hipotéticos
acciones propuestas
```

Estas serán modeladas posteriormente dentro de:

```text
escenarios.intervenciones_simuladas
```

Índices:

```text
ix_intervenciones_albergue_fecha
ix_intervenciones_albergue_tipo_fecha
```

No únicos.

---

# 13. Colección `metricas_albergue`

Incorporada mediante:

```text
008_create_metricas_albergue.js
```

Esta colección implementa dos patrones de modelado documental:

```text
Bucket Pattern
Computed Pattern
```

Su finalidad es almacenar telemetría intradía agrupada por albergue y día, además de valores precalculados para consultas frecuentes.

---

## 13.1 Bucket Pattern

La regla estructural es:

```text
1 documento
=
1 albergue
+
1 fecha_bucket
```

Por ejemplo:

```text
Albergue A
12 de noviembre de 2026
```

tiene un único documento de `metricas_albergue`.

Las mediciones tomadas durante el día se almacenan dentro del array:

```text
mediciones
```

No se crea un documento independiente por cada lectura.

---

## 13.2 Estructura

```javascript
{
    _id: ObjectId,

    albergue_id: ObjectId,

    fecha_bucket: Date,

    mediciones: [
        {
            fecha_hora: Date,
            ph: Number,
            cloro_residual: Number,
            personas_alojadas: Int32,
            porcentaje_ocupacion: Number
        }
    ],

    calculados: {
        cantidad_mediciones: Int32,
        suma_ph: Number,
        suma_cloro_residual: Number,
        promedio_ph: Number,
        promedio_cloro_residual: Number,
        porcentaje_ocupacion: Number
    },

    ultima_medicion: {
        fecha_hora: Date,
        ph: Number,
        cloro_residual: Number,
        personas_alojadas: Int32,
        porcentaje_ocupacion: Number
    },

    estado_actual: {
        agua: {
            nivel: String
        },

        hacinamiento: {
            nivel: String
        },

        semaforo_vital: {
            nivel: String,
            codigo: Int32,
            estado_semaforo_id: ObjectId,
            fecha_calculo: Date
        },

        alertas_activas: {
            cantidad: Int32,
            ids: [
                ObjectId
            ]
        }
    },

    created_at: Date,

    updated_at: Date
}
```

---

# 14. `mediciones`

`mediciones` contiene la telemetría intradía del bucket.

Cada elemento requiere:

```text
fecha_hora
ph
cloro_residual
personas_alojadas
porcentaje_ocupacion
```

Reglas:

```text
ph >= 0
cloro_residual >= 0
personas_alojadas >= 0
porcentaje_ocupacion >= 0
```

`personas_alojadas` debe ser:

```text
Int32
```

No se establece un máximo de 96 elementos.

Aunque una frecuencia de 15 minutos produciría aproximadamente:

```text
96 mediciones/día
```

esa cantidad no constituye actualmente una regla funcional obligatoria.

---

# 15. Porcentaje de ocupación

`porcentaje_ocupacion` puede superar:

```text
100
```

Esto es intencional.

Ejemplo:

```text
capacidad instalada = 100 personas
personas alojadas   = 120 personas
ocupación           = 120 %
```

El modelo debe poder representar situaciones reales de:

```text
sobreocupación
hacinamiento
```

Por esta razón no existe:

```text
maximum: 100
```

en el validator.

---

# 16. Computed Pattern

La estructura:

```text
calculados
```

almacena valores precalculados.

Contiene:

```text
cantidad_mediciones
suma_ph
suma_cloro_residual
promedio_ph
promedio_cloro_residual
porcentaje_ocupacion
```

Su objetivo es evitar recalcular continuamente agregaciones sobre:

```text
mediciones
```

cuando el sistema consulte información frecuente.

Ejemplo:

```javascript
calculados: {
    cantidad_mediciones: NumberInt(2),
    suma_ph: 14.3,
    suma_cloro_residual: 0.98,
    promedio_ph: 7.15,
    promedio_cloro_residual: 0.49,
    porcentaje_ocupacion: 72.8
}
```

---

# 17. Consistencia del Computed Pattern

`$jsonSchema` puede verificar:

```text
tipos
campos obligatorios
rangos
estructura
```

pero no puede calcular automáticamente que:

```text
cantidad_mediciones
=
mediciones.length
```

ni que:

```text
suma_ph
=
suma real de mediciones.ph
```

ni que:

```text
promedio_ph
=
suma_ph / cantidad_mediciones
```

Por tanto, la aplicación que actualice el bucket debe conservar la consistencia entre:

```text
mediciones
calculados
ultima_medicion
```

Las pruebas DBA verifican esta regla utilizando documentos de prueba controlados.

---

# 18. `ultima_medicion`

`ultima_medicion` es un snapshot de la última lectura disponible dentro del bucket.

Evita tener que recorrer el array completo para obtener el estado más reciente.

Estructura:

```javascript
ultima_medicion: {
    fecha_hora: Date,
    ph: Number,
    cloro_residual: Number,
    personas_alojadas: Int32,
    porcentaje_ocupacion: Number
}
```

Conceptualmente debe representar la medición con fecha/hora más reciente.

---

# 19. `estado_actual`

`estado_actual` representa un snapshot persistente del estado calculado del albergue.

En la migración 008 es:

```text
OPCIONAL
```

porque todavía no se han creado las colecciones:

```text
alertas
estados_semaforo
```

La estructura queda preparada desde esta etapa para evitar redefinir el modelo base posteriormente.

Contiene:

```text
agua
hacinamiento
semaforo_vital
alertas_activas
```

---

## 19.1 Agua

```javascript
agua: {
    nivel: String
}
```

Representará el estado calculado asociado al componente de agua.

---

## 19.2 Hacinamiento

```javascript
hacinamiento: {
    nivel: String
}
```

Representará el estado calculado asociado a ocupación/hacinamiento.

---

## 19.3 Semáforo Vital

```javascript
semaforo_vital: {
    nivel: String,
    codigo: Int32,
    estado_semaforo_id: ObjectId,
    fecha_calculo: Date
}
```

`estado_semaforo_id` será una referencia lógica futura hacia:

```text
estados_semaforo._id
```

---

## 19.4 Alertas activas

```javascript
alertas_activas: {
    cantidad: Int32,
    ids: [
        ObjectId
    ]
}
```

Los identificadores serán referencias lógicas futuras hacia:

```text
alertas._id
```

El array `ids` utiliza:

```text
uniqueItems: true
```

---

# 20. Separación entre colecciones

La arquitectura establece la siguiente separación:

```text
registros_diarios
    → consolidado oficial diario

metricas_albergue.mediciones
    → telemetría intradía

metricas_albergue.calculados
    → valores precalculados del bucket

metricas_albergue.ultima_medicion
    → última lectura disponible

metricas_albergue.estado_actual
    → snapshot persistente calculado

estados_semaforo
    → estado oficial e histórico
      (colección futura)

alertas
    → alertas oficiales e históricas
      (colección futura)

Redis
    → caché temporal
      (integración posterior)
```

`metricas_albergue` no reemplaza:

```text
registros_diarios
```

y tampoco reemplazará:

```text
estados_semaforo
alertas
```

---

# 21. Índice del Bucket Pattern

Existe el índice:

```text
ux_metricas_albergue_albergue_fecha_bucket
```

Definición:

```javascript
{
    albergue_id: 1,
    fecha_bucket: 1
}
```

Configuración:

```text
unique: true
```

Garantiza:

> Un solo bucket por albergue y fecha_bucket.

La migración verifica previamente que no existan duplicados antes de crear el índice.

---

# 22. Referencias lógicas de `metricas_albergue`

Actualmente:

```text
metricas_albergue.albergue_id
    → albergues._id
```

La migración 008 verifica documentos huérfanos mediante:

```text
$lookup
```

Las referencias futuras:

```text
estado_actual.semaforo_vital.estado_semaforo_id
    → estados_semaforo._id

estado_actual.alertas_activas.ids
    → alertas._id
```

serán validadas referencialmente cuando dichas colecciones sean implementadas.

No deben simularse actualmente mediante colecciones ficticias.

---

# 23. Manejo de fechas

Zona horaria funcional:

```text
America/Bogota
```

`fecha_bucket` representa el día operativo.

Ejemplo:

```text
2026-11-12 00:00 America/Bogota
```

se almacena como:

```text
2026-11-12T05:00:00.000Z
```

`fecha_hora` representa el instante real de cada medición.

`created_at` y `updated_at` representan trazabilidad técnica del documento bucket.

---

# 24. Integridad referencial general

Referencias actuales:

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

intervenciones.albergue_id
    → albergues._id

intervenciones.registrado_por
    → usuarios._id

intervenciones.updated_by
    → usuarios._id

metricas_albergue.albergue_id
    → albergues._id
```

MongoDB `$jsonSchema` valida tipos BSON, pero no implementa foreign keys.

Los controles DBA complementan la validación mediante `$lookup`.

---

# 25. Pruebas DBA

## Validaciones originales

```text
database/mongodb/tests/test_validaciones.js
```

```text
8/8
```

---

## Integridad QA

```text
database/mongodb/tests/test_integridad_qa.js
```

```text
12/12
```

---

## Condiciones sanitarias

```text
database/mongodb/tests/test_condiciones_sanitarias.js
```

```text
14/14
```

---

## Casos de enfermedades

```text
database/mongodb/tests/test_casos_enfermedades.js
```

```text
14/14
```

---

## Intervenciones

```text
database/mongodb/tests/test_intervenciones.js
```

```text
15/15
```

---

## Métricas de albergue

```text
database/mongodb/tests/test_metricas_albergue.js
```

Resultado validado:

```text
Pruebas exitosas: 18
Pruebas fallidas: 0
```

La suite valida:

1. bucket válido;
2. obligatoriedad de `albergue_id`;
3. obligatoriedad de `fecha_bucket`;
4. obligatoriedad de `mediciones`;
5. array `mediciones` no vacío;
6. rechazo de pH negativo;
7. rechazo de cloro residual negativo;
8. `personas_alojadas` como Int32;
9. ocupación superior a 100 permitida;
10. `cantidad_mediciones >= 1`;
11. obligatoriedad de `ultima_medicion`;
12. rechazo de propiedades adicionales;
13. unicidad de albergue + fecha_bucket;
14. índice único del Bucket Pattern;
15. `estado_actual` opcional;
16. estructura válida de `estado_actual`;
17. detección de referencia huérfana mediante `$lookup`;
18. consistencia del documento Bucket + Computed de prueba.

Las pruebas fueron ejecutadas nuevamente después de actualizar:

```text
init_semaforo_vital.js
```

y conservaron:

```text
18/18
```

---

# 26. Índices vigentes

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

## `intervenciones`

```text
ix_intervenciones_albergue_fecha
ix_intervenciones_albergue_tipo_fecha
```

No únicos.

## `metricas_albergue`

```text
ux_metricas_albergue_albergue_fecha_bucket
```

Único.

## `schema_migrations`

```text
ux_schema_migrations_version
```

Único.

---

# 27. Seguridad

No deben versionarse:

- contraseñas;
- credenciales;
- URI privadas;
- tokens;
- secretos.

`metricas_albergue` almacena información agregada y operacional del albergue.

No debe utilizarse para almacenar:

```text
identificación de pacientes
historias clínicas
datos clínicos individualizados
credenciales
secretos
```

---

# 28. Reglas para evolución

Todo cambio nuevo debe seguir:

```text
análisis
    ↓
migración
    ↓
pruebas
    ↓
init
    ↓
documentación
    ↓
commit
    ↓
Pull Request
```

Las migraciones aplicadas no deben modificarse retroactivamente.

Si una regla funcional aún no está definida, no debe convertirse unilateralmente en una restricción estructural.

---

# 29. Estado actual

Colecciones:

```text
usuarios                        ✓
albergues                       ✓
registros_diarios               ✓
condiciones_sanitarias          ✓
casos_enfermedades              ✓
intervenciones                  ✓
metricas_albergue               ✓
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
007_create_intervenciones                 ✓
008_create_metricas_albergue              ✓
```

Pruebas específicas recientes:

```text
condiciones_sanitarias     14/14
casos_enfermedades         14/14
intervenciones             15/15
metricas_albergue          18/18
```

El estado estructural vigente se encuentra en:

```text
database/mongodb/init/init_semaforo_vital.js
```

La evolución histórica se encuentra en:

```text
database/mongodb/migrations/
```

La colección:

```text
metricas_albergue
```

constituye la implementación vigente de:

```text
Bucket Pattern
+
Computed Pattern
```

para telemetría intradía del proyecto Semáforo Vital.