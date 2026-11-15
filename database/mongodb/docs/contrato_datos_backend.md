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
- estados históricos del Semáforo Vital;
- relación entre histórico y snapshot actual;
- escenarios hipotéticos e intervenciones simuladas;
- relación de escenarios con IA y SIR;
- auditoría histórica de actividades (RF-52);
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
estados_semaforo
escenarios
auditoria_actividades
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
| estado oficial/histórico del Semáforo Vital | `estados_semaforo` |
| escenario hipotético | `escenarios` |
| intervención simulada | `escenarios.intervenciones_simuladas` |
| auditoría histórica de actividades | `auditoria_actividades` |

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

Las acciones simuladas corresponden a:

```text
escenarios.intervenciones_simuladas
```

La separación vigente es:

```text
intervenciones
    → acciones reales ejecutadas

escenarios.intervenciones_simuladas
    → acciones hipotéticas
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

`estado_actual` continúa opcional porque un albergue puede no tener todavía un cálculo oficial materializado.

Desde la migración 012 existe:

```text
metricas_albergue.estado_actual.alertas_activas.ids[]
    → alertas._id
```

Desde la migración 013 existe:

```text
metricas_albergue.estado_actual.semaforo_vital.estado_semaforo_id
    → estados_semaforo._id
```

`metricas_albergue.estado_actual.semaforo_vital` representa el snapshot persistente del último estado calculado.

El histórico oficial permanece en:

```text
estados_semaforo
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

`escenario_id` es opcional. Desde la migración 014, cuando está presente, referencia un escenario hipotético del mismo albergue:

```text
analisis_ia.escenario_id
    → escenarios._id
```

Las ejecuciones sobre datos reales pueden continuar sin `escenario_id`.

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

---

# 12.5 Enfermedad

`enfermedad` es un `String` obligatorio y no vacío.

Actualmente no utiliza `enum`.

Esto conserva compatibilidad con:

```text
casos_enfermedades.enfermedad
```

---

# 12.6 Campo `publica`

`publica` es `Boolean`.

Representa un marcador funcional.

No representa por sí mismo una autorización.

La autorización corresponde a Backend.

---

# 12.7 Identificación del modelo

```javascript
modelo: {
    nombre: String,
    version: String
}
```

Permite:

```text
trazabilidad
reproducibilidad
auditoría
comparación entre versiones
```

---

# 12.8 Parámetro `beta`

Acepta:

```text
double
int
long
decimal
```

Regla:

```text
beta >= 0
```

---

# 12.9 Parámetro `gamma`

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

---

# 12.10 Condiciones iniciales

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

---

# 12.11 Horizonte temporal

`horizonte_dias` debe ser `Int32` y:

```text
horizonte_dias >= 1
```

---

# 12.12 Método numérico

`metodo_numerico` es `String` no vacío.

Actualmente no existe `enum`.

---

# 12.13 Datos de entrada

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

Los arrays utilizan:

```text
uniqueItems: true
```

---

# 12.14 Fuente poblacional SIR

Fuente persistente:

```text
historial_poblacion
```

Relación:

```text
predicciones_sir.datos_entrada.historial_poblacion_ids[]
    → historial_poblacion._id
```

---

# 12.15 Casos epidemiológicos SIR

```text
predicciones_sir.datos_entrada.casos_enfermedades_ids[]
    → casos_enfermedades._id
```

`cantidad_casos_activos` representa casos activos en la fecha registrada.

---

# 12.16 Relación opcional con IA

```text
predicciones_sir.datos_entrada.analisis_ia_id
    → analisis_ia._id
```

La referencia es opcional.

---

# 12.17 Preprocesamiento

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

---

# 12.18 Trayectoria SIR

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

Debe contener al menos:

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

---

# 12.19 Reglas matemáticas no impuestas

El `$jsonSchema` no verifica actualmente:

```text
S + I + R = población inicial
trayectoria.length = horizonte_dias + 1
dia = 0, 1, 2, 3...
S + I + R permanece constante
todos los casos corresponden exactamente a enfermedad
```

Estas reglas corresponden a Backend o al componente matemático.

---

# 12.20 `escenario_id`

Es opcional.

Desde la migración 014 es una referencia lógica vigente:

```text
predicciones_sir.escenario_id
    → escenarios._id

auditoria_actividades.usuario_id
    → usuarios._id

auditoria_actividades.albergue_id
    → albergues._id cuando albergue_id contiene ObjectId
```

La ejecución sobre datos reales puede omitir `escenario_id`. Una ejecución hipotética puede asociarlo al escenario utilizado.

Cuando está presente, `predicciones_sir.albergue_id` y `escenarios.albergue_id` deben ser coherentes.

---

# 12.21 Índices de SIR

```text
ix_predicciones_sir_albergue_fecha
ix_predicciones_sir_albergue_enfermedad_fecha
ix_predicciones_sir_modelo_version_fecha
ix_predicciones_sir_escenario_fecha
```

Los cuatro son no únicos.

---

# 12.22 Ausencia deliberada de índices únicos

No existe índice único sobre:

```text
albergue_id + fecha_ejecucion
albergue_id + enfermedad + fecha_ejecucion
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

## 12A.4 Nivel de riesgo

```text
verde
amarillo
rojo
```

El historial oficial del Semáforo Vital corresponde a:

```text
estados_semaforo
```

## 12A.5 Ciclo de vida

Una alerta puede pasar de:

```text
activa = true
```

a:

```text
activa = false
```

sin eliminarse.

## 12A.6 Visibilidad pública

`publica` es un marcador funcional.

La autorización pertenece a Backend.

## 12A.7 Datos de origen

```text
condicion_sanitaria_id
casos_enfermedades_ids[]
prediccion_sir_id
```

Relaciones:

```text
alertas.datos_origen.condicion_sanitaria_id
    → condiciones_sanitarias._id

alertas.datos_origen.casos_enfermedades_ids[]
    → casos_enfermedades._id

alertas.datos_origen.prediccion_sir_id
    → predicciones_sir._id
```

## 12A.8 Catálogos pendientes

```text
tipo_alerta
fuente_datos
```

continúan abiertos.

## 12A.9 Campos deliberadamente no incorporados

```text
prioridad
datos_origen.analisis_ia_id
```

No forman parte del contrato vigente.

## 12A.10 Índices

```text
ix_alertas_albergue_fecha
ix_alertas_albergue_activa_fecha
ix_alertas_nivel_activa
```

No únicos.

---

# 12B. Colección `estados_semaforo`

Fue incorporada mediante:

```text
013_create_estados_semaforo.js
```

## 12B.1 Propósito

Persiste el histórico oficial de estados calculados del Semáforo Vital por albergue.

```text
alertas
    → histórico de alertas

estados_semaforo
    → histórico oficial de estados

metricas_albergue.estado_actual
    → snapshot persistente del último estado
```

## 12B.2 Estructura

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

## 12B.3 Campos obligatorios

```text
albergue_id
fecha_calculo
nivel
codigo
datos_origen
registrado_por
created_at
```

Dentro de `datos_origen`:

```text
condiciones_sanitarias_ids
casos_enfermedades_ids
alertas_ids
analisis_ia_ids
predicciones_sir_ids
metricas_albergue_ids
```

Los arrays pueden estar vacíos.

## 12B.4 Nivel

```text
verde
amarillo
rojo
```

## 12B.5 Código

`codigo` es:

```text
Int32
```

No existe todavía correspondencia numérica oficial entre código y color.

## 12B.6 Naturaleza histórica

```text
1 cálculo
=
1 documento nuevo
```

No utiliza:

```text
updated_at
updated_by
```

## 12B.7 Datos de origen

Los arrays utilizan:

```text
uniqueItems: true
```

Relaciones:

```text
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
```

Las fuentes deben pertenecer al mismo albergue cuando corresponda.

## 12B.8 Snapshot actual

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

## 12B.9 Reglas no impuestas por DBA

MongoDB no define:

```text
umbrales de clasificación
pesos
fórmulas
impacto exacto de alertas
combinación exacta IA + SIR
correspondencia numérica oficial de codigo
```

## 12B.10 Usuario técnico

`registrado_por` es obligatorio.

El usuario técnico para cálculos automáticos permanece pendiente de definición.

## 12B.11 Índices

```text
ix_estados_semaforo_albergue_fecha
ix_estados_semaforo_albergue_nivel_fecha
ix_estados_semaforo_nivel_fecha
```

No únicos.

---

# 12C. Colección `escenarios`

Fue incorporada mediante:

```text
014_create_escenarios.js
015_create_auditoria_actividades.js
```

## 12C.1 Propósito

Persiste escenarios hipotéticos asociados a un albergue para simular cambios en condiciones sanitarias e intervenciones sin alterar los datos reales.

La separación funcional es:

```text
intervenciones
    → acciones reales ejecutadas

escenarios.intervenciones_simuladas
    → acciones hipotéticas
```

Los resultados derivados continúan en sus colecciones especializadas:

```text
analisis_ia
predicciones_sir
```

## 12C.2 Estructura

```javascript
{
    _id: ObjectId,

    albergue_id: ObjectId,

    nombre: String,

    descripcion: String,

    datos_base: {
        registros_diarios_ids: [ObjectId],
        historial_poblacion_ids: [ObjectId],
        condiciones_sanitarias_ids: [ObjectId],
        casos_enfermedades_ids: [ObjectId],
        metricas_albergue_ids: [ObjectId],
        estados_semaforo_ids: [ObjectId]
    },

    condiciones_simuladas: {
        agua_potable_disponible: Boolean,
        banos_disponibles: Int32,
        letrinas: Int32,
        litros_agua: Number,
        estado_higiene: String,
        estado_saneamiento: String,

        otros_recursos_sanitarios: [
            {
                nombre: String,
                cantidad: Int32,
                observacion: String
            }
        ]
    },

    intervenciones_simuladas: [
        {
            tipo_intervencion: String,
            descripcion: String,
            observaciones: String
        }
    ],

    registrado_por: ObjectId,

    created_at: Date
}
```

## 12C.3 Campos obligatorios

Son obligatorios:

```text
albergue_id
nombre
datos_base
condiciones_simuladas
intervenciones_simuladas
registrado_por
created_at
```

`descripcion` es opcional.

Dentro de `datos_base` son obligatorios los seis arrays:

```text
registros_diarios_ids
historial_poblacion_ids
condiciones_sanitarias_ids
casos_enfermedades_ids
metricas_albergue_ids
estados_semaforo_ids
```

Los arrays pueden estar vacíos y utilizan:

```text
uniqueItems: true
```

## 12C.4 Condiciones simuladas

Son obligatorios:

```text
agua_potable_disponible
banos_disponibles
estado_higiene
estado_saneamiento
otros_recursos_sanitarios
```

Son opcionales:

```text
letrinas
litros_agua
```

Reglas estructurales:

```text
banos_disponibles >= 0
letrinas >= 0, cuando exista
litros_agua >= 0, cuando exista
otros_recursos_sanitarios[].cantidad >= 0
```

No se definen enums artificiales para:

```text
estado_higiene
estado_saneamiento
```

porque sus catálogos funcionales permanecen pendientes.

## 12C.5 Intervenciones simuladas

`intervenciones_simuladas` es un array obligatorio que puede estar vacío.

Cada elemento requiere:

```text
tipo_intervencion
descripcion
```

`observaciones` es opcional.

`tipo_intervencion` continúa como `String` abierto hasta que exista catálogo funcional aprobado.

Una intervención simulada no crea ni modifica documentos en la colección `intervenciones`.

## 12C.6 Datos base y trazabilidad

Relaciones:

```text
escenarios.datos_base.registros_diarios_ids[]
    → registros_diarios._id

