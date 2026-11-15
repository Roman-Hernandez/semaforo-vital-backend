# Contrato de datos MongoDB — Semáforo Vital

## 1. Objetivo

Este documento define el contrato vigente entre MongoDB y las capas consumidoras de **Semáforo Vital**.

Incluye:

- estructura documental;
- tipos BSON;
- reglas estructurales;
- referencias lógicas;
- trazabilidad;
- contratos de población;
- condiciones sanitarias;
- casos epidemiológicos;
- intervenciones;
- métricas;
- IA;
- SIR;
- alertas;
- evolución futura hacia estados del Semáforo Vital y Redis.

Base de datos:

```text
semaforo_vital
```

---

# 2. Colecciones vigentes

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

---

# 3. Convenciones

Nomenclatura:

```text
snake_case
```

Identificador técnico:

```text
_id: ObjectId
```

Zona horaria funcional:

```text
America/Bogota
```

MongoDB almacena `Date` como instante UTC.

---

# 4. Población

La fuente oficial para nuevos flujos es:

```text
historial_poblacion
```

Arquitectura:

```text
historial_poblacion
    → población diaria oficial

registros_diarios.poblacion
    → valor histórico embebido

metricas_albergue
    → telemetría intradía
```

Regla de historial:

```text
1 albergue + 1 fecha
=
1 documento
```

Índice:

```text
ux_historial_poblacion_albergue_fecha
```

---

# 5. Condiciones sanitarias

Colección:

```text
condiciones_sanitarias
```

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

`estado_higiene`, `estado_saneamiento` y `fuente_datos` permanecen abiertos hasta definición funcional.

---

# 6. Casos epidemiológicos

Colección:

```text
casos_enfermedades
```

Campo principal:

```text
cantidad_casos_activos
```

Semántica:

```text
casos activos en la fecha del registro
```

No representa:

```text
casos nuevos
casos acumulados
```

Índices:

```text
ix_casos_enfermedades_albergue_fecha
ix_casos_enfermedades_albergue_enfermedad_fecha
```

---

# 7. Intervenciones

Colección:

```text
intervenciones
```

Registra exclusivamente acciones reales.

No contiene simulaciones.

Los escenarios hipotéticos serán gestionados posteriormente mediante:

```text
escenarios
```

---

# 8. Métricas de albergue

Colección:

```text
metricas_albergue
```

Patrones:

```text
Bucket Pattern
Computed Pattern
```

Unidad:

```text
1 albergue + 1 fecha_bucket
```

Snapshot:

```javascript
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
        ids: [ObjectId]
    }
}
```

A partir de la migración 012:

```text
estado_actual.alertas_activas.ids[]
    → alertas._id
```

La referencia:

```text
estado_actual.semaforo_vital.estado_semaforo_id
```

continúa pendiente hasta implementar `estados_semaforo`.

---

# 9. Análisis IA

Colección histórica:

```text
analisis_ia
```

Regla:

```text
1 ejecución
=
1 documento
```

Identificación de modelo:

```javascript
modelo: {
    nombre: String,
    version: String
}
```

Resultado:

```javascript
resultado: {
    probabilidad_riesgo: Number
}
```

Regla:

```text
0 <= probabilidad_riesgo <= 1
```

La probabilidad no equivale automáticamente a:

```text
verde
amarillo
rojo
```

---

# 10. Predicciones SIR

Colección:

```text
predicciones_sir
```

Migración:

```text
011_create_predicciones_sir.js
```

Naturaleza:

```text
histórica / append-only
```

Estructura contractual:

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

Reglas estructurales:

```text
beta >= 0
gamma >= 0
horizonte_dias >= 1

susceptibles >= 0
infectados >= 0
recuperados >= 0
```

Reglas matemáticas no impuestas estructuralmente:

```text
S + I + R = N
conservación poblacional
longitud exacta de trayectoria
secuencia exacta de días
```

---

# 11. Alertas

Colección:

```text
alertas
```

Migración:

```text
012_create_alertas.js
```

## 11.1 Propósito

Persistir el histórico de alertas sanitarias y epidemiológicas generadas para un albergue.

La colección permite:

- consultar alertas actuales;
- conservar alertas cerradas;
- consultar histórico;
- controlar visibilidad pública;
- identificar el nivel de riesgo asociado al evento;
- conservar trazabilidad hacia los datos que originaron la alerta.

---

# 11.2 Estructura

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

---

# 11.3 Campos obligatorios

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

