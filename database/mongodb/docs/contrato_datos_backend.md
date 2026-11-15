# Contrato de datos MongoDB — Semáforo Vital

## 1. Objetivo

Este documento define el contrato de datos vigente entre MongoDB y las capas consumidoras del sistema **Semáforo Vital**.

Su objetivo es evitar inconsistencias durante la integración entre base de datos, Backend, modelos analíticos y demás componentes, especialmente en:

- usuarios y roles;
- referencias entre colecciones;
- fechas operativas;
- trazabilidad;
- registros diarios;
- historial poblacional;
- condiciones sanitarias;
- casos de enfermedades;
- intervenciones reales;
- telemetría intradía;
- Bucket Pattern;
- Computed Pattern;
- análisis de inteligencia artificial;
- simulaciones epidemiológicas SIR;
- versionado de modelos;
- parámetros epidemiológicos;
- condiciones iniciales S/I/R;
- trazabilidad de datos utilizados;
- preprocesamiento;
- trayectorias epidemiológicas;
- alertas sanitarias y epidemiológicas;
- evolución futura del esquema.

La base de datos utilizada es:

```text
semaforo_vital
```

---

# 2. Colecciones vigentes

Actualmente el modelo utiliza:

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

`schema_migrations` es una colección técnica para controlar la evolución estructural.

---

# 2.1 Equivalencias conceptuales

| Concepto | Implementación vigente |
|---|---|
| `users` | `usuarios` |
| `SUPER_ADMIN` | `super_administrador` |
| `SHELTER_ADMIN` | `administrador_albergue` |
| `shelterId` | `albergue_id` |
| estado usuario | `active` |
| correo normalizado | `email` |
| población diaria oficial | `historial_poblacion` |
| análisis de riesgo IA | `analisis_ia` |
| simulaciones epidemiológicas | `predicciones_sir` |
| alertas sanitarias | `alertas` |

Los nombres implementados forman parte del contrato y no deben modificarse unilateralmente.

---

# 3. Colección `usuarios`

Almacena usuarios autorizados.

Las contraseñas nunca deben almacenarse en texto plano.

MongoDB almacena:

```text
password_hash
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

---

# 4. Colección `albergues`

Representa los albergues administrados por el sistema.

Estructura:

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

Las coordenadas utilizan:

```text
[longitud, latitud]
```

---

# 5. Colección `registros_diarios`

Almacena el consolidado diario histórico.

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

Solo puede existir:

```text
1 registro
por albergue
por fecha
```

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

representan casos nuevos del día.

El campo:

```text
registros_diarios.poblacion
```

permanece por compatibilidad con el consolidado histórico.

Los nuevos flujos poblacionales utilizan:

```text
historial_poblacion
```

---

# 5A. Colección `historial_poblacion`

Fue incorporada mediante:

```text
010_create_historial_poblacion.js
```

Es la fuente persistente oficial de población diaria.

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

Regla:

```text
1 albergue + 1 fecha
=
1 registro poblacional
```

Índice:

```text
ux_historial_poblacion_albergue_fecha
```

Único.

La arquitectura poblacional es:

```text
historial_poblacion
    → población diaria oficial

registros_diarios.poblacion
    → dato histórico embebido

metricas_albergue
    → ocupación intradía
```

---

# 6. Regla de fechas

Zona horaria funcional:

```text
America/Bogota
```

MongoDB almacena `Date` como instante UTC.

Los campos:

```text
fecha
fecha_intervencion
fecha_bucket
```

representan fechas funcionales.

Los campos:

```text
fecha_hora
fecha_ejecucion
fecha_calculo
created_at
updated_at
```

representan instantes temporales.

---

# 7. Colección `condiciones_sanitarias`

Almacena condiciones sanitarias observadas.

Campos:

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

---

# 8. Colección `casos_enfermedades`

Almacena casos activos de enfermedad por albergue y fecha.

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

`cantidad_casos_activos` representa:

> Personas que presentan activamente la enfermedad en esa fecha.

Índices:

```text
ix_casos_enfermedades_albergue_fecha
ix_casos_enfermedades_albergue_enfermedad_fecha
```

No únicos.

---

# 9. Colección `intervenciones`

Almacena acciones reales ejecutadas.

No contiene:

```text
simulaciones
acciones hipotéticas
intervenciones propuestas
```

Las acciones simuladas corresponderán posteriormente a:

```text
escenarios
```

---

# 10. Colección `metricas_albergue`

Implementa:

```text
Bucket Pattern
Computed Pattern
```

Unidad documental:

```text
1 albergue + 1 fecha_bucket
```

Almacena:

```text
mediciones
calculados
ultima_medicion
estado_actual
```

`estado_actual` continúa opcional mientras se completa:

```text
estados_semaforo
```

Desde la migración 012 existe la colección destino para:

```text
metricas_albergue.estado_actual.alertas_activas.ids[]
    → alertas._id
