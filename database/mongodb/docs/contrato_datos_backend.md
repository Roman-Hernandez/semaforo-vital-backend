# Contrato de datos MongoDB — Semáforo Vital

## 1. Objetivo

Este documento define el contrato de datos vigente entre MongoDB y las capas consumidoras del sistema **Semáforo Vital**.

Su objetivo es evitar inconsistencias durante la integración entre base de datos, Backend, modelos analíticos y demás componentes, especialmente en:

- usuarios y roles;
- referencias entre colecciones;
- fechas operativas;
- trazabilidad;
- registros diarios;
- condiciones sanitarias;
- casos de enfermedades;
- intervenciones reales;
- telemetría intradía;
- Bucket Pattern;
- Computed Pattern;
- análisis de inteligencia artificial;
- versionado de modelos;
- trazabilidad de datos utilizados por IA;
- preprocesamiento;
- resultados analíticos;
- evolución futura de los esquemas.

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
condiciones_sanitarias
casos_enfermedades
intervenciones
metricas_albergue
analisis_ia
schema_migrations
```

`schema_migrations` es una colección técnica para controlar la evolución estructural.

## 2.1 Equivalencias conceptuales

| Concepto | Implementación vigente |
|---|---|
| `users` | `usuarios` |
| `SUPER_ADMIN` | `super_administrador` |
| `SHELTER_ADMIN` | `administrador_albergue` |
| `shelterId` | `albergue_id` |
| estado usuario | `active` |
| correo normalizado | `email` |

Los nombres implementados forman parte del contrato y no deben modificarse unilateralmente.

---

# 3. Colección `usuarios`

## 3.1 Propósito

Almacena los usuarios autorizados para utilizar el sistema.

Las contraseñas nunca deben almacenarse en texto plano.

MongoDB almacena:

```text
password_hash
```

utilizando formato:

```text
Argon2id
```

## 3.2 Roles

```text
super_administrador
administrador_albergue
```

Para:

```text
super_administrador
```

`albergue_id` debe ser:

```text
null
```

Para:

```text
administrador_albergue
```

`albergue_id` es obligatorio y debe ser `ObjectId`.

## 3.3 Índices

```text
ux_usuarios_email
ix_usuarios_albergue_id
```

`ux_usuarios_email` es único.

---

# 4. Colección `albergues`

## 4.1 Propósito

Representa los albergues administrados por el sistema.

Estructura general:

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

Las coordenadas GeoJSON utilizan:

```text
[longitud, latitud]
```

Índice:

```text
ux_albergues_codigo_albergue
```

Único.

---

# 5. Colección `registros_diarios`

## 5.1 Propósito

Almacena el consolidado oficial de un albergue para un día determinado.

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

## 5.2 Regla de unicidad

Solo puede existir:

> Un registro consolidado por albergue y día.

Índice:

```text
ux_registros_diarios_albergue_fecha
```

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

## 5.3 Casos EDA e IRA

```text
casos_eda
casos_ira
```

representan:

> Casos nuevos reportados durante el día.

No representan:

```text
casos activos
casos acumulados
```

---

# 6. Regla de fechas

Zona horaria funcional:

```text
America/Bogota
```

Por ejemplo:

```text
2026-11-12 00:00 America/Bogota
```

equivale en MongoDB a:

```text
2026-11-12T05:00:00.000Z
```

MongoDB almacena `Date` como un instante UTC.

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

representan instantes temporales específicos.

---

# 7. Colección `condiciones_sanitarias`

## 7.1 Propósito

Almacena condiciones sanitarias observadas en un albergue.

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

permanecen pendientes de definición funcional.

---

# 8. Colección `casos_enfermedades`

## 8.1 Propósito

Almacena la cantidad de casos activos de una enfermedad en un albergue y fecha determinados.

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

## 8.2 Semántica

```text
cantidad_casos_activos
```

representa:

> Personas que presentan activamente la enfermedad en la fecha registrada.

No representa:

```text
casos nuevos del día
casos acumulados históricos
```

## 8.3 Índices

```text
ix_casos_enfermedades_albergue_fecha
ix_casos_enfermedades_albergue_enfermedad_fecha
```

No únicos.

---

# 9. Colección `intervenciones`

## 9.1 Propósito

Almacena acciones reales ejecutadas sobre un albergue.

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

## 9.2 Regla funcional

`intervenciones` contiene:

> Acciones que efectivamente ocurrieron.

No contiene:

```text
simulaciones
acciones hipotéticas
intervenciones propuestas
```

Las acciones simuladas se incorporarán posteriormente dentro de:

```text
escenarios.intervenciones_simuladas
```

## 9.3 Índices

```text
ix_intervenciones_albergue_fecha
ix_intervenciones_albergue_tipo_fecha
```

No únicos.

Se permiten múltiples intervenciones para el mismo albergue, fecha y tipo cuando representan acciones independientes.

---

# 10. Colección `metricas_albergue`

## 10.1 Propósito

`metricas_albergue` almacena telemetría intradía de los albergues mediante una combinación de:

```text
Bucket Pattern
Computed Pattern
```

La colección permite agrupar múltiples mediciones dentro de un mismo documento y mantener valores precalculados para consultas frecuentes.

Fue incorporada mediante:

```text
008_create_metricas_albergue.js
```

---

# 11. Bucket Pattern

## 11.1 Regla

La unidad documental es:

```text
1 documento
=
1 albergue
+
1 fecha_bucket
```

Las diferentes lecturas del día se almacenan en:

```text
mediciones
```

y no como documentos independientes.

---

# 12. Estructura de `metricas_albergue`

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

# 13. Campo `fecha_bucket`

`fecha_bucket` identifica el día operativo representado por el documento.

La aplicación debe normalizarlo con:

```text
America/Bogota
```

Por ejemplo:

```text
2099-09-01 00:00 America/Bogota
```

se almacena como:

```text
2099-09-01T05:00:00.000Z
```

---

# 14. Array `mediciones`

Cada elemento representa una lectura intradía.

Estructura:

```javascript
{
    fecha_hora: Date,
    ph: Number,
    cloro_residual: Number,
    personas_alojadas: Int32,
    porcentaje_ocupacion: Number
}
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