Opcionales:

```text
datos_origen.condicion_sanitaria_id
datos_origen.casos_enfermedades_ids
datos_origen.prediccion_sir_id
updated_at
updated_by
```

---

# 11.4 Nivel de riesgo

Valores permitidos:

```text
verde
amarillo
rojo
```

`nivel_riesgo` representa el nivel asociado a la alerta.

No constituye la fuente histórica oficial del estado del Semáforo Vital.

Esa responsabilidad pertenecerá a:

```text
estados_semaforo
```

---

# 11.5 Tipo de alerta

```text
tipo_alerta
```

es un `String` obligatorio y no vacío.

Actualmente:

```text
NO utiliza enum
```

porque el catálogo funcional permanece pendiente.

No deben inventarse valores cerrados desde DBA.

---

# 11.6 Mensaje

```text
mensaje
```

es un `String` obligatorio y no vacío.

Representa la descripción legible de la alerta.

---

# 11.7 Ciclo de vida

```text
activa
```

es `Boolean`.

Una alerta puede evolucionar:

```text
activa = true
        ↓
activa = false
```

El documento no debe eliminarse como operación funcional ordinaria.

Cerrar una alerta preserva su histórico.

Para actualizaciones pueden utilizarse:

```text
updated_at
updated_by
```

---

# 11.8 Visibilidad pública

```text
publica
```

es `Boolean`.

Representa un marcador funcional de exposición.

No constituye por sí mismo un mecanismo de seguridad.

Backend debe verificar permisos y contexto antes de exponer información.

---

# 11.9 Datos de origen

Objeto:

```text
datos_origen
```

es obligatorio.

Sus campos internos son opcionales porque dependen del origen de cada alerta.

Relaciones:

```text
datos_origen.condicion_sanitaria_id
    → condiciones_sanitarias._id

datos_origen.casos_enfermedades_ids[]
    → casos_enfermedades._id

datos_origen.prediccion_sir_id
    → predicciones_sir._id
```

`casos_enfermedades_ids` utiliza:

```text
uniqueItems: true
```

No se exige todavía:

```text
minItems: 1
```

---

# 11.10 Coherencia de albergue

Toda referencia de `datos_origen`, cuando exista, debe pertenecer al mismo albergue indicado por:

```text
alertas.albergue_id
```

Ejemplo válido:

```text
alertas.albergue_id = A

condicion_sanitaria.albergue_id = A
caso_enfermedad.albergue_id = A
prediccion_sir.albergue_id = A
```

Ejemplo inválido:

```text
alertas.albergue_id = A

prediccion_sir.albergue_id = B
```

MongoDB `$jsonSchema` no puede imponer esta relación.

Se controla mediante `$lookup` y debe validarse también en Backend antes de persistir.

---

# 11.11 Fuente de datos

```text
fuente_datos
```

es `String` obligatorio.

Actualmente permanece abierto.

No existe todavía un catálogo oficial.

---

# 11.12 Trazabilidad

Creación:

```text
registrado_por
created_at
```

Actualización opcional:

```text
updated_by
updated_at
```

Referencias:

```text
registrado_por
    → usuarios._id

updated_by
    → usuarios._id
```

La futura definición de un usuario técnico para eventos automáticos continúa pendiente.

DBA no debe crear unilateralmente un usuario ficticio.

---

# 11.13 Campos no incorporados

## `prioridad`

Actualmente no existe:

```text
alertas.prioridad
```

No hay un catálogo funcional aprobado.

No debe inferirse:

```text
verde = baja
amarillo = media
rojo = alta
```

El nivel de riesgo y una eventual prioridad son conceptos diferentes.

## `analisis_ia_id`

Actualmente no existe:

```text
alertas.datos_origen.analisis_ia_id
```

El contrato de origen vigente únicamente contempla:

```text
condiciones_sanitarias
casos_enfermedades
predicciones_sir
```

Si se requiere una relación directa con IA deberá incorporarse mediante una migración posterior.

---

# 11.14 Índices

Histórico por albergue:

```text
ix_alertas_albergue_fecha
```

```javascript
{
    albergue_id: 1,
    fecha_alerta: -1
}
```

Alertas activas:

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

Consulta global por riesgo:

```text
ix_alertas_nivel_activa
```

```javascript
{
    nivel_riesgo: 1,
    activa: 1
}
```

Todos son:

```text
NO UNIQUE
```

Un albergue puede generar múltiples alertas incluso en el mismo instante.

