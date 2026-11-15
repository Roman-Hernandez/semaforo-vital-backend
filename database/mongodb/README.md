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
alertas
estados_semaforo
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
    │   ├── 011_create_predicciones_sir.js
    │   ├── 012_create_alertas.js
    │   └── 013_create_estados_semaforo.js
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
    │   ├── test_alertas.js
    │   └── test_estados_semaforo.js
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
alertas
estados_semaforo
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
012_create_alertas.js
013_create_estados_semaforo.js
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
    ↓
012
Alertas sanitarias y epidemiológicas
    ↓
013
Histórico oficial del Semáforo Vital
```

Después de la migración 013, el siguiente número disponible es:

```text
014
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

`estado_actual` permanece opcional porque un albergue puede no tener todavía un cálculo oficial materializado.

Desde la migración 012 existe la relación:

```text
metricas_albergue.estado_actual.alertas_activas.ids[]
    → alertas._id
```

Desde la migración 013 existe también:

```text
metricas_albergue.estado_actual.semaforo_vital.estado_semaforo_id
    → estados_semaforo._id
```

`metricas_albergue.estado_actual.semaforo_vital` representa el snapshot persistente del último estado calculado.

El histórico oficial permanece en:

```text
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

# 15B. Colección `alertas`

Incorporada mediante:

```text
012_create_alertas.js
```

## Propósito

Conserva el histórico de alertas sanitarias y epidemiológicas generadas para cada albergue.

La colección permite mantener:

- el albergue asociado;
- la fecha funcional de la alerta;
- el nivel de riesgo;
- el tipo de alerta;
- el mensaje;
- su estado activa/inactiva;
- su visibilidad pública;
- las referencias hacia los datos que originaron el evento;
- la trazabilidad de creación y actualización.

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
        casos_enfermedades_ids: [ObjectId],
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

El nivel asociado a una alerta no sustituye el historial oficial del Semáforo Vital.

La fuente histórica oficial corresponde a:

```text
estados_semaforo
```

## Ciclo de vida

Las alertas conservan histórico.

Una alerta puede evolucionar:

```text
activa = true
        ↓
activa = false
```

sin eliminar el documento.

Por esa razón se admiten:

```text
updated_at
updated_by
```

## Visibilidad pública

```text
publica
```

es un marcador funcional.

No representa por sí mismo un mecanismo de autorización.

La autorización pertenece a Backend.

## Datos de origen

El objeto:

```text
datos_origen
```

es obligatorio para mantener una estructura estable.

Sus referencias internas son opcionales y dependen del origen de la alerta.

Relaciones aprobadas:

```text
alertas.datos_origen.condicion_sanitaria_id
    → condiciones_sanitarias._id

alertas.datos_origen.casos_enfermedades_ids[]
    → casos_enfermedades._id

alertas.datos_origen.prediccion_sir_id
    → predicciones_sir._id
```

`casos_enfermedades_ids` utiliza:

```text
uniqueItems: true
```

Cuando una referencia existe, debe pertenecer al mismo albergue indicado por:

```text
alertas.albergue_id
```

MongoDB `$jsonSchema` no implementa claves foráneas.

La coherencia se controla mediante pruebas DBA y consultas `$lookup`.

## Catálogos pendientes

Actualmente permanecen abiertos:

```text
tipo_alerta
fuente_datos
```

No se ha definido todavía un `enum` para estos campos.

## Campos deliberadamente no incorporados

No forman parte del contrato vigente:

```text
prioridad
datos_origen.analisis_ia_id
```

No existe un catálogo funcional aprobado de prioridad.

Tampoco existe una definición aprobada para que una alerta referencie directamente un documento de `analisis_ia`.

## Índices

```text
ix_alertas_albergue_fecha
ix_alertas_albergue_activa_fecha
ix_alertas_nivel_activa
```

Los tres índices son no únicos.

La existencia de múltiples alertas para un mismo albergue y fecha es válida.

---

# 15C. Colección `estados_semaforo`

Incorporada mediante:

```text
013_create_estados_semaforo.js
```

## Propósito

Conserva el histórico oficial de los estados calculados del Semáforo Vital para cada albergue.

La colección separa explícitamente:

```text
alertas
    → histórico de alertas

