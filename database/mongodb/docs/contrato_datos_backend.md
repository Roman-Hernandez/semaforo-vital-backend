# Contrato de datos MongoDB — Semáforo Vital

## 1. Objetivo

Este documento define el contrato de datos vigente entre MongoDB y las capas consumidoras del sistema **Semáforo Vital**.

Su objetivo es evitar inconsistencias durante la integración entre base de datos, backend y demás componentes, especialmente en:

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
- estados calculados;
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
created_at
updated_at
fecha_hora
fecha_calculo
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

Se permiten múltiples intervenciones para el mismo:

```text
albergue
fecha
tipo
```

cuando representan acciones independientes.

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

Por tanto, para un albergue determinado solo puede existir un bucket para cada día operativo.

Ejemplo conceptual:

```text
Albergue A
12 de noviembre de 2026
        ↓
1 documento metricas_albergue
        ↓
N mediciones intradía
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

No debe utilizarse `00:00 UTC` como equivalente automático del inicio del día colombiano.

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

Todos los campos son obligatorios.

## 14.1 Reglas

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

El array `mediciones` debe contener al menos:

```text
1 elemento
```

---

# 15. Cantidad de mediciones por bucket

Una frecuencia de medición cada 15 minutos produciría aproximadamente:

```text
96 mediciones por día
```

Sin embargo:

> 96 no constituye actualmente una regla funcional obligatoria.

Por esta razón el validator no establece:

```text
maxItems: 96
```

La base de datos permite una cantidad diferente de mediciones mientras el documento siga siendo válido.

---

# 16. Porcentaje de ocupación

`porcentaje_ocupacion` puede superar:

```text
100
```

Esto es intencional.

Ejemplo:

```text
capacidad_instalada = 100

personas_alojadas = 120

porcentaje_ocupacion = 120
```

El modelo debe poder representar:

```text
sobreocupación
hacinamiento
```

Por tanto no existe:

```text
maximum: 100
```

---

# 17. Computed Pattern

El objeto:

```text
calculados
```

contiene valores precalculados derivados del bucket.

Estructura:

```javascript
{
    cantidad_mediciones: Int32,

    suma_ph: Number,

    suma_cloro_residual: Number,

    promedio_ph: Number,

    promedio_cloro_residual: Number,

    porcentaje_ocupacion: Number
}
```

Su objetivo es evitar agregaciones repetitivas sobre el array de mediciones.

---

# 18. Reglas de consistencia del Computed Pattern

Conceptualmente debe cumplirse:

```text
calculados.cantidad_mediciones
=
mediciones.length
```

También:

```text
calculados.suma_ph
=
suma de mediciones.ph
```

```text
calculados.suma_cloro_residual
=
suma de mediciones.cloro_residual
```

```text
calculados.promedio_ph
=
suma_ph / cantidad_mediciones
```

```text
calculados.promedio_cloro_residual
=
suma_cloro_residual / cantidad_mediciones
```

MongoDB `$jsonSchema` valida:

```text
estructura
tipos BSON
obligatoriedad
rangos
```

pero no recalcula estas relaciones.

Por tanto:

> La aplicación responsable de agregar o modificar mediciones debe actualizar también los valores de `calculados`.

---

# 19. `ultima_medicion`

El objeto:

```text
ultima_medicion
```

mantiene un snapshot persistente de la última lectura disponible.

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

Su objetivo es evitar recorrer el array completo para consultar el último estado conocido.

---

# 20. `estado_actual`

`estado_actual` es un snapshot persistente del estado calculado del albergue.

Durante la migración 008 este campo es:

```text
OPCIONAL
```

porque todavía no existen las colecciones:

```text
alertas
estados_semaforo
```

La estructura se define anticipadamente para establecer el contrato del Computed Pattern.

---

## 20.1 Agua

```javascript
agua: {
    nivel: String
}
```

Representará el nivel calculado asociado al componente de agua.

---

## 20.2 Hacinamiento

```javascript
hacinamiento: {
    nivel: String
}
```

Representará el nivel calculado asociado al componente de ocupación.

---

## 20.3 Semáforo Vital

```javascript
semaforo_vital: {
    nivel: String,
    codigo: Int32,
    estado_semaforo_id: ObjectId,
    fecha_calculo: Date
}
```

La referencia:

```text
estado_actual.semaforo_vital.estado_semaforo_id
```

apuntará posteriormente a:

```text
estados_semaforo._id
```

---

## 20.4 Alertas activas

```javascript
alertas_activas: {
    cantidad: Int32,
    ids: [
        ObjectId
    ]
}
```

Los identificadores apuntarán posteriormente a:

```text
alertas._id
```

El array utiliza:

```text
uniqueItems: true
```

para evitar repetir el mismo identificador dentro del snapshot.

---

# 21. Separación de responsabilidades de datos

La arquitectura establece:

```text
registros_diarios
    → consolidado oficial diario