El array debe contener al menos un elemento.

Una frecuencia de 15 minutos puede producir aproximadamente:

```text
96 mediciones por día
```

pero actualmente no existe:

```text
maxItems: 96
```

porque esa cantidad no corresponde a una restricción funcional aprobada.

---

# 15. Porcentaje de ocupación

`porcentaje_ocupacion` puede superar:

```text
100
```

Esto permite representar situaciones de:

```text
sobreocupación
hacinamiento
```

No existe:

```text
maximum: 100
```

---

# 16. Computed Pattern

El objeto:

```text
calculados
```

contiene:

```text
cantidad_mediciones
suma_ph
suma_cloro_residual
promedio_ph
promedio_cloro_residual
porcentaje_ocupacion
```

Conceptualmente debe cumplirse:

```text
cantidad_mediciones = mediciones.length
```

y las sumas y promedios deben corresponder a las mediciones almacenadas.

MongoDB `$jsonSchema` valida tipos y estructura, pero no recalcula automáticamente estas relaciones.

La aplicación que modifique el bucket debe mantener su consistencia.

---

# 17. `ultima_medicion`

`ultima_medicion` mantiene un snapshot de la lectura más reciente.

Estructura:

```javascript
{
    fecha_hora: Date,
    ph: Number,
    cloro_residual: Number,
    personas_alojadas: Int32,
    porcentaje_ocupacion: Number
}
```

Conceptualmente:

```text
ultima_medicion
=
medición con fecha_hora más reciente
```

---

# 18. `estado_actual`

`estado_actual` es un snapshot persistente del estado calculado del albergue.

Durante esta etapa es:

```text
OPCIONAL
```

porque todavía no existen:

```text
alertas
estados_semaforo
```

La estructura queda preparada para su integración posterior.

---

# 19. Índice de `metricas_albergue`

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

Configuración:

```text
unique: true
```

Garantiza un solo bucket por albergue y día operativo.

---

# 20. Colección `analisis_ia`

## 20.1 Propósito

`analisis_ia` almacena resultados históricos de ejecuciones de modelos de inteligencia artificial.

Fue incorporada mediante:

```text
009_create_analisis_ia.js
```

La colección conserva:

- albergue analizado;
- fecha de ejecución;
- periodo de datos analizado;
- nombre y versión del modelo;
- documentos utilizados como entrada;
- información de preprocesamiento;
- probabilidad de riesgo;
- usuario asociado a la ejecución;
- fecha técnica de persistencia.

---

# 21. Naturaleza histórica de `analisis_ia`

La regla principal es:

```text
1 ejecución IA
=
1 documento nuevo
```

Por ejemplo:

```text
Ejecución #1
    ↓
Documento A

Ejecución #2
    ↓
Documento B

Ejecución #3
    ↓
Documento C
```

Una nueva ejecución no debe sobrescribir los resultados anteriores.

Por esta razón `analisis_ia` no utiliza:

```text
updated_at
updated_by
```

como parte del contrato actual.

La inmutabilidad es una regla del contrato de acceso.

El `$jsonSchema` no impide por sí solo todos los posibles `update` sobre documentos existentes.

---

# 22. Estructura de `analisis_ia`

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

# 23. `albergue_id`

`albergue_id` es obligatorio.

Referencia:

```text
analisis_ia.albergue_id
    → albergues._id
```

La migración 009 verifica referencias huérfanas mediante:

```text
$lookup
```

---

# 24. `escenario_id`

`escenario_id` es opcional.

Si existe debe ser:

```text
ObjectId
```

La referencia futura será:

```text
analisis_ia.escenario_id
    → escenarios._id
```

Actualmente no se ejecuta control referencial contra `escenarios` porque dicha colección todavía no existe.

No se crean colecciones ficticias para resolver esta dependencia.

---

# 25. `fecha_ejecucion`

`fecha_ejecucion` representa el instante en el que se ejecutó el modelo.

No debe confundirse con:

```text
created_at
```

`fecha_ejecucion` tiene significado analítico.

`created_at` representa el momento técnico de persistencia del resultado.

---

# 26. `periodo_analizado`

Estructura:

```javascript
periodo_analizado: {
    fecha_inicio: Date,
    fecha_fin: Date
}
```

Regla semántica:

```text
fecha_inicio <= fecha_fin
```

`$jsonSchema` verifica que ambos valores sean `Date`.

La comparación entre ambos campos se realiza mediante un control DBA adicional con:

```text
$expr
```

La migración 009 verifica que no existan documentos persistidos con:

```text
fecha_inicio > fecha_fin
```

---

# 27. Identificación del modelo

Cada análisis registra:

```javascript
modelo: {
    nombre: String,
    version: String
}
```

Ambos campos son obligatorios y no pueden estar vacíos.

Ejemplo:

```javascript
modelo: {
    nombre: "riesgo_sanitario",
    version: "1.0.0"
}
```

El versionado permite identificar exactamente qué modelo produjo cada resultado.

Esto es necesario para:

```text
trazabilidad
reproducibilidad
auditoría
comparación entre versiones
```

---

# 28. `datos_entrada`

El objeto:

```text
datos_entrada
```

registra los documentos utilizados por el modelo.

Estructura:

```javascript
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
}
```

Todos los arrays forman parte del contrato.

Pueden estar vacíos.

No se establece actualmente una cantidad mínima obligatoria de registros de entrada porque esa regla depende de la lógica funcional y del modelo analítico utilizado.

---

# 29. Referencias de datos de entrada

Las relaciones son:

```text
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

Los arrays utilizan:

```text
uniqueItems: true
```

para evitar que el mismo identificador se repita dentro de una ejecución.

La migración 009 verifica referencias huérfanas mediante:

```text
$unwind
+
$lookup
```

---

# 30. Alcance de la validación referencial

La validación DBA actual comprueba:

> Que cada ObjectId referenciado exista en la colección correspondiente.

No se impone todavía que:

```text
todos los documentos pertenezcan al mismo albergue
todos estén exactamente dentro del periodo analizado
exista una cantidad mínima de registros
todos los tipos de entrada tengan al menos un documento
```

Estas reglas no se convertirán en restricciones hasta contar con definición funcional o analítica aprobada.

---

# 31. `preprocesamiento`

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

Esto permite documentar cómo fueron tratados los datos antes de ser entregados al modelo.

---

# 32. Datos faltantes

Cada elemento de:

```text
datos_faltantes
```

contiene:

```javascript
{
    campo: String,
    cantidad: Int32,
    tratamiento: String
}
```

Ejemplo:

```javascript
{
    campo: "cloro_residual",
    cantidad: NumberInt(3),
    tratamiento: "imputacion_media"
}
```

Actualmente `tratamiento` permanece como:

```text
String
```

sin `enum`.

No existe todavía un catálogo funcional cerrado de estrategias de tratamiento de datos faltantes.

---

# 33. Resultado del análisis IA

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

Los valores:

```text
0
1
```

son válidos.

Valores inferiores a 0 o superiores a 1 son rechazados por el validator.

---

# 34. IA no equivale al Semáforo Vital

`resultado.probabilidad_riesgo` representa:

> Una salida analítica producida por el modelo.

No representa directamente:

```text
verde
amarillo
rojo
```

La arquitectura mantiene la separación:

```text
analisis_ia
    → resultado analítico

alertas
    → alertas oficiales

estados_semaforo
    → estado oficial/histórico del Semáforo Vital
