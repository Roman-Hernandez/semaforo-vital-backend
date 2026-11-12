# MongoDB - Semáforo Vital

## Infraestructura de persistencia MongoDB

Este directorio contiene la infraestructura MongoDB del proyecto **Semáforo Vital**.

La implementación inicial fue desarrollada en la US-08 y posteriormente ha evolucionado mediante migraciones versionadas, validadores `$jsonSchema`, índices, controles de integridad, patrones de modelado documental y pruebas DBA.

La solución utiliza **MongoDB Atlas** como motor documental persistente y scripts versionados dentro del repositorio backend para garantizar que la estructura pueda reproducirse y evolucionar de forma controlada.

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

Actualmente se encuentran implementadas:

```text
usuarios
albergues
registros_diarios
condiciones_sanitarias
casos_enfermedades
intervenciones
metricas_albergue
analisis_ia
schema_migrations
```

`schema_migrations` es una colección técnica utilizada para controlar la evolución versionada del modelo.

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
    │   └── 009_create_analisis_ia.js
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
    │   └── test_analisis_ia.js
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

# 4. Migraciones

Cada cambio estructural debe implementarse mediante una migración versionada.

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
    ↓
009
Análisis IA histórico
```

---

# 6. Requisitos

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

# 7. Variables de entorno

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

# 8. Colección `usuarios`

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

# 9. Colección `albergues`

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

# 10. Colección `registros_diarios`

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

# 11. Colección `condiciones_sanitarias`

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

# 12. Colección `casos_enfermedades`

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

# 13. Colección `intervenciones`

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

# 14. Colección `metricas_albergue`

Incorporada mediante:

```text
008_create_metricas_albergue.js
```

Implementa:

```text
Bucket Pattern
Computed Pattern
```

para almacenar telemetría intradía agrupada por albergue y día.

La regla estructural es:

```text
1 documento
=
1 albergue
+
1 fecha_bucket
```

Estructura principal:

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

Índice:

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

Único.

`estado_actual` permanece opcional hasta la implementación de:

```text
alertas
estados_semaforo
```

---

# 15. Colección `analisis_ia`

Incorporada mediante:

```text
009_create_analisis_ia.js
```

## 15.1 Propósito

Almacena el resultado histórico de ejecuciones de modelos de inteligencia artificial.

La colección sigue una regla fundamental:

```text
cada ejecución IA
=
nuevo documento
```

No se sobrescriben resultados históricos.

---

## 15.2 Estructura

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
        registros_diarios_ids: [
            ObjectId
        ],

        condiciones_sanitarias_ids: [
            ObjectId
        ],

        casos_enfermedades_ids: [
            ObjectId
        ],

        intervenciones_ids: [
            ObjectId
        ],

        metricas_albergue_ids: [
            ObjectId
        ]
    },

    preprocesamiento: {
        registros_considerados: Int32,
        registros_descartados: Int32,

        datos_faltantes: [
            {
                campo: String,
                cantidad: Int32,
                tratamiento: String
            }
        ]
    },

    resultado: {
        probabilidad_riesgo: Number
    },

    registrado_por: ObjectId,

    created_at: Date
}
```

---

# 16. Naturaleza histórica de `analisis_ia`

`analisis_ia` es una colección histórica.

Ejemplo:

```text
Modelo v1.0.0
Albergue A
Ejecución 10:00
    ↓
Documento A

Modelo v1.0.0
Albergue A
Ejecución 11:00
    ↓
Documento B
```

Ambos documentos deben conservarse.

Por esta razón no existen índices únicos sobre:

```text
albergue_id
fecha_ejecucion
modelo.nombre
modelo.version
```

La colección tampoco utiliza:

```text
updated_at
updated_by
```

como parte del contrato vigente.

---

# 17. Identificación del modelo IA

Cada ejecución registra:

```javascript
modelo: {
    nombre: String,
    version: String
}
```

Ejemplo:

```javascript
modelo: {
    nombre: "riesgo_sanitario",
    version: "1.0.0"
}
```

Esto permite reproducir y auditar posteriormente qué versión del modelo produjo cada resultado.

---

# 18. Periodo analizado

Cada ejecución registra:

```javascript
periodo_analizado: {
    fecha_inicio: Date,
    fecha_fin: Date
}
```

