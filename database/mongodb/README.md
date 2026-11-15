# MongoDB - Semáforo Vital

## Infraestructura de persistencia MongoDB

Este directorio contiene la infraestructura MongoDB del proyecto **Semáforo Vital**.

La solución utiliza **MongoDB Atlas** como fuente persistente de datos y mantiene su evolución mediante:

- migraciones versionadas;
- validadores `$jsonSchema`;
- índices;
- controles de integridad;
- pruebas DBA;
- documentación del contrato de datos;
- un script `init` que representa el estado estructural vigente.

---

# 1. Base de datos

```text
semaforo_vital
```

## Cluster de desarrollo

```text
semaforo-vital-dev
```

## Colecciones implementadas

```text
usuarios
albergues
registros_diarios
historial_poblacion
condiciones_sanitarias
casos_enfermedades
intervenciones
metricas_albergue
analisis_ia
predicciones_sir
alertas
schema_migrations
```

`schema_migrations` es una colección técnica utilizada para controlar la evolución estructural.

---

# 2. Estructura del directorio

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
    │   ├── 008_create_metricas_albergue.js
    │   ├── 009_create_analisis_ia.js
    │   ├── 010_create_historial_poblacion.js
    │   ├── 011_create_predicciones_sir.js
    │   └── 012_create_alertas.js
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
    │   ├── test_metricas_albergue.js
    │   ├── test_analisis_ia.js
    │   ├── test_historial_poblacion.js
    │   ├── test_predicciones_sir.js
    │   └── test_alertas.js
    │
    ├── docs/
    │   ├── evidencias_US-08.md
    │   └── contrato_datos_backend.md
    │
    ├── migrate.py
    └── README.md
```

---

# 3. Inicialización estructural

Archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

Representa el **estado estructural vigente** de MongoDB.

Su responsabilidad es:

- crear colecciones inexistentes;
- actualizar validadores mediante `collMod`;
- establecer validación estricta;
- crear o verificar índices;
- permitir ejecución repetida;
- representar el modelo estructural actual para instalaciones nuevas.

Actualmente reproduce:

```text
usuarios
albergues
registros_diarios
historial_poblacion
condiciones_sanitarias
casos_enfermedades
intervenciones
metricas_albergue
analisis_ia
predicciones_sir
alertas
schema_migrations
```

El `init` no sustituye las migraciones y no ejecuta transformaciones históricas.

---

# 4. Migraciones

Orquestador:

```text
database/mongodb/migrate.py
```

Ejecución:

```powershell
python -m database.mongodb.migrate
```

El orquestador:

1. identifica archivos `NNN_*.js`;
2. los ordena;
3. consulta `schema_migrations`;
4. determina cuáles están pendientes;
5. ejecuta cada migración mediante `mongosh`;
6. verifica su registro.

Una migración aplicada no debe modificarse retroactivamente.

---

# 5. Migraciones vigentes

```text
001_fix_colombia_timezone.js
002_create_usuarios.js
003_harden_data_integrity.js
004_add_update_traceability.js
005_create_condiciones_sanitarias.js
006_create_casos_enfermedades.js
007_create_intervenciones.js
008_create_metricas_albergue.js
009_create_analisis_ia.js
010_create_historial_poblacion.js
011_create_predicciones_sir.js
012_create_alertas.js
```

Evolución:

```text
001 Zona horaria
 ↓
002 Usuarios
 ↓
003 Integridad
 ↓
004 Trazabilidad
 ↓
005 Condiciones sanitarias
 ↓
006 Casos de enfermedades
 ↓
007 Intervenciones
 ↓
008 metricas_albergue
    Bucket Pattern + Computed Pattern
 ↓
009 analisis_ia
 ↓
010 historial_poblacion
 ↓
011 predicciones_sir
 ↓
