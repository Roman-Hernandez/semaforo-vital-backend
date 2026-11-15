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
historial_poblacion
condiciones_sanitarias
casos_enfermedades
intervenciones
metricas_albergue
analisis_ia
predicciones_sir
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
    │   ├── 009_create_analisis_ia.js
    │   ├── 010_create_historial_poblacion.js
    │   └── 011_create_predicciones_sir.js
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
    │   └── test_predicciones_sir.js
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

Actualmente el `init` reproduce estructuralmente:

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
schema_migrations
```

El `init` no ejecuta transformaciones históricas de datos.

En particular, el backfill desde:

```text
registros_diarios.poblacion
```

hacia:

```text
historial_poblacion
```

pertenece exclusivamente a:

```text
010_create_historial_poblacion.js
```

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
010_create_historial_poblacion.js
011_create_predicciones_sir.js
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
    ↓
010
Historial poblacional independiente
    ↓
011
Predicciones epidemiológicas SIR
```

Después de la migración 011, el siguiente número disponible es:

```text
012
```

si no se integra previamente otra migración autorizada.

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

Representa el consolidado diario histórico de cada albergue.

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

El campo:

```text
poblacion
```

se conserva dentro de esta colección por compatibilidad con el consolidado histórico existente.

A partir de la migración 010, los nuevos flujos poblacionales deben utilizar:

```text
historial_poblacion
```

como fuente persistente principal.

---

# 10.1 Colección `historial_poblacion`

Incorporada mediante:

```text
010_create_historial_poblacion.js
```

Almacena el historial oficial de población diaria de cada albergue.

Estructura:

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

Campos obligatorios:

```text
albergue_id
fecha
poblacion
registrado_por
created_at
```

Campos opcionales:

```text
updated_at
updated_by
```

Regla:

```text
1 albergue + 1 fecha
=
1 registro de población
```

Índice:

```text
ux_historial_poblacion_albergue_fecha
```

Definición:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

Único.

`poblacion` debe ser:

```text
Int32
```

con:

```text
poblacion >= 0
```

## Fuente oficial de población

La arquitectura vigente establece:

```text
historial_poblacion
    → población diaria oficial

registros_diarios.poblacion
    → población histórica embebida en el consolidado diario

metricas_albergue
    → telemetría y ocupación intradía
```

Una medición intradía no debe sobrescribir automáticamente la población oficial diaria.

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

Regla:

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

Almacena resultados históricos de ejecuciones de modelos de inteligencia artificial.

Regla:

```text
1 ejecución IA
=
1 documento nuevo
```

No se sobrescriben resultados históricos.

Estructura:

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

`resultado.probabilidad_riesgo` cumple:

```text
0 <= probabilidad_riesgo <= 1
```

La probabilidad IA no representa directamente:

```text
verde
amarillo
rojo
```

La transformación hacia el Semáforo Vital corresponde a capas posteriores.

---

# 15A. Colección `predicciones_sir`

Incorporada mediante:

```text
011_create_predicciones_sir.js
```

## Propósito

Almacena resultados históricos de simulaciones epidemiológicas mediante modelos SIR.

La colección conserva:

- albergue;
- enfermedad;
- fecha de ejecución;
- modelo y versión;
- parámetros epidemiológicos;
- condiciones iniciales;
- horizonte temporal;
- método numérico;
- fuentes utilizadas;
- información de preprocesamiento;
- trayectoria S/I/R;
- usuario asociado;
- fecha técnica de persistencia.

La regla principal es:

```text
1 ejecución SIR
=
1 documento nuevo
```

Las ejecuciones anteriores no deben sobrescribirse.

## Estructura

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

        historial_poblacion_ids: [
            ObjectId
        ],

        casos_enfermedades_ids: [
            ObjectId
        ]
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

## Naturaleza histórica

No forman parte del contrato:

```text
updated_at
updated_by
```

Dos ejecuciones pueden utilizar:

```text
mismo albergue
misma enfermedad
mismo modelo
misma versión
misma fecha_ejecucion
```

y seguir siendo documentos diferentes.

Por esa razón los índices de SIR son no únicos.

## Parámetros

Reglas estructurales:

```text
beta >= 0
gamma >= 0

susceptibles >= 0
infectados >= 0
recuperados >= 0

horizonte_dias >= 1
```