```

Índice:

```text
ux_metricas_albergue_albergue_fecha_bucket
```

Único.

---

# 11. Colección `analisis_ia`

Fue incorporada mediante:

```text
009_create_analisis_ia.js
```

Es histórica:

```text
1 ejecución IA
=
1 documento
```

No utiliza:

```text
updated_at
updated_by
```

Cada ejecución registra:

```text
albergue_id
fecha_ejecucion
periodo_analizado
modelo
datos_entrada
preprocesamiento
resultado
registrado_por
created_at
```

`resultado.probabilidad_riesgo` cumple:

```text
0 <= probabilidad_riesgo <= 1
```

La probabilidad IA no equivale directamente al estado del Semáforo Vital.

---

# 12. Colección `predicciones_sir`

Fue incorporada mediante:

```text
011_create_predicciones_sir.js
```

## 12.1 Propósito

Almacena resultados históricos de simulaciones epidemiológicas realizadas mediante un modelo compartimental SIR.

La colección persiste:

```text
parámetros utilizados
condiciones iniciales
fuentes de datos
método numérico
trayectoria calculada
modelo y versión
trazabilidad
```

MongoDB:

```text
NO ejecuta el modelo SIR
NO calcula beta
NO calcula gamma
NO genera la trayectoria
```

MongoDB persiste y valida el contrato.

---

# 12.2 Estructura completa

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

---

# 12.3 Campos obligatorios

Son obligatorios:

```text
albergue_id
fecha_ejecucion
enfermedad
publica
modelo
parametros
datos_entrada
preprocesamiento
trayectoria
registrado_por
created_at
```

Son opcionales:

```text
escenario_id
datos_entrada.analisis_ia_id
preprocesamiento.observaciones
```

---

# 12.4 Naturaleza histórica

La regla es:

```text
1 ejecución SIR
=
1 nuevo documento
```

No deben utilizarse:

```text
updated_at
updated_by
```

para representar una ejecución posterior.

Por ejemplo:

```text
Ejecución 10:00
    → documento A

Ejecución 11:00
    → documento B
```

No:

```text
documento A
    → UPDATE con resultado de 11:00