Regla conceptual:

```text
fecha_inicio <= fecha_fin
```

`$jsonSchema` garantiza que ambos campos sean `Date`, pero la comparación entre ellos se controla mediante reglas DBA adicionales.

La migración 009 verifica documentos existentes con:

```text
$expr
```

---

# 19. Datos de entrada de IA

La trazabilidad de datos utilizados se conserva en:

```text
datos_entrada
```

Contiene:

```text
registros_diarios_ids
condiciones_sanitarias_ids
casos_enfermedades_ids
intervenciones_ids
metricas_albergue_ids
```

Relaciones:

```text
registros_diarios_ids[]
    → registros_diarios._id

condiciones_sanitarias_ids[]
    → condiciones_sanitarias._id

casos_enfermedades_ids[]
    → casos_enfermedades._id

intervenciones_ids[]
    → intervenciones._id

metricas_albergue_ids[]
    → metricas_albergue._id
```

Los arrays utilizan:

```text
uniqueItems: true
```

para evitar referencias duplicadas dentro de la misma ejecución.

Los arrays pueden estar vacíos.

No se impone todavía una cantidad mínima de documentos de entrada porque no existe una regla funcional aprobada que la determine.

---

# 20. Preprocesamiento IA

Cada análisis registra información del procesamiento previo.

Estructura:

```javascript
preprocesamiento: {
    registros_considerados: Int32,
    registros_descartados: Int32,

    datos_faltantes: [
        {
            campo: String,
            cantidad: Int32,
            tratamiento: String
        }
    ]
}
```

Reglas:

```text
registros_considerados >= 0
registros_descartados >= 0
datos_faltantes[].cantidad >= 0
```

No existe actualmente un `enum` para:

```text
tratamiento
```

porque el catálogo funcional de métodos de preprocesamiento todavía no ha sido aprobado.

---

# 21. Resultado del análisis IA

La estructura vigente es:

```javascript
resultado: {
    probabilidad_riesgo: Number
}
```

Regla:

```text
0 <= probabilidad_riesgo <= 1
```

Ejemplo:

```javascript
resultado: {
    probabilidad_riesgo: 0.73
}
```

Esta probabilidad:

> No representa directamente el color del Semáforo Vital.

La transformación hacia:

```text
verde
amarillo
rojo
```

corresponderá posteriormente a:

```text
alertas
estados_semaforo
```

---

# 22. `escenario_id`

`escenario_id` es actualmente opcional.

Si existe debe ser:

```text
ObjectId
```

La referencia futura será:

```text
analisis_ia.escenario_id
    → escenarios._id
```

Actualmente no se realiza `$lookup` contra `escenarios` porque esa colección todavía no ha sido implementada.

No se crean dependencias ficticias.

---

# 23. Índices de `analisis_ia`

Índice:

```text
ix_analisis_ia_albergue_fecha
```

Definición:

```javascript
{
    albergue_id: 1,
    fecha_ejecucion: -1
}
```

No único.

Segundo índice:

```text
ix_analisis_ia_modelo_version_fecha
```

Definición:

```javascript
{
    "modelo.nombre": 1,
    "modelo.version": 1,
    fecha_ejecucion: -1
}
```

No único.

Esto permite consultar:

- historial de análisis por albergue;
- ejecuciones recientes;
- resultados por modelo;
- resultados por versión.

---

# 24. Separación conceptual IA y Semáforo Vital

La arquitectura conserva separación entre:

```text
analisis_ia
    → resultado analítico

alertas
    → alertas oficiales

estados_semaforo
    → estado oficial del Semáforo Vital
```

Por tanto:

```text
probabilidad IA
≠
estado oficial
```

Esto evita mezclar resultados estadísticos o predictivos con decisiones funcionales del sistema.

---

# 25. Manejo de fechas

Zona horaria funcional:

```text
America/Bogota
```

MongoDB almacena `Date` como instantes UTC.

Campos funcionales y analíticos:

```text
fecha
fecha_intervencion
fecha_bucket
fecha_ejecucion
periodo_analizado.fecha_inicio
periodo_analizado.fecha_fin
```

Campos técnicos:

```text
created_at
updated_at
fecha_hora
fecha_calculo
```

---

# 26. Integridad referencial

Referencias vigentes:

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