012 alertas
```

La migración 001 es legacy y fue aplicada antes de existir `schema_migrations`.

El siguiente número disponible es:

```text
013
```

siempre que no se integre otra migración en `main` antes del siguiente checkpoint.

---

# 6. Variables de entorno

```env
MONGODB_URI=
MONGODB_DB=semaforo_vital
APP_TIMEZONE=America/Bogota
```

MongoDB utiliza fechas BSON `Date`.

La zona horaria funcional de la aplicación es:

```text
America/Bogota
```

No deben versionarse:

- credenciales;
- contraseñas;
- URI privadas;
- tokens;
- secretos.

---

# 7. `usuarios`

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

Las contraseñas se almacenan únicamente como hash.

---

# 8. `albergues`

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
            coordinates: [Number, Number]
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

# 9. `registros_diarios`

Consolidado diario histórico.

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

```text
1 albergue + 1 fecha
=
1 registro diario
```

Índice:

```text
ux_registros_diarios_albergue_fecha
```

Único.

`casos_eda` y `casos_ira` representan casos nuevos del día.

`poblacion` permanece por compatibilidad histórica.

---

# 10. `historial_poblacion`

Incorporada mediante:

```text
010_create_historial_poblacion.js
```

Es la fuente persistente oficial de población diaria.

```javascript
{
    _id: ObjectId,
    albergue_id: ObjectId,
    fecha: Date,
    poblacion: Int32,
    registrado_por: ObjectId,
    created_at: Date,
    updated_at: Date,
    updated_by: ObjectId
}
```

Reglas:

```text
poblacion >= 0

1 albergue + 1 fecha
=
1 registro poblacional
```

Índice:

```text
ux_historial_poblacion_albergue_fecha
```

Único.

Arquitectura:

```text
historial_poblacion
    → población diaria oficial

registros_diarios.poblacion
    → valor histórico embebido

metricas_albergue
    → telemetría y ocupación intradía