---

# 12. Migración 012

Archivo:

```text
database/mongodb/migrations/012_create_alertas.js
```

Dependencia:

```text
011_create_predicciones_sir
```

La migración verifica que `011` esté registrada exactamente una vez.

Colecciones requeridas:

```text
usuarios
albergues
condiciones_sanitarias
casos_enfermedades
predicciones_sir
schema_migrations
```

No depende de `metricas_albergue` para crear `alertas`.

La relación:

```text
metricas_albergue.estado_actual.alertas_activas.ids[]
    → alertas._id
```

es consumidora de `alertas`, no una dependencia de creación de la colección.

La migración:

- crea o actualiza `alertas`;
- configura `$jsonSchema`;
- usa validación estricta;
- crea tres índices;
- valida `albergue_id`;
- valida `registrado_por`;
- valida `updated_by` cuando existe;
- valida referencias hacia condiciones sanitarias;
- valida referencias hacia casos;
- valida referencias hacia SIR;
- verifica coherencia de albergue;
- registra la migración;
- verifica el registro único;
- verifica los índices.

---

# 13. Idempotencia

Si `alertas` existe:

```text
collMod
```

actualiza el validator.

No se ejecuta:

```text
drop
```

La migración queda aplicada cuando existe exactamente un registro:

```text
version = 012_create_alertas
```

en:

```text
schema_migrations
```

---

# 14. Inicialización reproducible

Archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

Incluye actualmente:

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

Para `alertas` reproduce:

- validator;
- `nivel_riesgo`;
- ciclo de vida;
- visibilidad pública;
- datos de origen;
- trazabilidad;
- tres índices.

El `init` no registra migraciones.

---

# 15. Pruebas DBA de alertas

Archivo:

```text
database/mongodb/tests/test_alertas.js
```

Resultado:

```text
Pruebas exitosas: 40
Pruebas fallidas: 0
```

Cobertura:

```text
1. documento válido
2. albergue_id obligatorio
3. fecha_alerta obligatoria
4. nivel_riesgo obligatorio
5. enum verde/amarillo/rojo
6. tipo_alerta no vacío
7. mensaje no vacío
8. activa Boolean
9. publica obligatoria
10. publica Boolean
11. datos_origen obligatorio
12. fuente_datos no vacía
13. registrado_por ObjectId
14. created_at obligatorio
15. additionalProperties raíz
16. additionalProperties datos_origen
17. uniqueItems casos_enfermedades_ids
18. updated_at y updated_by
19. cierre activa → inactiva
20. alerta pública
21. condicion_sanitaria_id válido
22. casos_enfermedades_ids válidos
23. prediccion_sir_id válido
24. combinación de orígenes
25. condición sanitaria huérfana
26. caso epidemiológico huérfano
27. predicción SIR huérfana
28. albergue huérfano
29. registrado_por huérfano
30. updated_by huérfano
31. condición perteneciente a otro albergue
32. caso perteneciente a otro albergue
33. SIR perteneciente a otro albergue
34. tres índices correctos
35. migración 012 registrada
36. múltiples alertas misma fecha
37. verde/amarillo/rojo
38. prioridad no forma parte del contrato
39. analisis_ia_id no forma parte del contrato
40. tipo_alerta y fuente_datos continúan abiertos
```

La suite fue repetida después de ejecutar:

```text
init_semaforo_vital.js
```

manteniendo:

```text
40/40
```

---

# 16. Integridad referencial

Referencias principales:

```text
usuarios.albergue_id
    → albergues._id

albergues.registrado_por
    → usuarios._id

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

Trazabilidad SIR:

```text
predicciones_sir.datos_entrada.historial_poblacion_ids[]
    → historial_poblacion._id

predicciones_sir.datos_entrada.casos_enfermedades_ids[]
    → casos_enfermedades._id

predicciones_sir.datos_entrada.analisis_ia_id
    → analisis_ia._id
```

Trazabilidad alertas:

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

---

# 17. Trazabilidad temporal

Colecciones operativas pueden utilizar:

```text
registrado_por
created_at
updated_at
updated_by
```

Colecciones append-only:

```text
analisis_ia
predicciones_sir
```

utilizan:

```text
registrado_por
created_at
```

`alertas` no es append-only estricta porque su ciclo de vida permite cerrar una alerta existente.

---

# 18. Índices vigentes

```text
usuarios
    ux_usuarios_email
    ix_usuarios_albergue_id

albergues
    ux_albergues_codigo_albergue

