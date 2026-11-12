# Contrato de datos MongoDB — Semáforo Vital

## 1. Objetivo

Este documento define el contrato de datos vigente entre MongoDB y las capas consumidoras del sistema Semáforo Vital.

Su objetivo es evitar inconsistencias durante la integración del backend, especialmente en:

- usuarios y roles;
- referencias entre colecciones;
- fechas operativas;
- trazabilidad;
- registros diarios;
- condiciones sanitarias;
- casos de enfermedades;
- intervenciones reales;
- casos EDA e IRA;
- evolución futura de los esquemas.

La base de datos utilizada es:

```text
semaforo_vital
```

---

# 2. Colecciones principales

Actualmente el modelo operativo utiliza las siguientes colecciones:

```text
usuarios
albergues
registros_diarios
condiciones_sanitarias
casos_enfermedades
intervenciones
schema_migrations
```

La colección:

```text
schema_migrations
```

es técnica y permite controlar la evolución versionada de la estructura de MongoDB.

La colección conceptual solicitada inicialmente como `users` fue implementada por backend como:

```text
usuarios
```

Por compatibilidad con el login existente, el contrato vigente mantiene los nombres ya implementados.

## 2.1 Equivalencias conceptuales

| Concepto solicitado | Implementación vigente |
|---|---|
| `users` | `usuarios` |
| `SUPER_ADMIN` | `super_administrador` |
| `SHELTER_ADMIN` | `administrador_albergue` |
| `shelterId` | `albergue_id` |
| estado | `active` |
| correo normalizado | `email` |

Estos nombres no deben modificarse unilateralmente desde la capa de base de datos, ya que forman parte del contrato utilizado actualmente por autenticación y persistencia.

---

# 3. Colección `usuarios`

## 3.1 Propósito

La colección `usuarios` almacena los usuarios autorizados para acceder al sistema.

La contraseña nunca debe almacenarse en texto plano.

MongoDB almacena exclusivamente:

```text
password_hash
```

El mecanismo actual de autenticación utiliza hashes:

```text
Argon2id
```

---

## 3.2 Documento válido — superadministrador

```javascript
{
    _id: ObjectId("..."),

    email: "admin@semaforovital.com",

    password_hash: "$argon2id$...",

    role: "super_administrador",

    active: true,

    nombre: "Super",

    apellido: "Admin",

    albergue_id: null,

    created_at: ISODate("..."),

    updated_at: ISODate("..."),

    last_login_at: null
}
```

### Reglas

`email`

Debe almacenarse normalizado en minúsculas y sin espacios.

`password_hash`

Debe contener un hash Argon2id.

`role`

Valores permitidos:

```text
super_administrador
administrador_albergue
```

`active`

Indica si el usuario se encuentra habilitado.

`albergue_id`

Para:

```text
super_administrador
```

debe ser:

```text
null
```

---

## 3.3 Documento válido — administrador de albergue

```javascript
{
    _id: ObjectId("..."),

    email: "admin.albergue@semaforovital.com",

    password_hash: "$argon2id$...",

    role: "administrador_albergue",

    active: true,

    nombre: "Administrador",

    apellido: "Albergue",

    albergue_id: ObjectId("..."),

    created_at: ISODate("..."),

    updated_at: ISODate("..."),

    last_login_at: null
}
```

Para:

```text
role = administrador_albergue
```

el campo:

```text
albergue_id
```

es obligatorio y debe ser:

```text
ObjectId
```

Además, debe corresponder a un documento existente en:

```text
albergues
```

MongoDB `$jsonSchema` puede validar el tipo BSON, pero no aplica claves foráneas tradicionales.

---

# 4. Colección `albergues`

## 4.1 Propósito

Almacena los albergues administrados por el sistema.

Ejemplo:

```javascript
{
    _id: ObjectId("..."),

    codigo_albergue: "SIM-PER-001",

    nombre: "Albergue Simulado La Esperanza",

    ubicacion: {
        departamento: "Risaralda",
        municipio: "Pereira",
        direccion: "Ubicación simulada",

        coordenadas: {
            type: "Point",
            coordinates: [
                -75.6946,
                4.8143
            ]
        }
    },

    capacidad_instalada: NumberInt(250),

    activo: true,

    registrado_por: ObjectId("..."),

    fecha: ISODate("..."),

    created_at: ISODate("..."),

    updated_at: ISODate("..."),

    updated_by: ObjectId("...")
}
```

---

## 4.2 Código funcional

`codigo_albergue` identifica funcionalmente el albergue.

Existe el índice único:

```text
ux_albergues_codigo_albergue
```

No pueden existir dos albergues con el mismo código.

---

## 4.3 Coordenadas

La ubicación utiliza GeoJSON:

```javascript
{
    type: "Point",
    coordinates: [
        longitud,
        latitud
    ]
}
```

El orden es:

```text
[longitud, latitud]
```

---

## 4.4 Trazabilidad

`registrado_por`

Debe corresponder a:

```text
usuarios._id
```

`updated_by`

Cuando exista, también debe corresponder a:

```text
usuarios._id
```

---

# 5. Colección `registros_diarios`

## 5.1 Propósito

`registros_diarios` almacena el consolidado operativo de un albergue para un día específico.

Existe un índice único compuesto:

```text
ux_registros_diarios_albergue_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

La regla funcional es:

> Solo puede existir un registro consolidado por albergue y día.

Las correcciones del mismo día deben actualizar el documento existente.

---

## 5.2 Documento válido

```javascript
{
    _id: ObjectId("..."),

    albergue_id: ObjectId("..."),

    fecha: ISODate("..."),

    poblacion: NumberInt(200),

    litros_agua: 800.0,

    letrinas: NumberInt(4),

    casos_eda: NumberInt(8),

    casos_ira: NumberInt(3),

    registrado_por: ObjectId("..."),

    created_at: ISODate("..."),

    updated_at: ISODate("..."),

    updated_by: ObjectId("...")
}
```

---

## 5.3 Restricciones

```text
poblacion   >= 0
litros_agua >= 0
letrinas    >= 0
casos_eda   >= 0
casos_ira   >= 0
```

---

# 6. Regla de fecha operativa

La zona horaria funcional del proyecto es:

```text
America/Bogota
```

Una fecha funcional:

```text
2026-10-14
```

representa:

```text
2026-10-14 00:00:00 America/Bogota
```

MongoDB almacena el instante UTC equivalente:

```text
2026-10-14T05:00:00.000Z
```

Por tanto:

```text
2026-10-14 00:00 Colombia
=
2026-10-14 05:00 UTC
```

La aplicación no debe normalizar días operativos utilizando:

```text
00:00 UTC
```

Para datos diarios se recomienda recibir:

```text
YYYY-MM-DD
```

y normalizar utilizando:

```text
America/Bogota
```

Campos como:

```text
fecha
fecha_intervencion
```

representan fechas funcionales.

En cambio:

```text
created_at
updated_at
```

representan instantes técnicos reales de creación o modificación.

---

# 7. Casos nuevos diarios: `casos_eda` y `casos_ira`

Los campos:

```text
registros_diarios.casos_eda
registros_diarios.casos_ira
```

representan:

> Casos nuevos reportados durante el día.

No representan casos activos ni cantidades acumuladas.

Ejemplo:

```text
14 octubre
EDA = 8

15 octubre
EDA = 3

16 octubre
EDA = 4
```

El total del período sería:

```text
8 + 3 + 4 = 15
```

No debe almacenarse:

```text
8
11
15
```

como valor diario acumulado.

---

# 8. Integridad referencial

MongoDB no implementa claves foráneas tradicionales.

Las siguientes relaciones son referencias lógicas:

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
```

`$jsonSchema` garantiza tipos BSON.

Por ejemplo:

```text
albergue_id debe ser ObjectId
```

pero no garantiza:

```text
el ObjectId existe realmente en albergues
```

La aplicación debe comprobar la existencia de las referencias antes de persistir información.

Los controles DBA utilizan `$lookup` para detectar referencias huérfanas.

---

# 9. Trazabilidad

## 9.1 Creación