estados_semaforo
    → histórico oficial del Semáforo Vital

metricas_albergue.estado_actual
    → snapshot persistente del último estado
```

Cada nuevo cálculo genera un documento nuevo.

## Estructura

```javascript
{
    _id: ObjectId,
    albergue_id: ObjectId,
    fecha_calculo: Date,
    nivel: String,
    codigo: Int32,
    datos_origen: {
        condiciones_sanitarias_ids: [ObjectId],
        casos_enfermedades_ids: [ObjectId],
        alertas_ids: [ObjectId],
        analisis_ia_ids: [ObjectId],
        predicciones_sir_ids: [ObjectId],
        metricas_albergue_ids: [ObjectId]
    },
    registrado_por: ObjectId,
    created_at: Date
}
```

## Nivel

`nivel` utiliza el catálogo cerrado:

```text
verde
amarillo
rojo
```

## Código

`codigo` es `Int32`.

No se impone todavía una equivalencia numérica oficial entre código y color.

## Naturaleza histórica

No forman parte del contrato:

```text
updated_at
updated_by
```

Un nuevo cálculo inserta un nuevo documento.

Los índices son no únicos.

## Datos de origen

Los seis arrays de `datos_origen` son obligatorios, utilizan `uniqueItems: true` y pueden estar vacíos:

```text
condiciones_sanitarias_ids
casos_enfermedades_ids
alertas_ids
analisis_ia_ids
predicciones_sir_ids
metricas_albergue_ids
```

Relaciones:

```text
condiciones_sanitarias_ids[] → condiciones_sanitarias._id
casos_enfermedades_ids[]     → casos_enfermedades._id
alertas_ids[]                 → alertas._id
analisis_ia_ids[]             → analisis_ia._id
predicciones_sir_ids[]        → predicciones_sir._id
metricas_albergue_ids[]       → metricas_albergue._id
```

Las fuentes deben corresponder al mismo albergue cuando la colección origen contiene `albergue_id`.

## Snapshot actual

```text
estados_semaforo._id
    ↓
metricas_albergue.estado_actual.semaforo_vital.estado_semaforo_id
```

Backend deberá materializar:

```javascript
{
    nivel: estado.nivel,
    codigo: estado.codigo,
    estado_semaforo_id: estado._id,
    fecha_calculo: estado.fecha_calculo
}
```

## Reglas no incorporadas en MongoDB

MongoDB no determina umbrales, pesos ni fórmulas de clasificación del Semáforo Vital.

Estas reglas corresponden a Backend y componentes analíticos.

## Usuario técnico

`registrado_por` es obligatorio.

Los cálculos automáticos dependerán de la definición pendiente de un usuario técnico.

## Índices

```text
ix_estados_semaforo_albergue_fecha
ix_estados_semaforo_albergue_nivel_fecha
ix_estados_semaforo_nivel_fecha
```

No únicos.

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

alertas.albergue_id
    → albergues._id

alertas.registrado_por
    → usuarios._id

alertas.updated_by
    → usuarios._id

alertas.datos_origen.condicion_sanitaria_id
    → condiciones_sanitarias._id

alertas.datos_origen.casos_enfermedades_ids[]
    → casos_enfermedades._id

alertas.datos_origen.prediccion_sir_id
    → predicciones_sir._id

metricas_albergue.estado_actual.alertas_activas.ids[]
    → alertas._id

estados_semaforo.albergue_id
    → albergues._id

estados_semaforo.registrado_por
    → usuarios._id

estados_semaforo.datos_origen.condiciones_sanitarias_ids[]
    → condiciones_sanitarias._id

estados_semaforo.datos_origen.casos_enfermedades_ids[]
    → casos_enfermedades._id

estados_semaforo.datos_origen.alertas_ids[]
    → alertas._id

estados_semaforo.datos_origen.analisis_ia_ids[]
    → analisis_ia._id

estados_semaforo.datos_origen.predicciones_sir_ids[]
    → predicciones_sir._id

estados_semaforo.datos_origen.metricas_albergue_ids[]
    → metricas_albergue._id

metricas_albergue.estado_actual.semaforo_vital.estado_semaforo_id
    → estados_semaforo._id
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

## Alertas

```text
test_alertas.js
40/40
```

## Estados del Semáforo Vital

```text
test_estados_semaforo.js
50/50
```

Resultado:

```text
Pruebas exitosas: 50
Pruebas fallidas: 0
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