escenarios.datos_base.historial_poblacion_ids[]
    → historial_poblacion._id

escenarios.datos_base.condiciones_sanitarias_ids[]
    → condiciones_sanitarias._id

escenarios.datos_base.casos_enfermedades_ids[]
    → casos_enfermedades._id

escenarios.datos_base.metricas_albergue_ids[]
    → metricas_albergue._id

escenarios.datos_base.estados_semaforo_ids[]
    → estados_semaforo._id
```

Cuando una referencia está presente, debe existir y pertenecer al mismo `albergue_id` del escenario.

## 12C.7 Relación con IA y SIR

Desde la migración 014 son relaciones lógicas vigentes:

```text
analisis_ia.escenario_id
    → escenarios._id

predicciones_sir.escenario_id
    → escenarios._id
```

`escenario_id` permanece opcional en ambas colecciones.

Regla conceptual:

```text
ejecución real
    → escenario_id ausente

ejecución hipotética
    → escenario_id presente
```

Cuando está presente, el escenario y el resultado analítico deben pertenecer al mismo albergue.

## 12C.8 Naturaleza histórica

`escenarios` se trata como colección histórica / append-only.

No utiliza:

```text
updated_at
updated_by
```

La razón es preservar reproducibilidad: una ejecución IA o SIR que referencia un escenario debe conservar la hipótesis exacta utilizada.

Una nueva hipótesis debe generar un nuevo documento.

## 12C.9 Resultados no embebidos

`escenarios` no almacena resultados analíticos como:

```text
probabilidad_riesgo
beta
gamma
trayectoria SIR
nivel del Semáforo resultante
ranking de intervención
prioridad calculada
```

Estos resultados pertenecen a los componentes y colecciones especializadas.

## 12C.10 Reglas no impuestas por DBA

MongoDB no determina:

```text
cómo cambia beta ante una intervención
cómo cambia gamma
cómo afecta higiene al riesgo
cómo afecta agua potable al riesgo
qué intervención reduce más el riesgo
qué escenario debe priorizarse
qué nivel de Semáforo resultaría
cómo comparar gráficas
```

Estas reglas corresponden a Backend y a los componentes analíticos cuando exista definición funcional aprobada.

## 12C.11 Índices

```text
ix_escenarios_albergue_created_at
```

No único.

Además, para recuperar resultados por escenario:

```text
ix_analisis_ia_escenario_fecha
ix_predicciones_sir_escenario_fecha
```

No únicos.

---

# 12D. Colección `auditoria_actividades`

Incorporada mediante:

```text
015_create_auditoria_actividades.js
```

## Propósito

`auditoria_actividades` conserva el histórico de actividades realizadas dentro del sistema y soporta el requerimiento **RF-52 Auditoría**, que permite al `super_administrador` consultar los registros de actividades.

Esta colección define el contrato persistente; la captura efectiva de eventos y las decisiones funcionales corresponden a Backend.

## Estructura

```javascript
{
    _id: ObjectId,
    usuario_id: ObjectId,
    albergue_id: ObjectId | null,
    fecha_actividad: Date,
    accion: String,
    entidad: String,
    entidad_id: ObjectId | null,
    descripcion: String,
    created_at: Date
}
```

## Campos obligatorios

```text
usuario_id
albergue_id
fecha_actividad
accion
entidad
entidad_id
created_at
```

`descripcion` es opcional. Se exige la presencia explícita de `albergue_id` y `entidad_id`, aunque puedan contener `null`.

## Usuario y albergue

`usuario_id` es un `ObjectId` que referencia lógicamente `usuarios._id` y representa el usuario responsable de la actividad. Para eventos automáticos queda pendiente la definición funcional de un usuario técnico; DBA no crea usuarios técnicos por iniciativa propia.

`albergue_id` acepta `ObjectId` o `null`. Cuando tiene un `ObjectId` referencia `albergues._id`; `null` permite representar una actividad global. Backend determina cuándo procede ese valor.

No se impone que `usuarios.albergue_id = auditoria_actividades.albergue_id`, porque un `super_administrador` puede operar sobre varios albergues. Backend valida los permisos efectivos.

## Fecha, acción y entidad

`fecha_actividad` es el instante funcional de ocurrencia, almacenado como BSON `Date` (instante UTC). `created_at` corresponde al instante técnico de persistencia.

`accion` y `entidad` deben ser cadenas no vacías. No se establecen `enum` para estos campos porque todavía no existe un catálogo funcional cerrado aprobado.

`entidad_id` acepta `ObjectId` o `null` e identifica, cuando exista, el documento relacionado. Su vínculo depende de `entidad`, por lo que no se crea una foreign key dinámica artificial ni se inventa un catálogo cerrado de entidades.

`descripcion` proporciona contexto legible opcional y no debe incorporar contraseñas, tokens, credenciales, secretos ni datos clínicos individualizados.

## Naturaleza histórica append-only

```text
1 actividad = 1 documento nuevo
```

Los eventos no incorporan `updated_at` ni `updated_by`. Una nueva actividad exige un nuevo documento, no la modificación de un evento anterior.

El `$jsonSchema` valida la estructura, pero **no impide físicamente** operaciones `UPDATE` o `DELETE`. Backend y los permisos de base de datos deben respaldar la política append-only cuando corresponda.

## Alcance de auditoría

El contrato contempla usuario, albergue relacionado, fecha, acción, entidad, documento relacionado, descripción y fecha técnica.

No incorpora actualmente campos forenses como `ip`, `user_agent`, `session_id`, `request_id`, `endpoint`, `metodo_http`, `before`, `after`, `valor_anterior`, `valor_nuevo`, `motivo`, `resultado` o `payload`, porque RF-52 no los define. Cualquier ampliación requerirá evolución del contrato mediante nueva migración.

## Integridad

La migración 015 comprueba que `usuario_id` corresponda a `usuarios._id` y que `albergue_id`, cuando no sea `null`, corresponda a `albergues._id`.

MongoDB no valida las autorizaciones funcionales de usuario. Tampoco implementa claves foráneas dinámicas basadas en `entidad`.

## Índices

```javascript
// ix_auditoria_fecha
{ fecha_actividad: -1 }