```

Por tanto:

```text
probabilidad IA
≠
estado oficial
```

---

# 35. Índices de `analisis_ia`

## 35.1 Historial por albergue

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

Permite consultar el historial más reciente de análisis por albergue.

## 35.2 Modelo y versión

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

Permite consultar ejecuciones realizadas con una versión concreta del modelo.

---

# 36. Ausencia deliberada de índices únicos en IA

No existe restricción `UNIQUE` sobre:

```text
albergue_id + fecha_ejecucion
```

ni sobre:

```text
modelo.nombre
modelo.version
fecha_ejecucion
```

Esto es intencional.

Dos ejecuciones independientes pueden utilizar:

```text
mismo albergue
mismo modelo
misma versión
misma marca temporal
```

y seguir siendo resultados históricos independientes.

---

# 37. Migración 009

Archivo:

```text
database/mongodb/migrations/009_create_analisis_ia.js
```

Dependencia:

```text
008_create_metricas_albergue
```

La migración:

- verifica las colecciones requeridas;
- verifica que la migración 008 esté aplicada exactamente una vez;
- crea o actualiza `analisis_ia`;
- aplica `$jsonSchema`;
- configura validación `strict`;
- configura `validationAction: error`;
- verifica coherencia temporal existente;
- crea los índices de consulta;
- verifica `albergue_id`;
- verifica `registrado_por`;
- verifica referencias de datos de entrada;
- deja preparado `escenario_id`;
- registra la migración;
- verifica el registro único;
- verifica la definición de los índices.

---

# 38. Idempotencia de la migración 009

La migración está preparada para poder reejecutarse si falla antes de quedar registrada.

Si `analisis_ia` ya existe, utiliza:

```text
collMod
```

para aplicar nuevamente el validator.

No requiere eliminar la colección ni realizar `drop`.

La migración solo queda considerada aplicada cuando existe exactamente un documento en:

```text
schema_migrations
```

con:

```text
version = 009_create_analisis_ia
```

---

# 39. Inicialización reproducible

El archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

representa el estado estructural vigente.

Actualmente administra:

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

Para colecciones inexistentes utiliza:

```text
createCollection
```

Para colecciones existentes utiliza:

```text
collMod
```

También reproduce los índices de `analisis_ia`.

---

# 40. Pruebas DBA de `analisis_ia`

Archivo:

```text
database/mongodb/tests/test_analisis_ia.js
```

Resultado validado:

```text
Pruebas exitosas: 20
Pruebas fallidas: 0
```

La suite verifica:

1. documento válido;
2. `albergue_id` obligatorio;
3. `fecha_ejecucion` obligatoria;
4. `periodo_analizado` obligatorio;
5. `modelo.nombre` no vacío;
6. probabilidad menor que 0 rechazada;
7. probabilidad mayor que 1 rechazada;
8. `registrado_por` como ObjectId;
9. `registros_descartados` no negativo;
10. ObjectId duplicados rechazados en arrays de entrada;
11. propiedades adicionales rechazadas;
12. `updated_at` rechazado;
13. `escenario_id` opcional;
14. `escenario_id` debe ser ObjectId;
15. múltiples ejecuciones históricas permitidas;
16. índices correctos y no únicos;
17. detección de `albergue_id` huérfano;
18. detección de `registrado_por` huérfano;
19. detección de referencia huérfana en datos de entrada;
20. detección de periodo temporal inválido.

---

# 41. Validación posterior al `init`

Después de incorporar `analisis_ia` al archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

se ejecutó nuevamente:

```text
database/mongodb/tests/test_analisis_ia.js
```

Resultado:

```text
Pruebas exitosas: 20
Pruebas fallidas: 0
```

Esto confirma que el estado reproducible conserva correctamente:

```text
validator de analisis_ia
índices
campos obligatorios
rango de probabilidad
arrays de referencias
naturaleza histórica
escenario_id opcional
```

---

# 42. Integridad referencial general

Las referencias lógicas vigentes incluyen:

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

MongoDB `$jsonSchema` valida tipos BSON, pero no implementa claves foráneas tradicionales.

Los controles DBA complementan esta limitación mediante `$lookup`.

---

# 43. Referencias futuras

Actualmente existen referencias preparadas hacia colecciones todavía no implementadas.

## `metricas_albergue`

```text
estado_actual.semaforo_vital.estado_semaforo_id
    → estados_semaforo._id
```

```text
estado_actual.alertas_activas.ids[]
    → alertas._id
```

## `analisis_ia`

```text
escenario_id
    → escenarios._id
```

Estas referencias se endurecerán cuando existan las colecciones destino.

---

# 44. Trazabilidad

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

porque representa un bucket actualizado durante el día.

`analisis_ia` utiliza:

```text
registrado_por
created_at
```

y no:

```text
updated_at
updated_by
```

porque cada ejecución representa un resultado histórico independiente.

---

# 45. Resultados de pruebas actuales

```text
test_validaciones.js                8/8

test_integridad_qa.js              12/12

test_condiciones_sanitarias.js     14/14

test_casos_enfermedades.js         14/14

test_intervenciones.js             15/15

test_metricas_albergue.js          18/18