```

---

# 12.5 Enfermedad

```text
enfermedad
```

es un `String` obligatorio y no vacío.

Actualmente no utiliza `enum`.

Esto conserva compatibilidad con:

```text
casos_enfermedades.enfermedad
```

cuyo catálogo tampoco está cerrado.

---

# 12.6 Campo `publica`

```text
publica
```

es `Boolean`.

Representa un marcador funcional para indicar si una ejecución puede considerarse publicable o visible según la lógica funcional.

No representa por sí mismo una autorización.

La autorización corresponde a Backend.

---

# 12.7 Identificación del modelo

Cada ejecución registra:

```javascript
modelo: {
    nombre: String,
    version: String
}
```

Ambos campos son obligatorios y no pueden estar vacíos.

Esto permite:

```text
trazabilidad
reproducibilidad
auditoría
comparación entre versiones
```

---

# 12.8 Parámetro `beta`

`beta` representa el parámetro de transmisión utilizado por el modelo.

Acepta:

```text
double
int
long
decimal
```

Regla estructural:

```text
beta >= 0
```

No existe:

```text
maximum: 1
```

---

# 12.9 Parámetro `gamma`

`gamma` representa el parámetro de recuperación utilizado por el modelo.

Acepta:

```text
double
int
long
decimal
```

Regla:

```text
gamma >= 0
```

Tampoco se limita estructuralmente a 1.

---

# 12.10 Condiciones iniciales

Estructura:

```javascript
condiciones_iniciales: {
    susceptibles: Int32,
    infectados: Int32,
    recuperados: Int32
}
```

Reglas:

```text
susceptibles >= 0
infectados >= 0
recuperados >= 0
```

Los tres valores son:

```text
Int32
```

---

# 12.11 Horizonte temporal

```text
horizonte_dias
```

debe ser:

```text
Int32
```

y cumplir:

```text
horizonte_dias >= 1
```

---

# 12.12 Método numérico

```text
metodo_numerico
```

es:

```text
String
```

con longitud mínima 1.

Actualmente no existe:

```text
enum
```

porque no está definido formalmente el catálogo de métodos permitidos.

Esto permanece como decisión pendiente del componente matemático.

---

# 12.13 Datos de entrada

Estructura:

```javascript
datos_entrada: {
    analisis_ia_id: ObjectId,
    historial_poblacion_ids: [ObjectId],
    casos_enfermedades_ids: [ObjectId]
}
```

Son obligatorios:

```text
historial_poblacion_ids
casos_enfermedades_ids
```

`analisis_ia_id` es opcional.

Los arrays:

```text
historial_poblacion_ids
casos_enfermedades_ids
```

utilizan:

```text
uniqueItems: true
```

No existe actualmente:

```text
minItems: 1
```

Esto permite posteriormente simulaciones basadas en escenarios hipotéticos.

---

# 12.14 Fuente poblacional SIR

La fuente persistente de población es:

```text
historial_poblacion
```

La referencia es:

```text
predicciones_sir.datos_entrada.historial_poblacion_ids[]
    → historial_poblacion._id
```

No debe utilizarse como nueva fuente poblacional principal:

```text
registros_diarios.poblacion
```

---

# 12.15 Casos epidemiológicos SIR

Las referencias de casos son:

```text
predicciones_sir.datos_entrada.casos_enfermedades_ids[]
    → casos_enfermedades._id
```

`casos_enfermedades.cantidad_casos_activos` representa casos activos en la fecha registrada.

No representa:

```text
casos nuevos
casos acumulados
```

---

# 12.16 Relación opcional con IA

Puede existir:

```text
predicciones_sir.datos_entrada.analisis_ia_id
    → analisis_ia._id
```

La referencia es opcional.

Cuando existe, la migración y las pruebas DBA permiten comprobar su integridad lógica.

---

# 12.17 Preprocesamiento

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

---

# 12.18 Trayectoria SIR

Estructura:

```javascript
trayectoria: [
    {
        dia: Int32,
        susceptibles: Number,
        infectados: Number,
        recuperados: Number
    }
]
```

La trayectoria debe contener al menos:

```text
1 elemento
```

Reglas:

```text
dia >= 0
susceptibles >= 0
infectados >= 0
recuperados >= 0
```

`dia` es:

```text
Int32
```

Los valores:

```text
susceptibles
infectados
recuperados
```

aceptan:

```text
double
int
long
decimal
```

Se permiten decimales porque la integración numérica puede producir valores continuos.

---

# 12.19 Reglas matemáticas no impuestas

Actualmente `$jsonSchema` no verifica:

```text
S + I + R = población inicial
```

Tampoco:

```text
trayectoria.length = horizonte_dias + 1
```

Ni:

```text
dia = 0, 1, 2, 3, ...
```

Ni:

```text
S + I + R permanece constante
```

Ni:

```text
todos los documentos fuente pertenecen al mismo albergue
```

Ni:

```text
todos los casos corresponden exactamente a enfermedad
```

Estas reglas deberán ser implementadas por Backend o por el componente matemático cuando exista una especificación formal aprobada.

No deben endurecerse unilateralmente desde DBA.

---

# 12.20 `escenario_id`

`escenario_id` es opcional.

Si existe debe ser:

```text
ObjectId
```

Referencia futura:

```text
predicciones_sir.escenario_id
    → escenarios._id