`created_at`

Representa el instante original de creación.

No debe modificarse posteriormente.

`registrado_por`

Representa el usuario creador original.

No debe sustituirse para indicar quién realizó una actualización.

---

## 9.2 Modificación

Los esquemas de:

```text
albergues
registros_diarios
condiciones_sanitarias
casos_enfermedades
intervenciones
```

permiten:

```text
updated_at
updated_by
```

`updated_at`

representa el instante de la última modificación.

`updated_by`

representa el `_id` del usuario responsable de esa modificación.

Ejemplo:

```javascript
{
    registrado_por: ObjectId("..."),

    created_at: ISODate("..."),

    updated_by: ObjectId("..."),

    updated_at: ISODate("...")
}
```

Un documento nunca modificado puede no contener:

```text
updated_at
updated_by
```

---

# 10. Historial de modificaciones

La trazabilidad actual registra:

- creación original;
- última modificación.

No conserva automáticamente todas las versiones históricas de un documento.

Por tanto:

> La implementación actual no constituye un sistema completo de auditoría histórica de versiones.

La colección:

```text
auditoria_actividades
```

será incorporada posteriormente dentro del alcance DBA aprobado para cubrir auditoría funcional de acciones.

---

# 11. Índices vigentes

## 11.1 `usuarios`

Correo único:

```text
ux_usuarios_email
```

Consulta por albergue:

```text
ix_usuarios_albergue_id
```

---

## 11.2 `albergues`

Código único:

```text
ux_albergues_codigo_albergue
```

---

## 11.3 `registros_diarios`

Registro consolidado único:

```text
ux_registros_diarios_albergue_fecha
```

---

## 11.4 `condiciones_sanitarias`

Consulta por albergue y fecha:

```text
ix_condiciones_sanitarias_albergue_fecha
```

No es único.

---

## 11.5 `casos_enfermedades`

Consulta temporal:

```text
ix_casos_enfermedades_albergue_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

Consulta histórica por enfermedad:

```text
ix_casos_enfermedades_albergue_enfermedad_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    enfermedad: 1,
    fecha: -1
}
```

Los índices no son únicos.

Actualmente no existe una regla funcional aprobada que limite a un único registro por:

```text
albergue + enfermedad + fecha
```

---

## 11.6 `intervenciones`

Consulta temporal por albergue:

```text
ix_intervenciones_albergue_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    fecha_intervencion: -1
}
```

Consulta histórica por tipo de intervención:

```text
ix_intervenciones_albergue_tipo_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    tipo_intervencion: 1,
    fecha_intervencion: -1
}
```

Ambos índices son:

```text
NO UNIQUE
```

Esto permite registrar varias intervenciones sobre el mismo albergue y fecha.

También permite registrar varias intervenciones del mismo tipo y fecha cuando representan acciones reales independientes.

---

## 11.7 `schema_migrations`

Versión única:

```text
ux_schema_migrations_version
```

---

# 12. Migraciones

Las migraciones aplicadas no deben editarse retroactivamente.

Actualmente existen:

```text
001_fix_colombia_timezone.js
002_create_usuarios.js
003_harden_data_integrity.js
004_add_update_traceability.js
005_create_condiciones_sanitarias.js
006_create_casos_enfermedades.js
007_create_intervenciones.js
```

La migración `001` fue ejecutada antes de la creación de:

```text
schema_migrations
```

Por esa razón puede no aparecer registrada históricamente.

No debe inventarse una fecha de ejecución.

Las migraciones posteriores utilizan:

```text
schema_migrations
```

y deben tener versiones únicas.

---

## 12.1 Migración 005

```text
005_create_condiciones_sanitarias.js
```

incorporó:

- colección `condiciones_sanitarias`;
- `$jsonSchema`;
- índice `ix_condiciones_sanitarias_albergue_fecha`;
- trazabilidad;
- controles de referencias lógicas;
- registro en `schema_migrations`.

---

## 12.2 Migración 006

```text
006_create_casos_enfermedades.js
```

incorporó:

- colección `casos_enfermedades`;
- `$jsonSchema`;
- validación de `cantidad_casos_activos >= 0`;
- índice `ix_casos_enfermedades_albergue_fecha`;
- índice `ix_casos_enfermedades_albergue_enfermedad_fecha`;
- trazabilidad;
- controles de referencias lógicas;
- registro en `schema_migrations`.

---

## 12.3 Migración 007

```text
007_create_intervenciones.js
```

incorporó:

- colección `intervenciones`;
- `$jsonSchema`;
- validación `strict`;
- índice `ix_intervenciones_albergue_fecha`;
- índice `ix_intervenciones_albergue_tipo_fecha`;
- trazabilidad de creación y modificación;
- controles de referencias lógicas;
- registro en `schema_migrations`;
- verificación de la migración anterior;
- verificación final de índices y registro de migración.

La migración requiere que:

```text
006_create_casos_enfermedades
```

se encuentre aplicada exactamente una vez.

---

# 13. Evolución de los esquemas

Todo nuevo cambio estructural debe realizarse mediante una migración nueva.

No debe modificarse una migración ya aplicada para representar cambios posteriores.

Cuando se agreguen nuevos campos:

1. analizar impacto;
2. crear nueva migración;
3. considerar inicialmente el campo opcional si existen documentos históricos;
4. migrar información existente únicamente cuando pueda determinarse correctamente;
5. actualizar productores y consumidores;
6. ejecutar pruebas;
7. actualizar `init_semaforo_vital.js`;
8. actualizar documentación.

No debe inventarse información para completar documentos históricos.

---

# 14. Datos semilla

```text
seed_semaforo_vital.js
```

es reejecutable.

Los datos semilla utilizan identificadores determinísticos cuando corresponde.

Para:

```text
registrado_por
```

se utiliza un usuario real:

```text
super_administrador
```

con:

```text
active = true
```

No deben utilizarse usuarios ficticios como referencia.

---

# 15. Inicialización reproducible

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
schema_migrations
```