metricas_albergue.mediciones
    → telemetría intradía

metricas_albergue.calculados
    → datos precalculados

metricas_albergue.ultima_medicion
    → lectura más reciente

metricas_albergue.estado_actual
    → snapshot persistente calculado

estados_semaforo
    → estado oficial e histórico

alertas
    → alertas oficiales e históricas

Redis
    → caché temporal
```

Las tres capas futuras:

```text
estado oficial histórico
snapshot persistente
cache temporal
```

no son equivalentes.

---

# 22. Índice del Bucket Pattern

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

Garantiza:

> Un solo bucket por albergue y día operativo.

La migración 008 verifica primero que no existan duplicados antes de intentar crear el índice.

---

# 23. Referencias lógicas de `metricas_albergue`

Actualmente:

```text
metricas_albergue.albergue_id
    → albergues._id
```

La migración verifica referencias huérfanas mediante:

```text
$lookup
```

Las referencias futuras serán:

```text
metricas_albergue.estado_actual
    .semaforo_vital
    .estado_semaforo_id
        → estados_semaforo._id
```

y:

```text
metricas_albergue.estado_actual
    .alertas_activas
    .ids[]
        → alertas._id
```

No se crean colecciones ficticias para validar anticipadamente estas referencias.

La validación referencial correspondiente se incorporará cuando existan las colecciones reales.

---

# 24. Integridad referencial general

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
```

MongoDB `$jsonSchema` valida tipos BSON, pero no implementa claves foráneas tradicionales.

La aplicación debe garantizar la existencia de las referencias antes de persistir información.

---

# 25. Trazabilidad

Las colecciones operativas tradicionales utilizan:

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

para la trazabilidad técnica del bucket.

`created_at` representa la creación original.

`updated_at` debe actualizarse cuando:

```text
se agrega una medición
se recalculan valores
se actualiza ultima_medicion
se actualiza estado_actual
```

---

# 26. Migraciones

Migraciones vigentes:

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

Las migraciones aplicadas no deben editarse retroactivamente.

---

# 27. Migración 008

Archivo:

```text
database/mongodb/migrations/008_create_metricas_albergue.js
```

La migración:

- verifica colecciones requeridas;
- verifica la migración 007;
- crea o actualiza `metricas_albergue`;
- aplica `$jsonSchema`;
- establece validación `strict`;
- establece `validationAction: error`;
- implementa la estructura Bucket Pattern;
- implementa la estructura Computed Pattern;
- verifica duplicados existentes;
- crea el índice único del bucket;
- verifica referencias hacia `albergues`;
- registra la migración en `schema_migrations`;
- verifica el registro único;
- verifica la definición del índice.

Dependencia:

```text
007_create_intervenciones
```

---

# 28. Inicialización reproducible

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

La ejecución repetida debe conservar:

- validadores;
- índices;
- unicidad;
- Bucket Pattern;
- Computed Pattern.

---

# 29. Pruebas DBA de `metricas_albergue`

Archivo:

```text
database/mongodb/tests/test_metricas_albergue.js
```

Resultado validado:

```text
Pruebas exitosas: 18
Pruebas fallidas: 0
```

La suite verifica:

1. documento bucket válido;
2. `albergue_id` obligatorio;
3. `fecha_bucket` obligatoria;
4. `mediciones` obligatorio;
5. `mediciones` no vacío;
6. rechazo de pH negativo;
7. rechazo de cloro residual negativo;
8. `personas_alojadas` como Int32;
9. ocupación superior a 100 permitida;
10. `cantidad_mediciones >= 1`;
11. `ultima_medicion` obligatoria;
12. rechazo de propiedades adicionales;
13. unicidad de `albergue_id + fecha_bucket`;
14. índice único del Bucket Pattern;
15. `estado_actual` opcional;
16. estructura válida de `estado_actual`;
17. detección de referencia huérfana mediante `$lookup`;
18. consistencia Bucket + Computed del documento de prueba.