## `alertas`

```text
ix_alertas_albergue_fecha
ix_alertas_albergue_activa_fecha
ix_alertas_nivel_activa
```

No únicos.

## `estados_semaforo`

```text
ix_estados_semaforo_albergue_fecha
ix_estados_semaforo_albergue_nivel_fecha
ix_estados_semaforo_nivel_fecha
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

`alertas` almacena eventos agregados del albergue y referencias documentales.

`estados_semaforo` almacena estados agregados del albergue y referencias documentales.

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
- contrato estructural de alertas;
- ciclo de vida histórico de alertas;
- trazabilidad de origen de alertas;
- contrato histórico de estados del Semáforo Vital;
- trazabilidad de fuentes utilizadas por cada estado;
- relación estructural entre histórico y snapshot actual;
- versionado de modelos;
- trazabilidad documental de entradas;
- validación estructural de parámetros SIR;
- validación estructural de trayectoria;
- pruebas de integridad.

MongoDB no ejecuta:

```text
modelo IA
modelo SIR
generación funcional de alertas
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
- manejo de errores de validación MongoDB;
- generación funcional de alertas;
- cierre lógico de alertas sin eliminar histórico;
- control de exposición pública mediante `publica`;
- coherencia entre alerta y datos de origen;
- calcular el nuevo estado del Semáforo Vital según reglas funcionales aprobadas;
- persistir un nuevo documento en `estados_semaforo` por cada cálculo;
- mantener coherencia entre las fuentes del estado y el albergue;
- actualizar `metricas_albergue.estado_actual.semaforo_vital` después de persistir correctamente el estado.

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

Arquitectura de riesgo y estado:

```text
analisis_ia
        │
        ├──────────────┐
        │              │
        ▼              ▼
predicciones_sir     alertas ✓
        │              │
        └──────┬───────┘
               ▼
       estados_semaforo ✓
               │
               ▼
metricas_albergue.estado_actual
               │
               ▼
             Redis ✓
```

`alertas` ya forma parte del modelo persistente.

`estados_semaforo` ya forma parte del modelo persistente y es la fuente histórica oficial del estado del Semáforo Vital.

---

# 26. Redis

La integración Redis fue implementada en el Checkpoint 10 como una capa de caché temporal para acelerar la consulta del estado actual del Semáforo Vital.

La arquitectura vigente es:

```text
MongoDB
    → fuente persistente de verdad

estados_semaforo
    → histórico oficial del Semáforo Vital

metricas_albergue.estado_actual
    → snapshot persistente actual

Redis
    → caché temporal de lectura
```

Redis no reemplaza ninguna colección MongoDB.

En particular, no reemplaza:

```text
historial_poblacion
metricas_albergue
analisis_ia
predicciones_sir
alertas
estados_semaforo
```

## 26.1 Clave Redis

El patrón de clave implementado es:

```text
semaforo:estado:{albergue_id}
```

Ejemplo:

```text
semaforo:estado:6918f2...
```

El prefijo se configura mediante:

```env
REDIS_KEY_PREFIX=semaforo:estado
```

## 26.2 TTL