Si una colección no existe:

```text
createCollection
```

Si existe:

```text
collMod
```

Los índices se crean o verifican de manera reejecutable.

La ejecución repetida no debe generar documentos ni índices duplicados.

La inicialización reproduce el estado estructural vigente, mientras que las migraciones conservan el historial de evolución de ambientes existentes.

---

# 16. Responsabilidades por capa

## 16.1 Base de datos / DBA

MongoDB y los componentes DBA garantizan:

- tipos BSON;
- campos obligatorios;
- rangos numéricos;
- estructura documental;
- validadores `$jsonSchema`;
- índices;
- unicidad cuando existe una regla aprobada;
- trazabilidad estructural;
- migraciones;
- inicialización reproducible;
- controles de referencias huérfanas;
- pruebas de integridad;
- contrato de persistencia.

---

## 16.2 Aplicación / Backend

La aplicación debe garantizar:

- existencia de usuarios referenciados;
- existencia de albergues referenciados;
- autorización según rol;
- generación segura de contraseñas;
- normalización del correo;
- normalización de fechas;
- asignación correcta de `registrado_por`;
- asignación correcta de `updated_by`;
- asignación correcta de `updated_at`;
- protección de `created_at`;
- interpretación correcta de la semántica de cada campo;
- manejo de errores de validación e integridad;
- diferenciar intervenciones reales de intervenciones simuladas.

La capa DBA define el contrato.

La implementación de lógica de negocio correspondiente pertenece al backend.

---

# 17. Pruebas de integridad

Existen diferentes suites DBA.

## 17.1 Validaciones originales

Archivo:

```text
database/mongodb/tests/test_validaciones.js
```

Resultado esperado:

```text
Pruebas exitosas: 8
Pruebas fallidas: 0
```

---

## 17.2 Integridad QA

Archivo:

```text
database/mongodb/tests/test_integridad_qa.js
```

Resultado:

```text
12 pruebas exitosas
0 pruebas fallidas
```

---

## 17.3 Condiciones sanitarias

Archivo:

```text
database/mongodb/tests/test_condiciones_sanitarias.js
```

Resultado validado:

```text
Pruebas exitosas: 14
Pruebas fallidas: 0
```

Valida:

- documento válido;
- campos obligatorios;
- tipos BSON;
- cantidades negativas;
- recursos sanitarios;
- propiedades adicionales;
- trazabilidad;
- índice;
- referencias huérfanas.

---

## 17.4 Casos de enfermedades

Archivo:

```text
database/mongodb/tests/test_casos_enfermedades.js
```

Resultado validado:

```text
Pruebas exitosas: 14
Pruebas fallidas: 0
```

Valida:

- documento válido;
- obligatoriedad de `albergue_id`;
- obligatoriedad de `fecha`;
- obligatoriedad de `enfermedad`;
- obligatoriedad de `cantidad_casos_activos`;
- obligatoriedad de `fuente_datos`;
- enfermedad no vacía;
- rechazo de cantidades negativas;
- tipo BSON de `cantidad_casos_activos`;
- tipo BSON de `registrado_por`;
- rechazo de propiedades adicionales;
- `updated_at`;
- `updated_by`;
- índices epidemiológicos;
- detección de referencias huérfanas.

---

## 17.5 Intervenciones

Archivo:

```text
database/mongodb/tests/test_intervenciones.js
```

Resultado validado:

```text
Pruebas exitosas: 15
Pruebas fallidas: 0
```

La suite valida:

- documento válido;
- obligatoriedad de `albergue_id`;
- obligatoriedad de `fecha_intervencion`;
- obligatoriedad de `tipo_intervencion`;
- obligatoriedad de `descripcion`;
- obligatoriedad de `fuente_datos`;
- rechazo de `tipo_intervencion` vacío;
- rechazo de `descripcion` vacía;
- tipo BSON de `fecha_intervencion`;
- tipo BSON de `registrado_por`;
- rechazo de propiedades adicionales;
- trazabilidad mediante `updated_at` y `updated_by`;
- múltiples intervenciones del mismo tipo y fecha;
- existencia de los índices;
- detección de referencias huérfanas mediante `$lookup`.

La suite fue ejecutada nuevamente después de actualizar:

```text
init_semaforo_vital.js
```

y conservó:

```text
15/15
```

---

# 18. Regla general

El contrato de persistencia forma parte de la interfaz entre backend y base de datos.

Cualquier modificación de:

- nombres;
- tipos;
- referencias;
- índices;
- semántica;
- catálogos;
- reglas temporales;
- obligatoriedad;

debe realizarse mediante:

1. análisis de impacto;
2. migración versionada cuando corresponda;
3. pruebas;
4. actualización del `init`;
5. documentación;
6. coordinación con las capas consumidoras.

---

# 19. Colección `condiciones_sanitarias`

## 19.1 Propósito

Almacena las condiciones sanitarias observadas en un albergue para una fecha determinada.

Complementa:

```text
registros_diarios
```

No reemplaza ni duplica el registro diario consolidado.

---

## 19.2 Estructura

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

---

## 19.3 Campos obligatorios

```text
albergue_id
fecha
agua_potable_disponible
banos_disponibles
estado_higiene
estado_saneamiento
fuente_datos
registrado_por
created_at
```

---

## 19.4 Catálogos pendientes

Los catálogos de:

```text
estado_higiene
estado_saneamiento
fuente_datos
```

se encuentran pendientes de definición funcional.

Actualmente se validan como:

```text
String no vacío
```

No deben incorporarse valores `enum` unilateralmente desde la base de datos.

---

## 19.5 Índice

```text
ix_condiciones_sanitarias_albergue_fecha
```

sobre:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

No es único.

---

# 20. Colección `casos_enfermedades`

## 20.1 Propósito

`casos_enfermedades` almacena la cantidad de casos activos de una enfermedad determinada para un albergue y una fecha específica.

Esta colección permite mantener información epidemiológica histórica sin almacenar datos de identificación individual de pacientes.

---

## 20.2 Documento válido