---

# 30. Prueba de consistencia Bucket + Computed

La prueba 18 verifica específicamente:

```text
cantidad_mediciones
=
mediciones.length
```

También verifica:

```text
suma_ph
suma_cloro_residual
promedio_ph
promedio_cloro_residual
ultima_medicion
```

contra las mediciones del documento de prueba.

Esta prueba no significa que MongoDB mantenga automáticamente esas relaciones.

Significa que:

> El contrato exige que el productor del documento preserve la consistencia.

---

# 31. Validación posterior al `init`

Después de actualizar:

```text
database/mongodb/init/init_semaforo_vital.js
```

se volvió a ejecutar:

```text
database/mongodb/tests/test_metricas_albergue.js
```

Resultado:

```text
Pruebas exitosas: 18
Pruebas fallidas: 0
```

Esto confirma que la inicialización reproducible conserva correctamente:

```text
Bucket Pattern
Computed Pattern
índice único
validator
estado_actual opcional
```

---

# 32. Resultados de pruebas actuales

```text
test_validaciones.js                8/8

test_integridad_qa.js              12/12

test_condiciones_sanitarias.js     14/14

test_casos_enfermedades.js         14/14

test_intervenciones.js             15/15

test_metricas_albergue.js          18/18
```

---

# 33. Índices vigentes

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

# 34. Responsabilidad DBA

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
- contrato del Bucket Pattern;
- contrato del Computed Pattern;
- pruebas de integridad.

---

# 35. Responsabilidad Backend

La capa Backend deberá garantizar posteriormente:

- validar la existencia de referencias;
- normalizar `fecha_bucket`;
- insertar mediciones dentro del bucket correcto;
- evitar duplicidad lógica de mediciones cuando la regla sea definida;
- actualizar `cantidad_mediciones`;
- actualizar sumas;
- actualizar promedios;
- actualizar `ultima_medicion`;
- actualizar `updated_at`;
- calcular `porcentaje_ocupacion`;
- mantener consistencia del Computed Pattern;
- actualizar `estado_actual` cuando corresponda;
- manejar errores de índice único;
- mantener semántica de cada colección.

La definición DBA no implica implementación de lógica Backend.

---

# 36. Relación futura con `estados_semaforo`

La colección futura:

```text
estados_semaforo
```

será la fuente persistente oficial e histórica del estado del semáforo.

La relación prevista será:

```text
estados_semaforo
        ↓
estado oficial/histórico

metricas_albergue.estado_actual
        ↓
snapshot persistente de consulta rápida
```

`estado_actual` no sustituye el historial oficial.

---

# 37. Relación futura con `alertas`

La colección futura:

```text
alertas
```

almacenará las alertas oficiales.

`metricas_albergue.estado_actual.alertas_activas` mantendrá únicamente un snapshot con:

```text
cantidad
ids
```

para consulta rápida.

No sustituirá la colección histórica de alertas.

---

# 38. Relación futura con Redis

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
estados_semaforo
alertas
```

Si Redis no se encuentra disponible, el sistema deberá poder recuperar el estado persistente desde MongoDB.

La integración Redis será implementada en un checkpoint posterior.

---

# 39. Seguridad

`metricas_albergue` contiene datos agregados y operativos del albergue.

No debe almacenar:

```text
nombres de pacientes
documentos de identidad
historias clínicas
credenciales
contraseñas
tokens
secretos
```

La información epidemiológica continuará manejándose de forma agregada.

---

# 40. Evolución del modelo

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

No deben modificarse retroactivamente migraciones aplicadas.

No deben agregarse restricciones funcionales que todavía no hayan sido aprobadas.

---

# 41. Estado actual del contrato

Colecciones implementadas:

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

El Checkpoint de `metricas_albergue` deja formalmente implementados:

```text
Colección metricas_albergue                       ✓
Bucket Pattern                                    ✓
Computed Pattern                                  ✓
Mediciones intradía                               ✓
Valores calculados                                ✓
Última medición                                   ✓
Estado actual preparado                           ✓
Sobreocupación > 100 permitida                    ✓
Índice único por albergue + fecha_bucket          ✓
Referencia lógica hacia albergues                 ✓
Migración 008                                     ✓
Init reproducible                                 ✓
Pruebas DBA                                       18/18
Documentación                                     ✓
```