```

No se realiza todavía `$lookup` porque:

```text
escenarios
```

aún no existe.

---

# 12.21 Índices de SIR

## Historial por albergue

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

## Albergue, enfermedad y fecha

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

## Modelo y versión

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

# 12.22 Ausencia deliberada de índices únicos

No existe índice único sobre:

```text
albergue_id + fecha_ejecucion
```

ni:

```text
albergue_id + enfermedad + fecha_ejecucion
```

ni:

```text
modelo.nombre + modelo.version + fecha_ejecucion
```

Dos simulaciones independientes pueden compartir esas características.

---

# 12A. Colección `alertas`

Fue incorporada mediante:

```text
012_create_alertas.js
```

## 12A.1 Propósito

Persiste el histórico de alertas sanitarias y epidemiológicas generadas para los albergues.

La colección conserva:

```text
albergue
fecha funcional de la alerta
nivel de riesgo
tipo de alerta
mensaje
estado activa/inactiva
visibilidad pública
datos de origen
trazabilidad de creación y actualización
```

## 12A.2 Estructura

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

## 12A.3 Campos obligatorios

Son obligatorios:

```text
albergue_id
fecha_alerta
nivel_riesgo
tipo_alerta
mensaje
activa
publica
datos_origen
fuente_datos
registrado_por
created_at
```

Son opcionales:

```text
datos_origen.condicion_sanitaria_id
datos_origen.casos_enfermedades_ids
datos_origen.prediccion_sir_id
updated_at
updated_by
```

## 12A.4 Nivel de riesgo

`nivel_riesgo` utiliza exclusivamente:

```text
verde
amarillo
rojo
```

El nivel asociado a una alerta no representa por sí mismo el historial oficial del Semáforo Vital.

Ese historial corresponderá posteriormente a:

```text
estados_semaforo
```

## 12A.5 Ciclo de vida

Las alertas conservan histórico.

Una alerta puede evolucionar:

```text
activa = true
        ↓