```javascript
{
    _id: ObjectId("..."),

    albergue_id: ObjectId("..."),

    fecha: ISODate("..."),

    enfermedad: "EDA",

    cantidad_casos_activos: NumberInt(7),

    observaciones: "Seguimiento epidemiológico",

    fuente_datos: "registro_manual",

    registrado_por: ObjectId("..."),

    created_at: ISODate("..."),

    updated_at: ISODate("..."),

    updated_by: ObjectId("...")
}
```

---

## 20.3 Campos obligatorios

```text
albergue_id
fecha
enfermedad
cantidad_casos_activos
fuente_datos
registrado_por
created_at
```

Campos opcionales:

```text
observaciones
updated_at
updated_by
```

---

## 20.4 Semántica de `cantidad_casos_activos`

`cantidad_casos_activos` significa:

> Cantidad de personas que presentan activamente la enfermedad indicada en la fecha del registro.

Ejemplo:

```text
Albergue A
Fecha: 2026-11-10
Enfermedad: EDA
cantidad_casos_activos = 7
```

significa:

> En esa fecha existen 7 personas con EDA activa.

No significa:

> Se presentaron 7 casos nuevos ese día.

Tampoco significa:

> Se han presentado 7 casos acumulados desde el inicio del seguimiento.

---

## 20.5 Diferencia frente a `registros_diarios`

### `registros_diarios.casos_eda`

Representa:

> Casos nuevos de EDA reportados durante ese día.

### `casos_enfermedades.cantidad_casos_activos`

Representa:

> Casos que continúan activos en la fecha indicada.

Ejemplo:

```text
Día 1

casos nuevos EDA = 5
casos activos EDA = 5
```

Al día siguiente pueden presentarse:

```text
Día 2

casos nuevos EDA = 2
casos activos EDA = 6
```

Esto puede ocurrir porque:

- aparecen casos nuevos;
- algunos casos anteriores continúan activos;
- otros pueden haberse recuperado.

Por tanto, ambos valores cumplen propósitos diferentes y no deben intercambiarse.

---

## 20.6 Validaciones

`enfermedad`

Debe ser:

```text
String
```

con longitud mínima de 1.

`cantidad_casos_activos`

Debe ser:

```text
Int32 >= 0
```

`fuente_datos`

Debe ser:

```text
String no vacío
```

---

## 20.7 Catálogo de enfermedades

El catálogo oficial de enfermedades se encuentra pendiente de definición funcional.

Por esta razón:

```text
enfermedad
```

permanece como `String` abierto.

No existe todavía un `enum`.

No debe agregarse unilateralmente desde la capa DBA hasta contar con definición aprobada.

---

## 20.8 Fuente de datos

El catálogo de:

```text
fuente_datos
```

también se encuentra pendiente.

Actualmente se valida únicamente como:

```text
String no vacío
```

---

## 20.9 Referencias lógicas

```text
casos_enfermedades.albergue_id
    → albergues._id

casos_enfermedades.registrado_por
    → usuarios._id

casos_enfermedades.updated_by
    → usuarios._id
```

MongoDB valida el tipo:

```text
ObjectId
```

La existencia efectiva debe comprobarse desde la aplicación.

Los controles DBA pueden detectar referencias huérfanas mediante:

```text
$lookup
```

---

## 20.10 Índices

Primer índice:

```text
ix_casos_enfermedades_albergue_fecha
```

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

Segundo índice:

```text
ix_casos_enfermedades_albergue_enfermedad_fecha
```

```javascript
{
    albergue_id: 1,
    enfermedad: 1,
    fecha: -1
}
```

Ninguno es único.

---

## 20.11 Migración

La colección fue incorporada mediante:

```text
006_create_casos_enfermedades.js
```

La migración:

- verifica la existencia de colecciones requeridas;
- verifica la migración 005;
- crea o actualiza la colección;
- aplica `$jsonSchema`;
- establece validación `strict`;
- crea los dos índices;
- controla referencias lógicas;
- registra la migración;
- verifica que el registro sea único;
- verifica la existencia de los índices.

La migración ya aplicada no debe modificarse retroactivamente.

---

## 20.12 Inicialización reproducible

`init_semaforo_vital.js` contiene el contrato estructural vigente de:

```text
casos_enfermedades
```