```

---

# 11. `condiciones_sanitarias`

```javascript
{
    _id: ObjectId,
    albergue_id: ObjectId,
    fecha: Date,

    agua_potable_disponible: Boolean,
    banos_disponibles: Int32,

    estado_higiene: String,
    estado_saneamiento: String,

    otros_recursos_sanitarios: Array,
    observaciones: String,

    fuente_datos: String,

    registrado_por: ObjectId,
    created_at: Date,
    updated_at: Date,
    updated_by: ObjectId
}
```

Índice:

```text
ix_condiciones_sanitarias_albergue_fecha
```

Los catálogos de higiene, saneamiento y fuente permanecen abiertos hasta definición funcional.

---

# 12. `casos_enfermedades`

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

Semántica:

```text
cantidad_casos_activos
=
personas que presentan activamente la enfermedad
en la fecha del registro
```

No representa nuevos casos ni acumulados.

Índices:

```text
ix_casos_enfermedades_albergue_fecha
ix_casos_enfermedades_albergue_enfermedad_fecha
```

---

# 13. `intervenciones`

Almacena únicamente intervenciones reales.

```javascript
{
    _id: ObjectId,
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
escenarios hipotéticos
acciones simuladas
intervenciones propuestas
```

Índices:

```text
ix_intervenciones_albergue_fecha
ix_intervenciones_albergue_tipo_fecha
```

---

# 14. `metricas_albergue`

Incorporada mediante:

```text
008_create_metricas_albergue.js
```

Implementa:

```text
Bucket Pattern
Computed Pattern
```

Unidad documental:

```text
1 albergue + 1 fecha_bucket
```

Contiene:

```text
mediciones[]
calculados
ultima_medicion
estado_actual
created_at
updated_at
```

Índice:

```text
ux_metricas_albergue_albergue_fecha_bucket
```

Único.

`estado_actual` es opcional.

Dentro del snapshot existe:

```text
metricas_albergue
    .estado_actual
    .alertas_activas
    .ids[]
```

A partir de la migración 012, esa referencia tiene como colección destino:

```text
alertas._id
```

La referencia:

```text
metricas_albergue
    .estado_actual
    .semaforo_vital
    .estado_semaforo_id
```

continúa pendiente hasta implementar:

```text
estados_semaforo
```

---

# 15. `analisis_ia`

Colección histórica.

Regla:

```text
1 ejecución IA
=
1 documento nuevo
```

No utiliza:

```text
updated_at
updated_by
```

Estructura resumida:

```javascript
{
    _id: ObjectId,
    albergue_id: ObjectId,
    escenario_id: ObjectId,
    fecha_ejecucion: Date,

    periodo_analizado: {
        fecha_inicio: Date,
        fecha_fin: Date
    },

    modelo: {
        nombre: String,
        version: String
    },

    datos_entrada: {
        registros_diarios_ids: [ObjectId],
        condiciones_sanitarias_ids: [ObjectId],
        casos_enfermedades_ids: [ObjectId],
        intervenciones_ids: [ObjectId],
        metricas_albergue_ids: [ObjectId]
    },

    preprocesamiento: {
        registros_considerados: Int32,
        registros_descartados: Int32,
        datos_faltantes: Array
    },

    resultado: {
        probabilidad_riesgo: Number
    },

    registrado_por: ObjectId,
    created_at: Date
}
```

Regla:

```text
0 <= probabilidad_riesgo <= 1
```

---

# 16. `predicciones_sir`

Incorporada mediante:

```text
011_create_predicciones_sir.js
```

Colección histórica.

```text
1 ejecución SIR
=
1 documento nuevo
```

Estructura resumida:

```javascript
{
    _id: ObjectId,

    albergue_id: ObjectId,
    escenario_id: ObjectId,

    fecha_ejecucion: Date,
    enfermedad: String,
    publica: Boolean,

    modelo: {
        nombre: String,
        version: String
    },

    parametros: {
        beta: Number,
        gamma: Number,

        condiciones_iniciales: {
            susceptibles: Int32,
            infectados: Int32,
            recuperados: Int32
        },

        horizonte_dias: Int32,
        metodo_numerico: String
    },

    datos_entrada: {
        analisis_ia_id: ObjectId,
        historial_poblacion_ids: [ObjectId],
        casos_enfermedades_ids: [ObjectId]
    },

    preprocesamiento: {
        registros_considerados: Int32,
        registros_descartados: Int32,
        observaciones: String
    },

    trayectoria: [
        {
            dia: Int32,
            susceptibles: Number,
            infectados: Number,
            recuperados: Number
        }
    ],

    registrado_por: ObjectId,
    created_at: Date
}
```

Reglas principales:

```text
beta >= 0
gamma >= 0
horizonte_dias >= 1
S >= 0
I >= 0
R >= 0
```

La fuente poblacional principal es:

```text
historial_poblacion
```

No se imponen todavía mediante `$jsonSchema` reglas como:

```text
S + I + R = N
trayectoria.length = horizonte_dias + 1
conservación poblacional
secuencia exacta de días
```

---

# 17. `alertas`

Incorporada mediante:

```text
012_create_alertas.js
```

## Propósito

Conservar las alertas sanitarias y epidemiológicas generadas para los albergues, incluyendo:

- nivel de riesgo;
- tipo;
- mensaje;
- estado activa/inactiva;
- visibilidad pública;
- referencias hacia los datos de origen;
- trazabilidad de creación y actualización.

## Estructura

```javascript
{
    _id: ObjectId,

    albergue_id: ObjectId,

    fecha_alerta: Date,

    nivel_riesgo: String,

    tipo_alerta: String,

    mensaje: String,

    activa: Boolean,

    publica: Boolean,

    datos_origen: {

        condicion_sanitaria_id: ObjectId,

        casos_enfermedades_ids: [
            ObjectId
        ],

        prediccion_sir_id: ObjectId
    },

    fuente_datos: String,

    registrado_por: ObjectId,

    created_at: Date,

    updated_at: Date,

    updated_by: ObjectId
}
```

## Nivel de riesgo

`nivel_riesgo` utiliza el catálogo cerrado:

```text
verde
amarillo
rojo
```

No representa todavía la fuente histórica oficial del Semáforo Vital.

Esa responsabilidad corresponderá a:

```text
estados_semaforo
```

## Ciclo de vida

Las alertas no se eliminan como operación funcional ordinaria.

Pueden cambiar:

```text
activa = true
        ↓
activa = false
```

La alerta continúa existiendo como histórico.

Por ello pueden utilizarse:

```text
updated_at
updated_by
```

## Visibilidad pública

```text
publica
```

es un marcador funcional.

No sustituye los controles de autorización de Backend.

## Tipo de alerta

```text
tipo_alerta
```

permanece como `String` abierto.

No existe todavía un catálogo aprobado.

Por tanto no se utiliza `enum`.

## Fuente de datos

```text
fuente_datos
```

también permanece como `String` abierto hasta definición funcional.

## Datos de origen

Las referencias posibles son:

```text
datos_origen.condicion_sanitaria_id
    → condiciones_sanitarias._id

datos_origen.casos_enfermedades_ids[]
    → casos_enfermedades._id

datos_origen.prediccion_sir_id
    → predicciones_sir._id
```

Las referencias internas son opcionales.

`casos_enfermedades_ids` utiliza:

```text
uniqueItems: true
```

Cuando una referencia existe debe pertenecer al mismo albergue indicado por:

```text
alertas.albergue_id
```

Esta coherencia se controla mediante pruebas DBA y deberá ser garantizada también por Backend.

## Campos deliberadamente no incorporados

Actualmente no forman parte del contrato:

```text
prioridad
datos_origen.analisis_ia_id
```

No existe un catálogo funcional de prioridad de alertas.

Tampoco existe todavía una definición aprobada para que una alerta referencie directamente `analisis_ia`.

## Índices

```text
ix_alertas_albergue_fecha
```

```javascript
{
    albergue_id: 1,
    fecha_alerta: -1
}
```

```text
ix_alertas_albergue_activa_fecha
```

```javascript
{
    albergue_id: 1,
    activa: 1,
    fecha_alerta: -1
}
```

```text
ix_alertas_nivel_activa
```

```javascript
{
    nivel_riesgo: 1,
    activa: 1
}
```

Los tres son no únicos.

---

# 18. Relaciones lógicas principales

```text
usuarios.albergue_id
    → albergues._id

albergues.registrado_por
    → usuarios._id

registros_diarios.albergue_id
    → albergues._id

historial_poblacion.albergue_id
    → albergues._id

condiciones_sanitarias.albergue_id
    → albergues._id

casos_enfermedades.albergue_id
    → albergues._id

intervenciones.albergue_id
    → albergues._id

metricas_albergue.albergue_id
    → albergues._id

analisis_ia.albergue_id
    → albergues._id

predicciones_sir.albergue_id
    → albergues._id

alertas.albergue_id
    → albergues._id
```

Referencias analíticas:

```text
predicciones_sir.datos_entrada.historial_poblacion_ids[]
    → historial_poblacion._id

predicciones_sir.datos_entrada.casos_enfermedades_ids[]
    → casos_enfermedades._id

predicciones_sir.datos_entrada.analisis_ia_id
    → analisis_ia._id
```

Referencias de alertas:

```text
alertas.datos_origen.condicion_sanitaria_id
    → condiciones_sanitarias._id

alertas.datos_origen.casos_enfermedades_ids[]
    → casos_enfermedades._id

alertas.datos_origen.prediccion_sir_id
    → predicciones_sir._id
```

Snapshot:

```text
metricas_albergue.estado_actual.alertas_activas.ids[]
    → alertas._id
```

MongoDB `$jsonSchema` valida estructura y tipos, pero no implementa foreign keys.

Las referencias se revisan mediante `$lookup`.

---

# 19. Pruebas DBA

Resultados vigentes:

```text
test_validaciones.js                8/8
test_integridad_qa.js              12/12
test_condiciones_sanitarias.js     14/14
test_casos_enfermedades.js         14/14
test_intervenciones.js             15/15
test_metricas_albergue.js          18/18
test_analisis_ia.js                20/20
test_historial_poblacion.js        18/18
test_predicciones_sir.js           35/35
test_alertas.js                    40/40
```

## Suite `alertas`

Valida:

- documento válido;
- campos obligatorios;
- enum verde/amarillo/rojo;
- `tipo_alerta`;
- `mensaje`;
- Boolean `activa`;
- Boolean `publica`;
- `datos_origen`;
- `fuente_datos`;
- trazabilidad;
- `additionalProperties: false`;
- `uniqueItems`;
- ciclo activa → inactiva;
- alertas públicas;
- referencias hacia condiciones sanitarias;
- referencias hacia casos;
- referencias hacia SIR;
- referencias huérfanas;
- coherencia del albergue;
- los tres índices;
- migración 012;
- múltiples alertas simultáneas;
- ausencia deliberada de `prioridad`;
- ausencia deliberada de `analisis_ia_id`;
- catálogos abiertos de tipo y fuente.

Resultado:

```text
Pruebas exitosas: 40
Pruebas fallidas: 0
```

Después de reejecutar `init_semaforo_vital.js`:

```text
40/40
```

---

# 20. Índices vigentes

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

## `historial_poblacion`

```text
ux_historial_poblacion_albergue_fecha
```

## `condiciones_sanitarias`

```text
ix_condiciones_sanitarias_albergue_fecha
```

## `casos_enfermedades`

```text
ix_casos_enfermedades_albergue_fecha
ix_casos_enfermedades_albergue_enfermedad_fecha
```

## `intervenciones`

```text
ix_intervenciones_albergue_fecha
ix_intervenciones_albergue_tipo_fecha
```

## `metricas_albergue`

```text
ux_metricas_albergue_albergue_fecha_bucket
```

## `analisis_ia`

```text
ix_analisis_ia_albergue_fecha
ix_analisis_ia_modelo_version_fecha
```

## `predicciones_sir`

```text
ix_predicciones_sir_albergue_fecha
ix_predicciones_sir_albergue_enfermedad_fecha
ix_predicciones_sir_modelo_version_fecha
```

## `alertas`

```text
ix_alertas_albergue_fecha
ix_alertas_albergue_activa_fecha
ix_alertas_nivel_activa
```

## `schema_migrations`

```text
ux_schema_migrations_version
```

---

# 21. Arquitectura de riesgo

La arquitectura actualmente queda:

```text
datos operativos
   │
   ├───────────────┐
   ▼               ▼
analisis_ia    predicciones_sir
                     │
                     ▼
                  alertas
                     │
                     ▼
            estados_semaforo
               PENDIENTE
                     │
                     ▼
      metricas_albergue.estado_actual
                     │
                     ▼
                  Redis
               PENDIENTE
```

Una alerta no constituye automáticamente el estado oficial del Semáforo Vital.

La futura colección:

```text
estados_semaforo
```

conservará ese historial.

---

# 22. Redis

Arquitectura aprobada:

```text
MongoDB
    → fuente persistente de verdad

metricas_albergue.estado_actual
    → snapshot persistente

Redis
    → caché temporal
```

Clave prevista:

```text
semaforo:estado:{albergue_id}
```

TTL inicial:

```text
900 segundos
```

Ante un cache miss o indisponibilidad de Redis:

```text
Backend
    → MongoDB
```

---

# 23. Responsabilidad DBA

DBA garantiza:

- validadores;
- tipos BSON;
- índices;
- migraciones;
- reproducibilidad;
- integridad estructural;
- controles de referencias huérfanas;
- trazabilidad;
- contratos documentales;
- pruebas;
- coherencia lógica verificable mediante `$lookup`.

DBA no implementa:

```text
algoritmo IA
algoritmo SIR
reglas automáticas de generación de alertas
clasificación final del Semáforo Vital
autorización de usuarios
```

---

# 24. Responsabilidad Backend

Backend deberá garantizar:

- referencias válidas antes de persistir;
- coherencia del albergue;
- fechas normalizadas;
- ejecución de lógica funcional;
- creación de alertas cuando corresponda;
- cierre lógico de alertas;
- no eliminación funcional de histórico;
- control de exposición pública;
- autorización;
- sincronización futura de snapshots y caché.

---

# 25. Seguridad

Las colecciones epidemiológicas y analíticas almacenan información agregada.

No deben persistir:

```text
nombres de pacientes
documentos de identidad
historias clínicas individuales
credenciales
contraseñas
tokens
secretos
```

---

# 26. Evolución del esquema

Todo cambio debe seguir:

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

Antes de crear una migración:

```powershell
git switch main
git pull origin main
```

y debe verificarse nuevamente la última migración existente.

---

# 27. Estado actual

```text
usuarios                        ✓
albergues                       ✓
registros_diarios               ✓
historial_poblacion             ✓
condiciones_sanitarias          ✓
casos_enfermedades              ✓
intervenciones                  ✓
metricas_albergue               ✓
analisis_ia                     ✓
predicciones_sir                ✓
alertas                         ✓
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
009_create_analisis_ia                    ✓
010_create_historial_poblacion            ✓
011_create_predicciones_sir               ✓
012_create_alertas                        ✓
```

Checkpoint 8:

```text
Colección alertas                                  ✓
Migración 012                                      ✓
Dependencia de migración 011                       ✓
nivel_riesgo verde/amarillo/rojo                   ✓
tipo_alerta abierto                                ✓
mensaje                                            ✓
activa/inactiva                                    ✓
publica                                            ✓
datos_origen                                       ✓
condicion_sanitaria_id                             ✓
casos_enfermedades_ids                             ✓
prediccion_sir_id                                  ✓
coherencia de albergue                             ✓
registrado_por                                     ✓
updated_by opcional                                ✓
3 índices históricos                               ✓
prioridad no inventada                             ✓
analisis_ia_id no incorporado sin aprobación       ✓
Init reproducible                                  ✓
Pruebas DBA                                      40/40
Documentación                                      ✓
```

Siguiente checkpoint estructural:

```text
estados_semaforo
```

Migración candidata:

```text
013_create_estados_semaforo.js
```

siempre que el número continúe disponible en `main`.