activa = false
```

sin eliminarse.

Por esa razón:

```text
updated_at
updated_by
```

pueden utilizarse para registrar el cierre o una actualización válida de la alerta.

## 12A.6 Visibilidad pública

```text
publica
```

es un marcador funcional.

No constituye por sí mismo un mecanismo de autorización.

La autorización continúa siendo responsabilidad de Backend.

## 12A.7 Datos de origen

El objeto:

```text
datos_origen
```

es obligatorio para mantener una estructura documental estable.

Sus referencias internas son opcionales.

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

Cuando una referencia existe debe pertenecer al mismo albergue indicado por:

```text
alertas.albergue_id
```

`$jsonSchema` valida estructura y tipos BSON.

La coherencia referencial se controla mediante pruebas DBA y consultas `$lookup`, y debe ser validada también por Backend antes de persistir.

## 12A.8 Catálogos pendientes

Continúan como `String` abierto:

```text
tipo_alerta
fuente_datos
```

No se inventan `enum` hasta contar con definición funcional aprobada.

## 12A.9 Campos deliberadamente no incorporados

No forman parte del contrato vigente:

```text
prioridad
datos_origen.analisis_ia_id
```

No existe un catálogo funcional aprobado para prioridad.

Tampoco existe todavía una definición aprobada para una referencia directa desde `alertas` hacia `analisis_ia`.

## 12A.10 Índices

```text
ix_alertas_albergue_fecha
ix_alertas_albergue_activa_fecha
ix_alertas_nivel_activa
```

Los tres son no únicos.

Esto permite conservar múltiples alertas históricas para un mismo albergue y fecha.

---

# 13. Migración 011

Archivo:

```text
database/mongodb/migrations/011_create_predicciones_sir.js
```

Dependencia:

```text
010_create_historial_poblacion
```

La migración verifica que la 010 esté registrada exactamente una vez.

Colecciones requeridas:

```text
usuarios
albergues
historial_poblacion
casos_enfermedades
analisis_ia
schema_migrations
```

La migración:

- crea o actualiza `predicciones_sir`;
- aplica `$jsonSchema`;
- configura validación `strict`;
- configura `validationAction: error`;
- crea los tres índices SIR;
- valida `albergue_id`;
- valida `registrado_por`;
- valida referencias hacia `historial_poblacion`;
- valida referencias hacia `casos_enfermedades`;
- valida `analisis_ia_id` cuando existe;
- deja preparado `escenario_id`;
- registra la migración;
- verifica registro único;
- verifica definiciones de índices.

---

# 14. Idempotencia de migración 011

Si la colección ya existe:

```text
collMod
```

actualiza el validator.

No se ejecuta:

```text
drop
```

La migración queda aplicada cuando existe exactamente un documento con:

```text
version = 011_create_predicciones_sir
```

en:

```text
schema_migrations
```

---

# 14A. Migración 012

Archivo:

```text
database/mongodb/migrations/012_create_alertas.js
```

Dependencia:

```text
011_create_predicciones_sir
```

La migración verifica que la 011 esté registrada exactamente una vez.

Colecciones requeridas:

```text
usuarios
albergues
condiciones_sanitarias
casos_enfermedades
predicciones_sir
schema_migrations
```

La migración:

- crea o actualiza `alertas`;
- aplica `$jsonSchema`;
- configura validación `strict`;
- configura `validationAction: error`;
- crea tres índices históricos no únicos;
- valida `albergue_id`;
- valida `registrado_por`;
- valida `updated_by` cuando existe;
- valida referencias hacia `condiciones_sanitarias`;
- valida referencias hacia `casos_enfermedades`;
- valida referencias hacia `predicciones_sir`;
- verifica coherencia de albergue para los datos de origen;
- registra la migración;
- verifica registro único;
- verifica definiciones de índices.

---

# 14B. Idempotencia de migración 012

Si la colección ya existe:

```text
collMod
```

actualiza el validator.

No se ejecuta:

```text
drop
```

La migración queda aplicada cuando existe exactamente un documento con:

```text
version = 012_create_alertas
```

en:

```text
schema_migrations
```

---

# 15. Inicialización reproducible

El archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

administra actualmente:

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

Para colecciones inexistentes utiliza:

```text
createCollection
```

Para existentes:

```text
collMod
```

También reproduce los tres índices de `predicciones_sir` y los tres índices de `alertas`.

El `init` no registra migraciones ni ejecuta transformaciones históricas.

---

# 16. Pruebas DBA de SIR

Archivo:

```text
database/mongodb/tests/test_predicciones_sir.js
```

Resultado:

```text
Pruebas exitosas: 35
Pruebas fallidas: 0
```

Cobertura:

```text
documento válido
campos obligatorios
tipos BSON
beta
gamma
condiciones iniciales
horizonte temporal
método numérico
trayectoria
valores decimales
uniqueItems
additionalProperties
naturaleza histórica
escenario_id
analisis_ia_id
índices
migración registrada
referencias huérfanas
preprocesamiento
ausencia deliberada de límites artificiales
ausencia deliberada de conservación matemática en JSON Schema
```

Después de ejecutar nuevamente:

```text
init_semaforo_vital.js
```

la suite conservó:

```text
35/35
```

---

# 16A. Pruebas DBA de alertas

Archivo:

```text
database/mongodb/tests/test_alertas.js
```

Resultado:

```text
Pruebas exitosas: 40
Pruebas fallidas: 0
```

La suite cubre:

```text
documento válido
campos obligatorios
tipos BSON
nivel_riesgo verde/amarillo/rojo
tipo_alerta
mensaje
activa
publica
datos_origen
fuente_datos
additionalProperties
uniqueItems
trazabilidad de actualización
cierre activa → inactiva
alertas públicas
condicion_sanitaria_id
casos_enfermedades_ids
prediccion_sir_id
combinación de orígenes
referencias huérfanas
coherencia de albergue
índices
migración registrada
múltiples alertas en la misma fecha
ausencia deliberada de prioridad
ausencia deliberada de analisis_ia_id
catálogos abiertos
```

Después de ejecutar nuevamente:

```text
init_semaforo_vital.js
```

la suite conservó:

```text
40/40
```

---

# 17. Integridad referencial general

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
```

MongoDB `$jsonSchema` no implementa foreign keys.

Los controles DBA utilizan `$lookup`.

---

# 18. Referencias lógicas y futuras

Desde la migración 012 existe la colección destino para:

```text
metricas_albergue.estado_actual.alertas_activas.ids[]
    → alertas._id
```

Continúan como referencias futuras:

```text
metricas_albergue.estado_actual.semaforo_vital.estado_semaforo_id
    → estados_semaforo._id
```

```text
analisis_ia.escenario_id
    → escenarios._id
```

```text
predicciones_sir.escenario_id
    → escenarios._id
```

Las referencias hacia `estados_semaforo` y `escenarios` se endurecerán cuando existan las colecciones destino.

---

# 19. Trazabilidad

Las colecciones operativas utilizan:

```text
registrado_por
created_at
updated_by
updated_at
```

según corresponda.

`metricas_albergue` utiliza:

```text
created_at
updated_at
```

porque representa un bucket mutable durante el día.

`analisis_ia` utiliza:

```text
registrado_por
created_at
```

`predicciones_sir` utiliza:

```text
registrado_por
created_at
```

`alertas` utiliza:

```text
registrado_por
created_at
updated_by
updated_at
```

porque conserva histórico pero permite cambios de ciclo de vida, como el cierre de una alerta.

`analisis_ia` y `predicciones_sir` son históricas append-only y no utilizan `updated_at` ni `updated_by`.

---

# 20. Resultados de pruebas

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

## `schema_migrations`

```text
ux_schema_migrations_version
```

Único.

---

# 22. Responsabilidad DBA

La capa DBA garantiza:

- estructura documental;
- tipos BSON;
- campos obligatorios;
- validadores;
- índices;
- migraciones;
- estado reproducible;
- integridad estructural;
- controles de referencias huérfanas;
- contrato poblacional;
- Bucket Pattern;
- Computed Pattern;
- contrato de resultados IA;
- contrato de resultados SIR;
- contrato estructural de alertas;
- ciclo de vida de alertas;
- trazabilidad de datos de origen de alertas;
- versionado de modelos;
- trazabilidad de datos fuente;
- parámetros SIR estructuralmente válidos;
- trayectoria SIR estructuralmente válida;
- pruebas DBA.

DBA no implementa:

```text
algoritmo SIR
reglas funcionales de generación de alertas
clasificación final del Semáforo Vital
autorización de usuarios
```

---

# 23. Responsabilidad Backend

Backend deberá garantizar:

- validar referencias antes de persistir;
- normalizar fechas;
- seleccionar correctamente fuentes de población;
- seleccionar correctamente registros epidemiológicos;
- garantizar coherencia del albergue;
- persistir una nueva ejecución por simulación;
- no sobrescribir simulaciones históricas;
- construir correctamente `datos_entrada`;
- registrar modelo y versión;
- registrar parámetros utilizados;
- registrar preprocesamiento;
- manejar errores MongoDB;
- controlar acceso asociado a `publica`;
- mantener separación entre ejecución real y escenarios futuros;
- generar alertas según las reglas funcionales aprobadas;
- validar coherencia de los datos de origen antes de persistir una alerta;
- cerrar alertas sin eliminar su histórico;
- controlar exposición pública de alertas mediante `publica`.

---

# 24. Responsabilidad del componente SIR

El componente responsable del modelo deberá producir correctamente:

```text
enfermedad
modelo.nombre
modelo.version
beta
gamma
condiciones iniciales
horizonte_dias
metodo_numerico
trayectoria
```

También deberá garantizar las reglas matemáticas que no forman parte del validator.

Entre ellas podrán encontrarse:

```text
S + I + R = N
conservación poblacional
secuencia temporal
coherencia entre horizonte y trayectoria
coherencia entre condiciones iniciales y datos observados
```

La especificación matemática final debe definir cuáles son obligatorias.

---

# 25. Separación entre IA y SIR

```text
analisis_ia
    → resultado analítico de riesgo

predicciones_sir
    → trayectoria epidemiológica
```

Una ejecución IA no equivale a una simulación SIR.

Una simulación SIR puede opcionalmente referenciar:

```text
analisis_ia_id
```

pero ambos resultados permanecen separados.

---

# 26. Relación con alertas

La colección:

```text
alertas
```

ya forma parte del modelo persistente.

Sus fuentes documentales aprobadas actualmente son:

```text
condiciones_sanitarias
casos_enfermedades
predicciones_sir
```

Una simulación SIR no constituye por sí sola una alerta oficial.

La generación de la alerta corresponde a la lógica funcional de Backend.

Actualmente no existe una referencia directa:

```text
alertas → analisis_ia
```

porque esa relación no forma parte del contrato aprobado.

---

# 27. Relación futura con estados del Semáforo Vital

La arquitectura prevista:

```text
analisis_ia
        ↓
resultado analítico

predicciones_sir
        ↓
resultado epidemiológico

alertas ✓
        ↓
alertas oficiales

estados_semaforo
    PENDIENTE
        ↓
estado oficial/histórico

metricas_albergue.estado_actual
        ↓
snapshot persistente

Redis
        ↓
caché temporal
```

---

# 28. Redis

MongoDB continuará siendo:

```text
fuente persistente de verdad
```

Redis será:

```text
caché temporal
```

Clave prevista:

```text
semaforo:estado:{albergue_id}
```

TTL:

```text
900 segundos
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

---

# 29. Seguridad

Las colecciones analíticas trabajan únicamente con información agregada.

No deben contener:

```text
nombres de pacientes
documentos de identidad
historias clínicas
identificadores individualizados
credenciales
contraseñas
tokens
secretos
```

`predicciones_sir` almacena cantidades epidemiológicas agregadas.

`alertas` almacena eventos agregados del albergue y referencias documentales; no debe incorporar datos clínicos individualizados.

---

# 30. Migraciones vigentes

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

Las migraciones aplicadas no deben modificarse retroactivamente.

---

# 31. Evolución del modelo

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

Antes de comenzar un checkpoint:

```text
git switch main
git pull origin main
```

Debe verificarse nuevamente el último número de migración.

---

# 32. Estado actual del contrato

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

Pruebas:

```text
condiciones_sanitarias     14/14
casos_enfermedades         14/14
intervenciones             15/15
metricas_albergue          18/18
analisis_ia                20/20
historial_poblacion        18/18
predicciones_sir           35/35
alertas                    40/40
```

El Checkpoint 7 deja formalmente implementado:

```text
Colección predicciones_sir                         ✓
Migración 011                                       ✓
Dependencia de migración 010                        ✓
Naturaleza histórica                                ✓
Enfermedad                                          ✓
Marcador publica                                    ✓
Modelo y versión                                    ✓
beta                                                 ✓
gamma                                                ✓
Condiciones iniciales S/I/R                         ✓
Horizonte temporal                                  ✓
Método numérico                                     ✓
Trazabilidad historial_poblacion                    ✓
Trazabilidad casos_enfermedades                     ✓
analisis_ia_id opcional                             ✓
escenario_id preparado                              ✓
Preprocesamiento                                    ✓
Trayectoria S/I/R                                   ✓
Valores continuos en trayectoria                    ✓
Índices históricos no únicos                        ✓
Control albergue_id                                 ✓
Control registrado_por                              ✓
Control historial_poblacion_ids                     ✓
Control casos_enfermedades_ids                      ✓
Control analisis_ia_id                              ✓
Init reproducible                                   ✓
Pruebas DBA                                        35/35
Documentación                                       ✓
```

El Checkpoint 8 deja formalmente implementado:

```text
Colección alertas                                  ✓
Migración 012                                      ✓
Dependencia de migración 011                       ✓
Validator strict                                   ✓
additionalProperties false                         ✓
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
3 índices históricos no únicos                     ✓
prioridad no incorporada sin definición            ✓
analisis_ia_id no incorporado sin aprobación       ✓
Init reproducible                                  ✓
Pruebas DBA                                      40/40
Documentación                                      ✓
```

Las reglas matemáticas deliberadamente pendientes son:

```text
S + I + R = N
conservación de población
longitud exacta de trayectoria
secuencia exacta de días
método numérico oficial
coherencia de fuentes con enfermedad y albergue
```

Estas reglas no deben incorporarse estructuralmente hasta contar con definición funcional y matemática aprobada.

El próximo número de migración disponible es:

```text
013
```

siempre que `main` no reciba otra migración antes del siguiente checkpoint.