// ix_auditoria_usuario_fecha
{ usuario_id: 1, fecha_actividad: -1 }

// ix_auditoria_albergue_fecha
{ albergue_id: 1, fecha_actividad: -1 }

// ix_auditoria_entidad_fecha
{ entidad: 1, entidad_id: 1, fecha_actividad: -1 }
```

Los cuatro índices son **no únicos** y permiten consulta cronológica global, por usuario, por albergue y por entidad/documento.

## Responsabilidad Backend

Backend deberá definir qué operaciones generan auditoría, los valores de `accion` y `entidad`, cuándo las referencias opcionales contienen `null`, el contenido de `descripcion`, los roles habilitados para consulta y la identidad de los procesos automáticos.


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

---

# 14. Idempotencia de migración 011

Utiliza:

```text
collMod
```

cuando la colección ya existe.

No utiliza:

```text
drop
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

---

# 14B. Idempotencia de migración 012

Si la colección existe utiliza:

```text
collMod
```

No utiliza:

```text
drop
```

---

# 14C. Migración 013

Archivo:

```text
database/mongodb/migrations/013_create_estados_semaforo.js
```

Dependencia:

```text
012_create_alertas
```

Colecciones requeridas:

```text
usuarios
albergues
condiciones_sanitarias
casos_enfermedades
alertas
analisis_ia
predicciones_sir
metricas_albergue
schema_migrations
```

La migración:

- crea o actualiza `estados_semaforo`;
- aplica `$jsonSchema`;
- configura validación `strict`;
- configura `validationAction: error`;
- crea tres índices históricos no únicos;
- valida `albergue_id`;
- valida `registrado_por`;
- valida referencias de los seis arrays de `datos_origen`;
- verifica coherencia de albergue;
- registra la migración;
- verifica registro único;
- verifica índices.

---

# 14D. Idempotencia de migración 013

Si la colección ya existe utiliza:

```text
collMod
```

No ejecuta:

```text
drop
```

La migración queda aplicada cuando existe exactamente un documento:

```text
version = 013_create_estados_semaforo
```

en:

```text
schema_migrations
```

---

# 14E. Migración 014

Archivo:

```text
database/mongodb/migrations/014_create_escenarios.js
```

Dependencia:

```text
013_create_estados_semaforo
```

Colecciones requeridas:

```text
usuarios
albergues
registros_diarios
historial_poblacion
condiciones_sanitarias
casos_enfermedades
metricas_albergue
analisis_ia
predicciones_sir
estados_semaforo
schema_migrations
```

La migración:

- crea o actualiza `escenarios`;
- aplica `$jsonSchema`;
- configura validación `strict`;
- configura `validationAction: error`;
- crea el índice de escenarios por albergue y fecha de creación;
- crea índices de `analisis_ia` y `predicciones_sir` por `escenario_id`;
- valida `albergue_id`;
- valida `registrado_por`;
- valida referencias de los seis arrays de `datos_base`;
- verifica coherencia de albergue;
- activa el control referencial lógico de `analisis_ia.escenario_id`;
- activa el control referencial lógico de `predicciones_sir.escenario_id`;
- registra la migración;
- verifica registro único;
- verifica índices.

---

# 14F. Idempotencia de migración 014

Si la colección ya existe utiliza:

```text
collMod
```

No ejecuta:

```text
drop
```

La migración queda aplicada cuando existe exactamente un documento:

```text
version = 014_create_escenarios
```

en:

```text
schema_migrations
```

---

# 14G. Migración 015

Archivo:

```text
database/mongodb/migrations/015_create_auditoria_actividades.js
```

Dependencia:

```text
014_create_escenarios
```

Colecciones requeridas: `usuarios`, `albergues`, `schema_migrations`.

La migración incorpora el contrato estructural de `auditoria_actividades`, configura `$jsonSchema` con validación `strict`, `validationAction: error` y `additionalProperties: false`, crea cuatro índices históricos no únicos y verifica referencias a usuarios y a albergues cuando están presentes.

Conserva las acciones y entidades como cadenas abiertas, sin definir enums arbitrarios. Su propósito es garantizar persistencia válida, no capturar eventos automáticamente.

---

# 14H. Idempotencia de migración 015

Para una colección existente, el patrón de mantenimiento es `collMod` sin `drop`, conservando datos existentes. El control de versiones corresponde a `schema_migrations`, donde debe existir una sola entrada con `version = 015_create_auditoria_actividades` una vez aplicada.


---

# 15. Inicialización reproducible

Archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

Administra:

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
escenarios
auditoria_actividades
schema_migrations
```

Utiliza:

```text
createCollection
```

para colecciones inexistentes y:

```text
collMod
```

para colecciones existentes.

Reproduce también los índices de:

```text
predicciones_sir
alertas
estados_semaforo
escenarios
auditoria_actividades
```

---

# 16. Pruebas DBA de SIR

```text
test_predicciones_sir.js
35/35
```

---

# 16A. Pruebas DBA de alertas

```text
test_alertas.js
40/40
```

---

# 16B. Pruebas DBA de estados del Semáforo Vital

Archivo:

```text
database/mongodb/tests/test_estados_semaforo.js
```

Resultado:

```text
Pruebas exitosas: 50
Pruebas fallidas: 0
```

Cobertura:

```text
documento válido
campos obligatorios
tipos BSON
nivel verde/amarillo/rojo
codigo Int32
datos_origen
seis arrays obligatorios
arrays vacíos permitidos
uniqueItems
additionalProperties
naturaleza histórica append-only
ausencia de updated_at
ausencia de updated_by
múltiples cálculos históricos
referencias válidas
referencias huérfanas
coherencia de albergue
índices no únicos
migración registrada
validationLevel strict
validationAction error
ausencia deliberada de prioridad
ausencia deliberada de fórmulas de clasificación
```

---

# 16C. Pruebas DBA de escenarios

Archivo:

```text
database/mongodb/tests/test_escenarios.js
```

Resultado:

```text
Pruebas exitosas: 69
Pruebas fallidas: 0
```

Cobertura principal:

```text
documento válido
campos obligatorios
tipos BSON
datos_base obligatorio
seis arrays obligatorios
uniqueItems
condiciones_simuladas
letrinas opcionales
litros_agua opcionales
otros recursos sanitarios
intervenciones_simuladas
separación entre intervenciones reales y simuladas
additionalProperties false
naturaleza histórica append-only
ausencia de updated_at
ausencia de updated_by
referencias huérfanas
coherencia de albergue
integración analisis_ia.escenario_id
integración predicciones_sir.escenario_id
índices no únicos
migración registrada
validationLevel strict
validationAction error
```

---

## 16D. Pruebas DBA de auditoría de actividades

```text
test_auditoria_actividades.js
Pruebas exitosas: 42
Pruebas fallidas: 0
```

Resultado reportado en el Checkpoint 12.

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

escenarios.albergue_id
    → albergues._id

escenarios.registrado_por
    → usuarios._id

escenarios.datos_base.registros_diarios_ids[]
    → registros_diarios._id

escenarios.datos_base.historial_poblacion_ids[]
    → historial_poblacion._id

escenarios.datos_base.condiciones_sanitarias_ids[]
    → condiciones_sanitarias._id

escenarios.datos_base.casos_enfermedades_ids[]
    → casos_enfermedades._id

escenarios.datos_base.metricas_albergue_ids[]
    → metricas_albergue._id

escenarios.datos_base.estados_semaforo_ids[]
    → estados_semaforo._id

analisis_ia.escenario_id
    → escenarios._id

predicciones_sir.escenario_id
    → escenarios._id
```

MongoDB `$jsonSchema` no implementa foreign keys.

Los controles DBA utilizan `$lookup`.

---

# 18. Referencias lógicas vigentes

Relación vigente:

```text
metricas_albergue.estado_actual.alertas_activas.ids[]
    → alertas._id
```

Relación vigente desde la migración 013:

```text
metricas_albergue.estado_actual.semaforo_vital.estado_semaforo_id
    → estados_semaforo._id
```

Relaciones vigentes desde la migración 014:

```text
analisis_ia.escenario_id
    → escenarios._id

predicciones_sir.escenario_id
    → escenarios._id
```

Ambas referencias son opcionales y se utilizan para distinguir ejecuciones hipotéticas de ejecuciones sobre datos reales.

---

La auditoría registra referencias lógicas a usuarios y, cuando aplica, a albergues. `entidad_id` no es una foreign key dinámica impuesta por MongoDB.

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

`estados_semaforo` utiliza:

```text
registrado_por
created_at
```

`escenarios` utiliza:

```text
registrado_por
created_at
```

`auditoria_actividades` utiliza `usuario_id`, `albergue_id`, `fecha_actividad`, `accion`, `entidad`, `entidad_id`, `created_at` y `descripcion` opcional. No utiliza `updated_at` ni `updated_by`.