En una instalación nueva crea la colección.

En una instalación existente utiliza:

```text
collMod
```

para garantizar que el validador sea el vigente.

---

## 20.13 Pruebas DBA

Archivo:

```text
database/mongodb/tests/test_casos_enfermedades.js
```

Resultado validado:

```text
Pruebas exitosas: 14
Pruebas fallidas: 0
```

---

# 21. Colección `intervenciones`

## 21.1 Propósito

La colección:

```text
intervenciones
```

almacena las acciones reales ejecutadas sobre los albergues.

Una intervención debe representar:

> Una acción que efectivamente ocurrió.

No debe representar una propuesta, una simulación ni un escenario hipotético.

Esta separación es necesaria porque posteriormente el proyecto incorporará escenarios simulados.

---

## 21.2 Documento válido

```javascript
{
    _id: ObjectId("..."),

    albergue_id: ObjectId("..."),

    fecha_intervencion: ISODate("..."),

    tipo_intervencion: "saneamiento",

    descripcion:
        "Jornada de saneamiento ejecutada en el albergue",

    observaciones:
        "Actividad completada sin novedades",

    fuente_datos:
        "registro_manual",

    registrado_por:
        ObjectId("..."),

    created_at:
        ISODate("..."),

    updated_at:
        ISODate("..."),

    updated_by:
        ObjectId("...")
}
```

---

## 21.3 Campos obligatorios

```text
albergue_id
fecha_intervencion
tipo_intervencion
descripcion
fuente_datos
registrado_por
created_at
```

Campos opcionales:

```text
observaciones
updated_at
updated_by
```

---

## 21.4 Semántica

`fecha_intervencion`

Representa:

> La fecha funcional en la que la acción fue ejecutada.

`tipo_intervencion`

Representa:

> La clasificación funcional de la acción ejecutada.

`descripcion`

Representa:

> La descripción de la intervención realmente realizada.

`observaciones`

Permite almacenar información adicional sobre la acción.

`fuente_datos`

Identifica el origen del registro.

---

## 21.5 Intervenciones reales y simuladas

Esta distinción es obligatoria.

### `intervenciones`

Contiene:

> Acciones reales ejecutadas.

Ejemplo:

```text
Se realizó una jornada de desinfección el 12 de noviembre.
```

Debe persistirse en:

```text
intervenciones
```

### `escenarios.intervenciones_simuladas`

Contendrá posteriormente:

> Acciones hipotéticas utilizadas para evaluar escenarios.

Ejemplo:

```text
¿Qué ocurriría si se instalaran 5 letrinas adicionales?
```

No debe persistirse como una intervención real.

La estructura correspondiente a escenarios será implementada posteriormente dentro de su checkpoint DBA.

---

## 21.6 Validaciones

`albergue_id`

Debe ser:

```text
ObjectId
```

`fecha_intervencion`

Debe ser:

```text
Date
```

`tipo_intervencion`

Debe ser:

```text
String no vacío
```

`descripcion`

Debe ser:

```text
String no vacío
```

`fuente_datos`

Debe ser:

```text
String no vacío
```

`registrado_por`

Debe ser:

```text
ObjectId
```

Los documentos no permiten propiedades adicionales fuera del contrato definido:

```text
additionalProperties: false
```

---

## 21.7 Catálogo de tipos de intervención

El catálogo oficial de:

```text
tipo_intervencion
```

se encuentra pendiente de definición funcional.

Por esta razón se mantiene actualmente como:

```text
String
```

con longitud mínima de 1.

No existe todavía un:

```text
enum
```

No debe incorporarse unilateralmente desde la capa DBA.

---

## 21.8 Fuente de datos

El catálogo oficial de:

```text
fuente_datos
```

también se encuentra pendiente.

Actualmente debe ser:

```text
String no vacío
```

---

## 21.9 Multiplicidad

No existe una restricción de:

```text
una intervención por albergue y día
```

Pueden existir múltiples intervenciones para:

```text
mismo albergue
misma fecha
```

También pueden existir múltiples intervenciones con:

```text
mismo albergue
misma fecha
mismo tipo_intervencion
```