registros_diarios
    ux_registros_diarios_albergue_fecha

historial_poblacion
    ux_historial_poblacion_albergue_fecha

condiciones_sanitarias
    ix_condiciones_sanitarias_albergue_fecha

casos_enfermedades
    ix_casos_enfermedades_albergue_fecha
    ix_casos_enfermedades_albergue_enfermedad_fecha

intervenciones
    ix_intervenciones_albergue_fecha
    ix_intervenciones_albergue_tipo_fecha

metricas_albergue
    ux_metricas_albergue_albergue_fecha_bucket

analisis_ia
    ix_analisis_ia_albergue_fecha
    ix_analisis_ia_modelo_version_fecha

predicciones_sir
    ix_predicciones_sir_albergue_fecha
    ix_predicciones_sir_albergue_enfermedad_fecha
    ix_predicciones_sir_modelo_version_fecha

alertas
    ix_alertas_albergue_fecha
    ix_alertas_albergue_activa_fecha
    ix_alertas_nivel_activa

schema_migrations
    ux_schema_migrations_version
```

---

# 19. Resultados DBA

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

# 20. Relación con el Semáforo Vital

`alertas` participa como una de las entradas para determinar o modificar el estado del Semáforo Vital.

Pero:

```text
alertas.nivel_riesgo
```

no es el historial oficial del Semáforo Vital.

Arquitectura:

```text
condiciones sanitarias
        │
casos epidemiológicos
        │
analisis_ia
        │
predicciones_sir
        │
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

---

# 21. Redis

MongoDB continuará como:

```text
fuente persistente de verdad
```

`metricas_albergue.estado_actual` será:

```text
snapshot persistente
```

Redis será:

```text
caché temporal
```

Contrato previsto:

```text
key:
semaforo:estado:{albergue_id}

TTL:
900 segundos
```

Redis no reemplazará datos históricos.

---

# 22. Responsabilidad DBA

DBA garantiza:

- `$jsonSchema`;
- tipos BSON;
- índices;
- migraciones;
- reproducibilidad;
- integridad estructural;
- detección de referencias huérfanas;
- contratos de trazabilidad;
- coherencia referencial verificable;
- pruebas de persistencia;
- documentación del modelo.

Para `alertas`, DBA garantiza específicamente:

```text
nivel_riesgo válido
activa Boolean
publica Boolean
datos_origen estructuralmente válidos
referencias ObjectId
coherencia de albergue mediante controles
índices
historial preservable
```

---

# 23. Responsabilidad Backend

Backend deberá:

- generar alertas cuando se cumplan reglas funcionales;
- validar referencias antes de persistir;
- garantizar coherencia del albergue;
- administrar cierre de alertas;
- evitar eliminación funcional del histórico;
- gestionar autorización;
- controlar exposición mediante `publica`;
- determinar `tipo_alerta`;
- utilizar la fuente adecuada;
- gestionar el futuro usuario técnico;
- sincronizar snapshots posteriores.

---

# 24. Reglas que DBA no debe inventar

Hasta que exista definición funcional no deben crearse:

```text
enum de tipo_alerta
enum de fuente_datos
prioridad de alertas
usuario técnico automático
relación directa alertas → analisis_ia
```

Estos cambios requieren decisión funcional y, si afectan el esquema, una nueva migración.

---

# 25. Migraciones vigentes

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

Las migraciones aplicadas no se modifican retroactivamente.

---

# 26. Próximo contrato estructural

El siguiente checkpoint previsto es:

```text
estados_semaforo
```

Objetivo:

- conservar historial oficial de estados;
- separar alertas de estado oficial;
- registrar fecha de cálculo;
- relacionar fuentes utilizadas;
- permitir determinar estado vigente;
- formalizar la referencia existente desde `metricas_albergue`.

La referencia preparada es:

```text
metricas_albergue
    .estado_actual
    .semaforo_vital
    .estado_semaforo_id
        ↓
estados_semaforo._id
```

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

Checkpoint 8:

```text
Colección alertas                                  ✓
Migración 012                                      ✓
Validator strict                                   ✓
additionalProperties false                         ✓
nivel_riesgo                                       ✓
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
updated_by                                         ✓
3 índices                                           ✓
Init reproducible                                  ✓
Pruebas DBA                                      40/40
Documentación                                      ✓
```

Número de migración siguiente candidato:

```text
013
```

siempre que continúe disponible al iniciar el siguiente checkpoint.