`analisis_ia`, `predicciones_sir`, `estados_semaforo`, `escenarios` y `auditoria_actividades` son históricos append-only.

---

# 20. Resultados de pruebas

```text
test_validaciones.js                 8/8
test_integridad_qa.js              12/12
test_condiciones_sanitarias.js     14/14
test_casos_enfermedades.js         14/14
test_intervenciones.js             15/15
test_metricas_albergue.js          18/18
test_analisis_ia.js                20/20
test_historial_poblacion.js        18/18
test_predicciones_sir.js           35/35
test_alertas.js                    40/40
test_estados_semaforo.js           50/50
test_escenarios.js                 69/69
test_auditoria_actividades.js      42/42
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
ix_analisis_ia_escenario_fecha
```

## `predicciones_sir`

```text
ix_predicciones_sir_albergue_fecha
ix_predicciones_sir_albergue_enfermedad_fecha
ix_predicciones_sir_modelo_version_fecha
ix_predicciones_sir_escenario_fecha
```

## `alertas`

```text
ix_alertas_albergue_fecha
ix_alertas_albergue_activa_fecha
ix_alertas_nivel_activa
```

## `estados_semaforo`

```text
ix_estados_semaforo_albergue_fecha
ix_estados_semaforo_albergue_nivel_fecha
ix_estados_semaforo_nivel_fecha
```

No únicos.

## `escenarios`

```text
ix_escenarios_albergue_created_at
```

No único.

## `auditoria_actividades`

```text
ix_auditoria_fecha
ix_auditoria_usuario_fecha
ix_auditoria_albergue_fecha
ix_auditoria_entidad_fecha
```

Los cuatro son no únicos.

## `schema_migrations`

```text
ux_schema_migrations_version
```

---

`auditoria_actividades` conserva metadatos funcionales y no debe incluir `password_hash`, contraseñas, credenciales, tokens, secretos, datos clínicos individualizados ni payloads completos sensibles. La descripción debe contener solamente el contexto indispensable para trazabilidad.

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
- contrato histórico de estados del Semáforo Vital;
- trazabilidad de fuentes utilizadas por cada estado;
- relación estructural entre histórico y snapshot actual;
- contrato estructural de escenarios hipotéticos;
- separación entre intervenciones reales y simuladas;
- trazabilidad de datos base utilizados por escenarios;
- coherencia de `escenario_id` con IA y SIR;
- versionado de modelos;
- trazabilidad de datos fuente;
- parámetros SIR estructuralmente válidos;
- trayectoria SIR estructuralmente válida;
- pruebas DBA;
- contrato histórico de auditoría de actividades;
- validación estructural de eventos de auditoría;
- referencias de auditoría a usuarios y opcionalmente albergues;
- índices cronológicos, por usuario, albergue y entidad;
- naturaleza append-only de los eventos de auditoría.

DBA no implementa:

```text
algoritmo SIR
reglas funcionales de generación de alertas
clasificación final del Semáforo Vital
priorización funcional de intervenciones simuladas
autorización de usuarios
captura automática de actividades
autorización para consultar auditoría
definición funcional de acciones auditables
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
- mantener separación entre ejecuciones reales y escenarios hipotéticos;
- crear nuevos escenarios sin sobrescribir hipótesis históricas;
- garantizar que las fuentes de `datos_base` pertenezcan al albergue del escenario;
- asociar `escenario_id` a IA/SIR únicamente cuando corresponda a una simulación hipotética;
- generar alertas según reglas funcionales aprobadas;
- validar coherencia de los datos de origen de alertas;
- cerrar alertas sin eliminar histórico;
- calcular el estado del Semáforo Vital según reglas funcionales aprobadas;
- persistir un nuevo documento en `estados_semaforo` por cada cálculo;
- validar la coherencia de las fuentes del estado;
- actualizar `metricas_albergue.estado_actual.semaforo_vital` después de persistir el estado;
- registrar eventos en `auditoria_actividades` cuando corresponda;
- definir qué operaciones generan auditoría y los valores de `accion` y `entidad`;
- asignar `usuario_id`, `albergue_id` y `entidad_id` correctamente, utilizando `null` cuando aplique;
- evitar secretos o datos sensibles en `descripcion`;
- autorizar la consulta de auditoría exclusivamente a roles permitidos;
- preservar los eventos históricos sin sobrescritura;
- definir el usuario técnico de los procesos automáticos cuando exista aprobación.

---

# 24. Responsabilidad del componente SIR

El componente responsable deberá producir correctamente:

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

Además deberá garantizar las reglas matemáticas que no pertenecen al validator.

---

# 25. Separación entre IA y SIR

```text
analisis_ia
    → resultado analítico de riesgo

predicciones_sir
    → trayectoria epidemiológica
```

Ambos resultados permanecen separados.

---

# 26. Relación con alertas

`alertas` forma parte del modelo persistente.

Fuentes aprobadas actualmente:

```text
condiciones_sanitarias
casos_enfermedades
predicciones_sir
```

Una simulación SIR no constituye por sí sola una alerta oficial.

---

# 27. Relación con estados del Semáforo Vital

Arquitectura vigente:

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

estados_semaforo ✓
        ↓
estado oficial/histórico

metricas_albergue.estado_actual
        ↓
snapshot persistente

Redis
        ↓
caché temporal
```

`estados_semaforo` es la fuente histórica oficial.