test_analisis_ia.js                20/20
```

---

# 46. Índices vigentes

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

# 47. Responsabilidad DBA

La capa DBA garantiza:

- estructura documental;
- tipos BSON;
- campos obligatorios;
- validadores;
- índices;
- unicidad;
- migraciones;
- estado reproducible;
- referencias estructurales;
- controles de documentos huérfanos;
- contrato Bucket Pattern;
- contrato Computed Pattern;
- contrato histórico de `analisis_ia`;
- versionado estructural del modelo IA;
- trazabilidad documental de entradas;
- rango estructural de probabilidad;
- pruebas de integridad.

---

# 48. Responsabilidad Backend

La capa Backend deberá garantizar posteriormente:

- validar referencias antes de persistir;
- normalizar fechas funcionales;
- insertar mediciones en el bucket correcto;
- mantener Computed Pattern;
- mantener `ultima_medicion`;
- mantener `updated_at` de buckets;
- construir correctamente los arrays de entrada de IA;
- garantizar que los documentos de entrada correspondan al análisis ejecutado;
- asegurar coherencia entre `albergue_id`, periodo analizado y datos utilizados;
- crear un nuevo documento para cada ejecución IA;
- no sobrescribir resultados históricos;
- registrar correctamente el modelo y versión utilizados;
- persistir el preprocesamiento aplicado;
- manejar errores de validación MongoDB.

La definición DBA no implica implementación de la lógica Backend ni del modelo IA.

---

# 49. Responsabilidad del componente IA

El componente responsable del análisis deberá definir y producir correctamente:

```text
modelo.nombre
modelo.version
fecha_ejecucion
periodo_analizado
datos_entrada
preprocesamiento
resultado.probabilidad_riesgo
```

El componente IA no debe asumir que MongoDB calcula:

```text
probabilidad
preprocesamiento
clasificación
color del semáforo
```

MongoDB persiste y valida el contrato.

---

# 50. Relación futura con `predicciones_sir`

La colección futura:

```text
predicciones_sir
```

almacenará resultados de simulación epidemiológica mediante modelos SIR.

Podrá utilizar referencias hacia:

```text
analisis_ia
casos_enfermedades
registros_diarios
escenarios
```

según el contrato que se defina en su checkpoint.

`analisis_ia` y `predicciones_sir` serán resultados analíticos diferentes y no deben mezclarse en una misma colección.

---

# 51. Relación futura con `alertas`

La colección futura:

```text
alertas
```

almacenará alertas oficiales generadas a partir de reglas o resultados del sistema.

Una alerta podrá utilizar como origen:

```text
analisis_ia
predicciones_sir
metricas_albergue
registros operativos
```

cuando se defina su contrato.

La probabilidad IA no constituye por sí sola una alerta persistida.

---

# 52. Relación futura con `estados_semaforo`

La colección futura:

```text
estados_semaforo
```

será la fuente oficial e histórica de estados del Semáforo Vital.

La arquitectura prevista será:

```text
analisis_ia
        ↓
resultado analítico

predicciones_sir
        ↓
resultado epidemiológico

alertas
        ↓
alertas oficiales

estados_semaforo
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

# 53. Relación futura con Redis

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
metricas_albergue
analisis_ia
alertas
estados_semaforo
```

La integración Redis será implementada en un checkpoint posterior.

---

# 54. Seguridad

Las colecciones analíticas trabajan con datos agregados y referencias documentales.

No deben almacenar:

```text
nombres de pacientes
documentos de identidad
historias clínicas
credenciales
contraseñas
tokens
secretos
```

`analisis_ia` no debe utilizarse como repositorio de datos clínicos individualizados.

---

# 55. Migraciones vigentes

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

Las migraciones aplicadas no deben modificarse retroactivamente.

---

# 56. Evolución del modelo

Todo nuevo cambio estructural debe seguir:

```text
análisis
    ↓
migración nueva
    ↓
pruebas
    ↓
actualización del init
    ↓
documentación
    ↓
commit
    ↓
Pull Request
```

No deben agregarse restricciones funcionales que todavía no hayan sido aprobadas.

---

# 57. Estado actual del contrato

Colecciones implementadas:

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

El Checkpoint de `analisis_ia` deja formalmente implementados:

```text
Colección analisis_ia                          ✓
Migración 009                                  ✓
Histórico por ejecución                        ✓
Modelo y versión                               ✓
Periodo analizado                              ✓
Trazabilidad de entradas                       ✓
Preprocesamiento                               ✓
Probabilidad entre 0 y 1                       ✓
escenario_id preparado                         ✓
Control de referencias hacia albergues         ✓
Control de referencias hacia usuarios          ✓
Control de referencias de entrada              ✓
Índices históricos no únicos                   ✓
Init reproducible                              ✓
Pruebas DBA                                    20/20
Documentación                                  ✓
```