si corresponden a acciones reales independientes.

Por esta razón los índices de la colección no utilizan:

```text
unique: true
```

---

## 21.10 Referencias lógicas

```text
intervenciones.albergue_id
    → albergues._id

intervenciones.registrado_por
    → usuarios._id

intervenciones.updated_by
    → usuarios._id
```

MongoDB valida que los campos sean:

```text
ObjectId
```

pero no garantiza mediante `$jsonSchema` que el documento relacionado exista.

La aplicación debe verificar la existencia efectiva antes de persistir.

Los controles DBA utilizan:

```text
$lookup
```

para detectar referencias huérfanas.

---

## 21.11 Índices

### Consulta por albergue y fecha

```text
ix_intervenciones_albergue_fecha
```

```javascript
{
    albergue_id: 1,
    fecha_intervencion: -1
}
```

Permite consultar cronológicamente las intervenciones de un albergue.

No es único.

### Consulta por albergue, tipo y fecha

```text
ix_intervenciones_albergue_tipo_fecha
```

```javascript
{
    albergue_id: 1,
    tipo_intervencion: 1,
    fecha_intervencion: -1
}
```

Permite consultar la evolución histórica de un tipo de intervención dentro de un albergue.

No es único.

---

## 21.12 Migración

La colección fue incorporada mediante:

```text
007_create_intervenciones.js
```

La migración:

- verifica las colecciones requeridas;
- verifica que la migración 006 esté aplicada;
- crea la colección cuando no existe;
- utiliza `collMod` cuando ya existe;
- aplica `$jsonSchema`;
- establece `validationLevel: strict`;
- establece `validationAction: error`;
- crea los índices;
- valida referencias lógicas existentes;
- registra la migración en `schema_migrations`;
- comprueba que la versión quede registrada una sola vez;
- comprueba la existencia final de los índices.

La migración aplicada no debe modificarse retroactivamente.

---

## 21.13 Inicialización reproducible

El archivo:

```text
database/mongodb/init/init_semaforo_vital.js
```

contiene actualmente el contrato de:

```text
intervenciones
```

En una instalación nueva:

```text
createCollection
```

crea la colección.

En una instalación existente:

```text
collMod
```

actualiza el validator al estado estructural vigente.

También crea o verifica:

```text
ix_intervenciones_albergue_fecha
ix_intervenciones_albergue_tipo_fecha
```

---

## 21.14 Pruebas DBA

Archivo:

```text
database/mongodb/tests/test_intervenciones.js
```

Resultado validado:

```text
Pruebas exitosas: 15
Pruebas fallidas: 0
```

La suite prueba tanto validaciones estructurales como reglas propias del modelo.

Entre ellas se verifica explícitamente que MongoDB permite:

```text
dos intervenciones
mismo albergue
misma fecha
mismo tipo
```

cuando son acciones independientes.

También se verifica la detección de una referencia lógica huérfana mediante:

```text
$lookup
```

Las pruebas fueron ejecutadas nuevamente después de actualizar:

```text
init_semaforo_vital.js
```

conservando el resultado:

```text
15/15
```

---

# 22. Estado del contrato

El modelo MongoDB implementado actualmente incluye:

```text
usuarios                  ✓
albergues                 ✓
registros_diarios         ✓
condiciones_sanitarias    ✓
casos_enfermedades        ✓
intervenciones            ✓
schema_migrations         ✓
```

Migraciones:

```text
001_fix_colombia_timezone           ✓ legacy
002_create_usuarios                 ✓
003_harden_data_integrity           ✓
004_add_update_traceability         ✓
005_create_condiciones_sanitarias   ✓
006_create_casos_enfermedades       ✓
007_create_intervenciones           ✓
```

Pruebas específicas recientes:

```text
condiciones_sanitarias     14/14
casos_enfermedades         14/14
intervenciones             15/15
```

El siguiente crecimiento del modelo debe continuar utilizando:

```text
migración
→ pruebas
→ init
→ documentación
→ commit
→ Pull Request
```

sin modificar retroactivamente las migraciones ya aplicadas.