`metricas_albergue.estado_actual` conserva el snapshot persistente.

---

# 27A. Relación con escenarios

Arquitectura vigente:

```text
datos reales
    │
    ├──────────────┐
    │              │
    ▼              ▼
MongoDB        escenarios
                  │
                  ├── condiciones_simuladas
                  │
                  └── intervenciones_simuladas
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
         analisis_ia              predicciones_sir
```

`escenarios` conserva la hipótesis.

`analisis_ia` y `predicciones_sir` conservan los resultados de las ejecuciones asociadas mediante `escenario_id`.

La comparación y priorización de escenarios corresponde a Backend y componentes analíticos; MongoDB conserva el contrato y la trazabilidad.

---

# 27B. Relación con auditoría

```text
Usuario / proceso
       │
       ▼
     Backend
       ├── operación funcional
       └── evento de auditoría
                 │
                 ▼
        auditoria_actividades
                 │
                 ▼
      consulta super_administrador
```

MongoDB conserva los documentos de auditoría. Backend decide cuándo generarlos y quién puede consultarlos. Redis no sustituye ni almacena este histórico.

---

# 28. Redis

Redis forma parte de la arquitectura vigente como caché temporal del estado actual del Semáforo Vital.

MongoDB continúa siendo:

```text
fuente persistente de verdad
```

Redis es:

```text
caché temporal de lectura
```

La relación vigente es:

```text
estados_semaforo
    ↓
histórico oficial

metricas_albergue.estado_actual
    ↓
snapshot persistente

Redis
    ↓
snapshot temporal
```

Redis no reemplaza:

```text
historial_poblacion
metricas_albergue
analisis_ia
predicciones_sir
alertas
estados_semaforo
auditoria_actividades
```

## 28.1 Key

Contrato:

```text
semaforo:estado:{albergue_id}
```

Configuración:

```env
REDIS_KEY_PREFIX=semaforo:estado
```

## 28.2 TTL

TTL vigente:

```text
900 segundos
```

Configuración:

```env
REDIS_TTL_SECONDS=900
```

## 28.3 Payload

El snapshot Redis contiene:

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

Las fechas se serializan mediante:

```text
ISO 8601
```

Los campos sin información disponible pueden representarse mediante:

```text
null
```

## 28.4 Lectura

Flujo:

```text
Backend
    ↓
Redis GET
    │
    ├── HIT
    │     ↓
    │   respuesta
    │
    └── MISS
          ↓
       MongoDB
          ↓
    construir snapshot
          ↓
       Redis SETEX
          ↓
       respuesta
```

## 28.5 Fallback

Redis debe considerarse una dependencia no crítica.

Ante:

```text
Redis no configurado
Redis no disponible
error de lectura
error de escritura
contenido JSON inválido
```

el Backend debe continuar utilizando MongoDB.

No debe producirse pérdida de disponibilidad funcional únicamente por indisponibilidad de Redis.

## 28.6 Invalidación

La invalidación utiliza:

```text
DEL semaforo:estado:{albergue_id}
```

Después de invalidar:

```text
siguiente lectura
    ↓
MongoDB
    ↓
nuevo snapshot
    ↓
Redis
```

## 28.7 Separación de responsabilidades

La implementación utiliza:

```text
CachedShelterRepository
```

como decorador de:

```text
ShelterRepository
```

Por tanto:

```text
Domain
    → no conoce Redis

Application
    → no conoce Redis

Infrastructure
    → implementa cache Redis
```

`ShelterService` continúa dependiendo del contrato `ShelterRepository`.

## 28.8 Redis y MongoDB

Redis no debe utilizarse para:

```text
persistencia histórica
auditoría
reconstrucción definitiva de información
fuente oficial del Semáforo Vital
historial de alertas
historial SIR
historial IA
```

La información definitiva debe poder reconstruirse desde MongoDB aunque Redis se encuentre vacío o indisponible.

## 28.9 Infraestructura

Servicio Docker:

```text
redis:7.4-alpine
```

Puerto:

```text
6379
```

Healthcheck:

```text
redis-cli ping
```

Persistencia Redis:

```text
deshabilitada
```

La decisión es coherente con su función exclusivamente temporal.

## 28.10 Configuración

Entorno local:

```env
REDIS_URL=redis://localhost:6379/0
REDIS_TTL_SECONDS=900
REDIS_KEY_PREFIX=semaforo:estado
```

Docker:

```text
REDIS_URL=redis://redis:6379/0
```

## 28.11 Pruebas específicas

```text
test_redis_cache.py                  13/13
test_redis_dependency.py              3/3
test_semaforo_cache_snapshot.py       3/3
test_semaforo_cache.py                8/8
```

Total:

```text
27/27
```

Se validan:

```text
HIT
MISS
TTL
fallback
serialización
invalidación
fallo Redis
snapshot
FastAPI dependency
MongoDB como fuente de verdad
```

## 28.12 Migraciones

Redis no modifica el esquema MongoDB.

Por lo tanto:

```text
no existe migración Redis
```

En el Checkpoint 10, el número `014` quedó disponible porque Redis no requirió cambios estructurales en MongoDB.

Posteriormente, el Checkpoint 11 utilizó ese número para:

```text
014_create_escenarios.js
```

El Checkpoint 12 utilizó:

```text
015_create_auditoria_actividades.js
```

La auditoría no modifica el papel de Redis.

El siguiente número disponible pasa a ser:

```text
016
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

`alertas` almacena eventos agregados.

`estados_semaforo` almacena estados agregados y referencias documentales.

`escenarios` almacena hipótesis sanitarias agregadas y referencias documentales; no debe contener datos individualizados de pacientes.

`auditoria_actividades` conserva metadatos de actividades, sin datos clínicos individualizados ni secretos.

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
013_create_estados_semaforo.js
014_create_escenarios.js
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
estados_semaforo                ✓
escenarios                      ✓
auditoria_actividades           ✓
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
014_create_escenarios                      ✓
015_create_auditoria_actividades            ✓
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
estados_semaforo           50/50
escenarios                  69/69
auditoria_actividades       42/42
```

El Checkpoint 9 deja formalmente implementado:

```text
Colección estados_semaforo                          ✓
Migración 013                                       ✓
Dependencia de migración 012                        ✓
Validator strict                                    ✓
additionalProperties false                          ✓
Naturaleza histórica append-only                    ✓
nivel verde/amarillo/rojo                           ✓
codigo Int32 sin mapeo artificial                   ✓
datos_origen obligatorio                            ✓
seis arrays obligatorios                            ✓
uniqueItems                                         ✓
arrays vacíos permitidos                            ✓
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

El Checkpoint 10 deja formalmente implementado:

```text
Redis como caché temporal                              ✓
MongoDB como fuente persistente                        ✓
Key semaforo:estado:{albergue_id}                     ✓
TTL 900 segundos                                      ✓
Snapshot de consulta                                  ✓
estado_semaforo_id                                    ✓
ultima_actualizacion                                  ✓
Cache HIT                                             ✓
Cache MISS                                            ✓
Fallback a MongoDB                                    ✓
Invalidación                                          ✓
ISO 8601                                              ✓
Redis sin persistencia obligatoria                    ✓
Docker Compose                                        ✓
Healthcheck                                           ✓
CachedShelterRepository                               ✓
Redis fuera del dominio                               ✓
Redis fuera de Application                            ✓
Pruebas específicas                                27/27
Nueva migración MongoDB                    no requerida
```

El Checkpoint 11 deja formalmente implementado:

```text
Colección escenarios                                  ✓
Migración 014                                         ✓
Dependencia de migración 013                          ✓
Validator strict                                      ✓
additionalProperties false                            ✓
Naturaleza histórica append-only                      ✓
datos_base obligatorio                                ✓
seis arrays de trazabilidad                           ✓
uniqueItems en referencias                            ✓
condiciones_simuladas                                 ✓
agua potable hipotética                               ✓
baños hipotéticos                                     ✓
letrinas opcionales                                   ✓
litros de agua opcionales                             ✓
higiene y saneamiento simulados                       ✓
otros recursos sanitarios                             ✓
intervenciones_simuladas                              ✓
intervenciones reales y simuladas separadas           ✓
analisis_ia.escenario_id integrado                    ✓
predicciones_sir.escenario_id integrado               ✓
coherencia de albergue                                ✓
referencias huérfanas controladas                     ✓
índice escenarios por albergue                        ✓
índice IA por escenario                               ✓
índice SIR por escenario                              ✓
Init reproducible                                     ✓
Pruebas DBA                                         69/69
Documentación                                         ✓
```

El Checkpoint 12 incorpora al contrato:

```text
Colección auditoria_actividades                       ✓
Migración 015                                         ✓
Dependencia de migración 014                          ✓
RF-52 Auditoría                                       ✓
Validator strict                                      ✓
additionalProperties false                            ✓
Naturaleza histórica append-only                      ✓
usuario_id obligatorio                                ✓
albergue_id ObjectId o null                           ✓
fecha_actividad obligatoria                           ✓
accion String abierta                                 ✓
entidad String abierta                                ✓
entidad_id ObjectId o null                            ✓
descripcion opcional                                  ✓
created_at obligatorio                                ✓
updated_at no permitido                               ✓
updated_by no permitido                               ✓
usuario_id → usuarios._id                             ✓
albergue_id → albergues._id cuando aplica             ✓
entidad_id sin foreign key dinámica artificial        ✓
catálogo de acciones no inventado                     ✓
catálogo de entidades no inventado                    ✓
campos forenses no inventados                         ✓
usuario técnico automático pendiente                  ✓
índice cronológico global                             ✓
índice por usuario                                    ✓
índice por albergue                                   ✓
índice por entidad/documento                          ✓
Init reproducible                                     ✓
Pruebas DBA                                         42/42
```

El contrato actual queda:

```text
MongoDB
    → persistencia definitiva

Redis
    → optimización temporal de lectura

escenarios
    → hipótesis persistentes y trazables

analisis_ia / predicciones_sir
    → resultados analíticos asociados opcionalmente mediante escenario_id
```

Reglas matemáticas pendientes:

```text
S + I + R = N
conservación de población
longitud exacta de trayectoria
secuencia exacta de días
método numérico oficial
coherencia de fuentes con enfermedad y albergue
```

Decisiones funcionales pendientes relacionadas con escenarios:

```text
catálogo oficial de estado_higiene
catálogo oficial de estado_saneamiento
catálogo oficial de tipo_intervencion
fórmulas para impacto de intervenciones
reglas de comparación de escenarios
reglas de priorización de intervenciones
```

El próximo número de migración disponible es:

```text
016
```

siempre que `main` no reciba otra migración antes del siguiente checkpoint.