Las condiciones iniciales:

```text
susceptibles
infectados
recuperados
```

deben ser `Int32`.

`beta` y `gamma` admiten tipos numéricos BSON:

```text
double
int
long
decimal
```

No se aplica:

```text
maximum: 1
```

porque el contrato aprobado únicamente establece que sean no negativos.

## Método numérico

```text
parametros.metodo_numerico
```

es:

```text
String
```

no vacío.

Actualmente no existe un `enum`.

La definición del catálogo de métodos numéricos corresponde al componente matemático y permanece pendiente de definición funcional.

## Datos de entrada

La trazabilidad utiliza:

```text
historial_poblacion_ids[]
casos_enfermedades_ids[]
analisis_ia_id
```

Relaciones:

```text
predicciones_sir.datos_entrada.historial_poblacion_ids[]
    → historial_poblacion._id

predicciones_sir.datos_entrada.casos_enfermedades_ids[]
    → casos_enfermedades._id

predicciones_sir.datos_entrada.analisis_ia_id
    → analisis_ia._id
```

`analisis_ia_id` es opcional.

Los arrays utilizan:

```text
uniqueItems: true
```

No se impone actualmente:

```text
minItems: 1
```

porque el sistema deberá poder soportar posteriormente escenarios hipotéticos.

## Fuente poblacional

Para las variables de población del modelo SIR se utiliza:

```text
historial_poblacion
```

como fuente persistente principal.

No debe utilizarse como nueva fuente principal:

```text
registros_diarios.poblacion
```

## Trayectoria SIR

Cada elemento contiene:

```javascript
{
    dia: Int32,
    susceptibles: Number,
    infectados: Number,
    recuperados: Number
}
```

Reglas:

```text
dia >= 0

susceptibles >= 0
infectados >= 0
recuperados >= 0
```

Los valores de S, I y R permiten decimales.

Esto es deliberado porque un método numérico puede producir valores continuos.

La trayectoria debe contener al menos:

```text
1 elemento
```

## Reglas matemáticas no impuestas

El `$jsonSchema` no obliga actualmente:

```text
S + I + R = población inicial
```

ni:

```text
trayectoria.length = horizonte_dias + 1
```

ni:

```text
dia = 0, 1, 2, 3...
```

ni:

```text
S + I + R constante durante toda la trayectoria
```

Estas reglas deben ser definidas y verificadas por el componente matemático o Backend cuando exista una especificación formal aprobada.

La ausencia de estas restricciones estructurales no significa que el modelo matemático deba ignorarlas.

## `escenario_id`

Es opcional.

Referencia futura:

```text
predicciones_sir.escenario_id
    → escenarios._id
```

Actualmente no existe control referencial porque `escenarios` aún no ha sido implementada.

## `publica`

```text
publica
```

es un marcador booleano funcional.

No representa una autorización de seguridad.

Las decisiones de acceso o exposición de la simulación pertenecen a Backend.

## Preprocesamiento

Estructura:

```javascript
preprocesamiento: {
    registros_considerados: Int32,
    registros_descartados: Int32,
    observaciones: String
}
```

Reglas:

```text
registros_considerados >= 0
registros_descartados >= 0
```

`observaciones` es opcional.

## Índices

```text
ix_predicciones_sir_albergue_fecha
```

```javascript
{
    albergue_id: 1,
    fecha_ejecucion: -1
}
```

No único.

```text
ix_predicciones_sir_albergue_enfermedad_fecha
```

```javascript
{
    albergue_id: 1,
    enfermedad: 1,
    fecha_ejecucion: -1
}
```

No único.

```text
ix_predicciones_sir_modelo_version_fecha
```

```javascript
{
    "modelo.nombre": 1,
    "modelo.version": 1,
    fecha_ejecucion: -1
}
```

No único.

---

# 16. Naturaleza histórica de resultados analíticos

Actualmente existen dos colecciones históricas de resultados analíticos:

```text
analisis_ia
predicciones_sir
```

En ambas:

```text
1 ejecución
=
1 documento nuevo
```

No se utilizan:

```text
updated_at
updated_by
```

para representar nuevas ejecuciones.

Las dos colecciones mantienen contratos distintos:

```text
analisis_ia
    → resultado de análisis de riesgo

predicciones_sir
    → simulación epidemiológica S/I/R
```