condiciones_sanitarias.albergue_id
    → albergues._id

condiciones_sanitarias.registrado_por
    → usuarios._id

casos_enfermedades.albergue_id
    → albergues._id

casos_enfermedades.registrado_por
    → usuarios._id

intervenciones.albergue_id
    → albergues._id

intervenciones.registrado_por
    → usuarios._id

metricas_albergue.albergue_id
    → albergues._id

analisis_ia.albergue_id
    → albergues._id

analisis_ia.registrado_por
    → usuarios._id

analisis_ia.datos_entrada.registros_diarios_ids[]
    → registros_diarios._id

analisis_ia.datos_entrada.condiciones_sanitarias_ids[]
    → condiciones_sanitarias._id

analisis_ia.datos_entrada.casos_enfermedades_ids[]
    → casos_enfermedades._id

analisis_ia.datos_entrada.intervenciones_ids[]
    → intervenciones._id

analisis_ia.datos_entrada.metricas_albergue_ids[]
    → metricas_albergue._id
```

MongoDB `$jsonSchema` valida tipos BSON pero no implementa claves foráneas.

Los controles DBA complementan esta limitación mediante `$lookup`.

---

# 27. Pruebas DBA

## Validaciones originales

```text
test_validaciones.js
8/8
```

## Integridad QA

```text
test_integridad_qa.js
12/12
```

## Condiciones sanitarias

```text
test_condiciones_sanitarias.js
14/14
```

## Casos de enfermedades

```text
test_casos_enfermedades.js
14/14
```

## Intervenciones

```text
test_intervenciones.js
15/15
```

## Métricas de albergue

```text
test_metricas_albergue.js
18/18
```

## Análisis IA

```text
test_analisis_ia.js
20/20
```

---

# 28. Pruebas de `analisis_ia`

La suite:

```text
database/mongodb/tests/test_analisis_ia.js
```

valida:

1. documento válido;
2. `albergue_id` obligatorio;
3. `fecha_ejecucion` obligatoria;
4. `periodo_analizado` obligatorio;
5. nombre de modelo no vacío;
6. probabilidad menor que 0 rechazada;
7. probabilidad mayor que 1 rechazada;
8. `registrado_por` como ObjectId;
9. registros descartados no negativos;
10. referencias duplicadas rechazadas;
11. propiedades adicionales rechazadas;
12. `updated_at` rechazado;
13. `escenario_id` opcional;
14. `escenario_id` como ObjectId;
15. múltiples ejecuciones históricas permitidas;
16. índices correctos y no únicos;
17. detección de albergue huérfano;
18. detección de usuario huérfano;
19. detección de referencia huérfana de entrada;
20. detección de periodo temporal inválido.

Resultado:

```text
Pruebas exitosas: 20
Pruebas fallidas: 0
```

Las pruebas fueron repetidas después de ejecutar nuevamente:

```text
init_semaforo_vital.js
```

manteniendo:

```text
20/20
```

---

# 29. Índices vigentes

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

## `analisis_ia`

```text
ix_analisis_ia_albergue_fecha
ix_analisis_ia_modelo_version_fecha
```

No únicos.

## `schema_migrations`

```text
ux_schema_migrations_version
```

Único.

---

# 30. Seguridad

No deben versionarse:

- contraseñas;
- credenciales;
- URI privadas;
- tokens;
- secretos.

`analisis_ia` debe trabajar con información agregada y referencias documentales.

No debe almacenar:

```text
nombres de pacientes
documentos de identidad
historias clínicas
datos sensibles individualizados
credenciales
secretos
```

---

# 31. Reglas para evolución

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

# 32. Estado actual

Colecciones:

```text
usuarios                        ✓
albergues                       ✓
registros_diarios               ✓
condiciones_sanitarias          ✓
casos_enfermedades              ✓
intervenciones                  ✓
metricas_albergue               ✓
analisis_ia                     ✓
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
```

Pruebas específicas recientes:

```text
condiciones_sanitarias     14/14
casos_enfermedades         14/14
intervenciones             15/15
metricas_albergue          18/18
analisis_ia                20/20
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
analisis_ia
```

deja preparada la capa persistente para resultados analíticos reproducibles antes de avanzar hacia:

```text
predicciones_sir
alertas
estados_semaforo
```