El TTL inicial configurado es:

```text
900 segundos
```

equivalente a:

```text
15 minutos
```

Variable:

```env
REDIS_TTL_SECONDS=900
```

La expiración evita conservar indefinidamente snapshots potencialmente obsoletos.

## 26.3 Contrato del snapshot

Redis almacena únicamente información necesaria para representar el estado actual de consulta:

```text
albergue_id
nombre
nivel_semaforo
codigo_semaforo
estado_semaforo_id
fecha_calculo
porcentaje_ocupacion
alertas_activas
ultima_medicion
ultima_actualizacion
```

`ultima_medicion` contiene:

```text
fecha_hora
ph
cloro_residual
personas_alojadas
porcentaje_ocupacion
```

Los valores no disponibles pueden representarse mediante:

```text
null
```

Las fechas son serializadas en formato:

```text
ISO 8601
```

Redis no almacena:

```text
históricos completos
datos de pacientes
credenciales
tokens
fuentes completas de IA
trayectorias SIR
documentos MongoDB completos
```

## 26.4 Flujo de lectura

El flujo implementado es:

```text
Solicitud
    │
    ▼
CachedShelterRepository
    │
    ▼
Redis
    │
    ├── HIT
    │     │
    │     ▼
    │  retornar snapshot
    │
    └── MISS
          │
          ▼
       MongoDB
          │
          ▼
   construir snapshot
          │
          ▼
      SETEX Redis
          │
          ▼
       retornar
```

MongoDB continúa siendo la fuente autoritativa.

## 26.5 Fallback

Si Redis:

```text
no está configurado
no está disponible
rechaza una lectura
rechaza una escritura
contiene JSON inválido
```

la aplicación debe continuar utilizando MongoDB.

Arquitectura:

```text
Redis disponible
    → utilizar caché

Redis no disponible
    → MongoDB
```

Una falla Redis no debe provocar indisponibilidad funcional del Backend.

## 26.6 Invalidación

Cuando una operación persistente afecta información asociada al snapshot, la clave correspondiente puede invalidarse mediante:

```text
DEL semaforo:estado:{albergue_id}
```

La siguiente consulta produce:

```text
Cache MISS
    ↓
MongoDB
    ↓
reconstrucción
    ↓
nuevo SETEX
```

Esto mantiene a MongoDB como fuente de verdad y evita mantener dos fuentes persistentes distintas.

## 26.7 Integración arquitectónica

Se implementó un decorador:

```text
CachedShelterRepository
```

La aplicación mantiene la dependencia:

```text
ShelterService
    ↓
ShelterRepository
```

La composición concreta queda:

```text
ShelterService
        ↓
CachedShelterRepository
        │
        ├── latest_metrics()
        │       ↓
        │     Redis
        │       ↓ MISS
        │     MongoDB
        │
        └── demás operaciones
                ↓
        MongoShelterRepository
                ↓
             MongoDB
```

Por tanto:

```text
Dominio
    → no depende de Redis

Application
    → no depende de Redis

Infraestructura
    → implementa Redis
```

Redis no fue incorporado dentro de las reglas de negocio.

## 26.8 Infraestructura Docker

Redis se ejecuta mediante:

```text
docker-compose.yml
```

Servicio:

```text
redis:7.4-alpine
```

Contenedor:

```text
semaforo-vital-redis
```

Puerto de desarrollo:

```text
6379
```

Healthcheck:

```text
redis-cli ping
```

Redis fue configurado sin persistencia obligatoria:

```text
--save ""
--appendonly no
```

Esta decisión es intencional porque Redis funciona exclusivamente como caché.

La pérdida del contenido Redis no implica pérdida de información del sistema.

## 26.9 Variables de entorno

Configuración local:

```env
REDIS_URL=redis://localhost:6379/0
REDIS_TTL_SECONDS=900
REDIS_KEY_PREFIX=semaforo:estado
```

Dentro de Docker Compose:

```text
redis://redis:6379/0
```

La URL interna utiliza el nombre DNS del servicio Docker.

## 26.10 Componentes implementados

La integración utiliza:

```text
app/infrastructure/cache/redis.py
app/infrastructure/cache/semaforo_snapshot.py
app/infrastructure/cache/semaforo_cache.py

app/infrastructure/repositories/cached_shelter_repository.py
```

También se integró Redis en:

```text
app/core/config.py
app/main.py
app/api/deps.py
```

Dependencia Python:

```text
redis
```

## 26.11 Pruebas

Las pruebas específicas implementadas incluyen:

```text
test_redis_cache.py                  13
test_redis_dependency.py              3
test_semaforo_cache_snapshot.py       3
test_semaforo_cache.py                8
---------------------------------------
Total                                27
```

Se validaron:

```text
construcción de key
Cache HIT
Cache MISS
TTL
serialización JSON
JSON inválido
lectura sin cliente Redis
fallo de Redis
escritura
eliminación
invalidación
snapshot completo
valores nulos
valores cero
fallback hacia MongoDB
dependencia FastAPI
```

También se realizaron pruebas manuales con Redis real:

```text
PING
SETEX
GET
TTL
DEL
```

## 26.12 Migraciones MongoDB

La integración Redis:

```text
NO requiere migración MongoDB
```

Por tanto:

```text
013_create_estados_semaforo.js
```

continúa siendo la migración más reciente de este checkpoint y:

```text
014
```

permanece disponible para el siguiente cambio estructural MongoDB.

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
alertas                         ✓
estados_semaforo                ✓
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
013_create_estados_semaforo               ✓
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
alertas                    40/40
estados_semaforo           50/50
```

El Checkpoint 9 deja implementado:

```text
Colección estados_semaforo                          ✓
Migración 013                                       ✓
Dependencia de migración 012                        ✓
Naturaleza histórica append-only                    ✓
nivel verde/amarillo/rojo                           ✓
codigo Int32 sin mapeo artificial                   ✓
datos_origen obligatorio                            ✓
seis arrays de trazabilidad                         ✓
coherencia de albergue                              ✓
registrado_por                                      ✓
3 índices históricos no únicos                      ✓
relación con metricas_albergue.estado_actual        ✓
fórmula de clasificación no inventada               ✓
usuario técnico automático pendiente                ✓
Init reproducible                                   ✓
Pruebas DBA                                       50/50
Documentación                                       ✓
```

El Checkpoint 10 deja implementado:

```text
Redis como caché temporal                              ✓
MongoDB permanece como fuente de verdad               ✓
Clave semaforo:estado:{albergue_id}                   ✓
TTL 900 segundos                                      ✓
Snapshot de estado actual                             ✓
estado_semaforo_id preservado                         ✓
ultima_actualizacion preservada                       ✓
Cache HIT                                             ✓
Cache MISS → MongoDB                                  ✓
Fallback ante Redis no disponible                     ✓
Invalidación de caché                                 ✓
Serialización ISO 8601                                ✓
Redis sin persistencia obligatoria                    ✓
Docker Compose                                        ✓
Healthcheck Redis                                     ✓
CachedShelterRepository                               ✓
Separación dominio/aplicación/infraestructura         ✓
Pruebas específicas Redis/cache                    27/27
Migración MongoDB nueva                                ✗ no requerida
```

Arquitectura actual:

```text
Frontend
    ↓
FastAPI
    ↓
ShelterService
    ↓
CachedShelterRepository
    │
    ├── Redis
    │     │
    │     ├── HIT → respuesta
    │     │
    │     └── MISS
    │
    └── MongoDB
          ↓
    fuente persistente
```

El siguiente número de migración continúa siendo:

```text
014
```

porque Redis no modifica el esquema MongoDB.

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
014
```

siempre que no exista una nueva migración integrada en `main` antes de iniciar el siguiente checkpoint.