No deben mezclarse en una sola colección.

---

# 17. Identificación de modelos

Tanto IA como SIR registran:

```javascript
modelo: {
    nombre: String,
    version: String
}
```

Esto permite:

```text
trazabilidad
reproducibilidad
auditoría
comparación entre versiones
```

---

# 18. Manejo de fechas

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

# 19. Integridad referencial

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

historial_poblacion.albergue_id
    → albergues._id

historial_poblacion.registrado_por
    → usuarios._id

historial_poblacion.updated_by
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

predicciones_sir.albergue_id
    → albergues._id

predicciones_sir.registrado_por
    → usuarios._id

predicciones_sir.datos_entrada.historial_poblacion_ids[]
    → historial_poblacion._id

predicciones_sir.datos_entrada.casos_enfermedades_ids[]
    → casos_enfermedades._id

predicciones_sir.datos_entrada.analisis_ia_id
    → analisis_ia._id
```

MongoDB `$jsonSchema` valida tipos BSON pero no implementa claves foráneas.

Los controles DBA complementan esta limitación mediante `$lookup`.

---

# 20. Pruebas DBA

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

## Historial poblacional

```text
test_historial_poblacion.js
18/18
```

## Predicciones SIR

```text
test_predicciones_sir.js
35/35
```

La suite SIR valida:

1. documento válido;
2. `albergue_id` obligatorio;
3. `fecha_ejecucion` obligatoria;
4. `enfermedad` obligatoria;
5. enfermedad no vacía;
6. `publica` Boolean;
7. beta no negativo;
8. gamma no negativo;
9. condiciones iniciales `Int32`;
10. condiciones iniciales no negativas;
11. `horizonte_dias >= 1`;
12. método numérico no vacío;
13. trayectoria no vacía;
14. día no negativo;
15. valores SIR no negativos;
16. trayectoria admite decimales;
17. referencias poblacionales sin duplicados;
18. referencias de casos sin duplicados;
19. propiedades adicionales rechazadas;
20. `updated_at` rechazado;
21. `escenario_id` opcional;
22. `escenario_id` como ObjectId;
23. `analisis_ia_id` opcional;
24. `analisis_ia_id` como ObjectId;
25. múltiples ejecuciones históricas permitidas;
26. tres índices SIR correctos y no únicos;
27. migración 011 registrada exactamente una vez;
28. detección de `albergue_id` huérfano;
29. detección de `registrado_por` huérfano;
30. detección de referencia huérfana hacia `historial_poblacion`;
31. detección de referencia huérfana hacia `casos_enfermedades`;
32. detección de referencia huérfana hacia `analisis_ia`;
33. observaciones de preprocesamiento opcionales;
34. beta y gamma pueden superar 1;
35. `$jsonSchema` no impone todavía `S + I + R = población`.

Resultado:

```text
Pruebas exitosas: 35
Pruebas fallidas: 0
```

La suite fue repetida después de ejecutar:

```text
init_semaforo_vital.js
```

manteniendo:

```text
35/35
```

---

# 21. Índices vigentes

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

## `historial_poblacion`

```text
ux_historial_poblacion_albergue_fecha
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

## `predicciones_sir`

```text
ix_predicciones_sir_albergue_fecha
ix_predicciones_sir_albergue_enfermedad_fecha
ix_predicciones_sir_modelo_version_fecha
```

No únicos.

## `schema_migrations`

```text
ux_schema_migrations_version
```

Único.

---

# 22. Seguridad

No deben versionarse:

- contraseñas;
- credenciales;
- URI privadas;
- tokens;
- secretos.

Las colecciones analíticas trabajan con datos agregados y referencias documentales.

No deben almacenar:

```text
nombres de pacientes
documentos de identidad
historias clínicas
datos clínicos individualizados
credenciales
secretos
```

`historial_poblacion` almacena cantidades agregadas.

`predicciones_sir` almacena resultados epidemiológicos agregados.

---

# 23. Responsabilidad DBA

La capa DBA garantiza:

- estructura documental;
- tipos BSON;
- campos obligatorios;
- validadores;
- índices;
- unicidad donde corresponda;
- migraciones;
- estado reproducible;
- referencias estructurales;
- controles de documentos huérfanos;
- contrato poblacional;
- contrato Bucket Pattern;
- contrato Computed Pattern;
- contrato histórico IA;
- contrato histórico SIR;
- versionado de modelos;
- trazabilidad documental de entradas;
- validación estructural de parámetros SIR;
- validación estructural de trayectoria;
- pruebas de integridad.

MongoDB no ejecuta:

```text
modelo IA
modelo SIR
clasificación de riesgo
reglas del Semáforo Vital
```

MongoDB persiste y valida el contrato.

---

# 24. Responsabilidad de Backend y componentes analíticos

Backend y los componentes especializados deberán garantizar:

- referencias válidas antes de persistir;
- fechas normalizadas;
- construcción correcta de arrays de entrada;
- coherencia entre albergue y datos fuente;
- creación de nuevos documentos para nuevas ejecuciones analíticas;
- no sobrescribir históricos;
- modelo y versión correctos;
- parámetros epidemiológicos correctos;
- ejecución del método numérico;
- coherencia matemática de la trayectoria;
- manejo de errores de validación MongoDB.

Para SIR deberá validarse fuera del `$jsonSchema`, cuando la especificación matemática lo determine:

```text
coherencia S + I + R
secuencia de días
conservación poblacional
longitud de trayectoria
coherencia con horizonte_dias
coherencia entre enfermedad y fuentes utilizadas
```

---

# 25. Arquitectura analítica

```text
historial_poblacion
          │
          │
          ├───────────────┐
          │               │
          ▼               ▼
 población diaria      modelo SIR
                          ▲
                          │
                 casos_enfermedades
                          │
                          ▼
                 predicciones_sir
```

Por otra parte:

```text
datos operativos
      │
      ▼
analisis_ia
      │
      ▼
resultado analítico
```

Posteriormente:

```text
analisis_ia
        │
        ├──────────────┐
        │              │
        ▼              ▼
predicciones_sir     alertas
        │              │
        └──────┬───────┘
               ▼
       estados_semaforo
               │
               ▼
metricas_albergue.estado_actual
               │
               ▼
             Redis
```

---

# 26. Redis

La arquitectura aprobada establece:

```text
MongoDB
    → fuente persistente de verdad

metricas_albergue.estado_actual
    → snapshot persistente

Redis
    → caché temporal
```

Redis no reemplazará:

```text
historial_poblacion
metricas_albergue
analisis_ia
predicciones_sir
alertas
estados_semaforo
```

Clave prevista:

```text
semaforo:estado:{albergue_id}
```

TTL inicial:

```text
900 segundos
```

Ante fallo de Redis:

```text
Backend
    → MongoDB
```

La integración Redis corresponde a un checkpoint posterior.

---

# 27. Reglas para evolución

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

Antes de crear una migración debe verificarse:

```text
main actualizado
última migración
cambios integrados por otros componentes
impacto sobre contratos existentes
```

---

# 28. Estado actual

Colecciones:

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
```

Pruebas específicas:

```text
condiciones_sanitarias     14/14
casos_enfermedades         14/14
intervenciones             15/15
metricas_albergue          18/18
analisis_ia                20/20
historial_poblacion        18/18
predicciones_sir           35/35
```

El Checkpoint 7 deja implementado:

```text
Colección predicciones_sir                     ✓
Migración 011                                   ✓
Naturaleza histórica                            ✓
Modelo y versión                                ✓
beta y gamma                                    ✓
Condiciones iniciales S/I/R                     ✓
Horizonte temporal                              ✓
Método numérico                                 ✓
Trazabilidad historial_poblacion                ✓
Trazabilidad casos_enfermedades                 ✓
analisis_ia_id opcional                         ✓
escenario_id preparado                          ✓
Preprocesamiento                                ✓
Trayectoria S/I/R                               ✓
Índices históricos no únicos                    ✓
Control de referencias                          ✓
Init reproducible                               ✓
Pruebas DBA                                    35/35
Documentación                                   ✓
```

El estado estructural vigente se encuentra en:

```text
database/mongodb/init/init_semaforo_vital.js
```

La evolución histórica se encuentra en:

```text
database/mongodb/migrations/
```

El siguiente número de migración disponible es:

```text
012
```

siempre que no exista una nueva migración integrada en `main` antes de iniciar el siguiente checkpoint.