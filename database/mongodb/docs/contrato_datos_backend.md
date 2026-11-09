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
- casos EDA e IRA;
- evolución futura de los esquemas.

La base de datos utilizada es:

`semaforo_vital`

---

## 2. Colecciones principales

Actualmente el modelo operativo utiliza las siguientes colecciones:

- `usuarios`
- `albergues`
- `registros_diarios`
- `condiciones_sanitarias`
- `casos_enfermedades`
- `schema_migrations`

La colección conceptual solicitada inicialmente como `users` fue implementada por backend como `usuarios`.

Por compatibilidad con el login existente, el contrato vigente mantiene los nombres ya implementados.

### Equivalencias conceptuales

| Concepto solicitado | Implementación vigente |
|---|---|
| `users` | `usuarios` |
| `SUPER_ADMIN` | `super_administrador` |
| `SHELTER_ADMIN` | `administrador_albergue` |
| `shelterId` | `albergue_id` |
| estado | `active` |
| correo normalizado | `email` |

Estos nombres no deben modificarse unilateralmente desde la capa de base de datos, ya que forman parte del contrato utilizado actualmente por autenticación.

---

# 3. Colección `usuarios`

## 3.1 Propósito

La colección `usuarios` almacena los usuarios autorizados para acceder al sistema.

La contraseña nunca debe almacenarse en texto plano.

MongoDB almacena exclusivamente:

`password_hash`

El mecanismo actual de autenticación utiliza hashes Argon2id.

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

- `super_administrador`
- `administrador_albergue`

`active`

Indica si el usuario se encuentra habilitado.

`albergue_id`

Para `super_administrador` debe ser `null`.

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

`role = administrador_albergue`

el campo:

`albergue_id`

es obligatorio y debe ser `ObjectId`.

Además, debe corresponder a un documento existente en `albergues`.

MongoDB `$jsonSchema` puede validar el tipo, pero no aplica claves foráneas.

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

## 4.2 Código funcional

`codigo_albergue` identifica funcionalmente el albergue.

Existe el índice único:

`ux_albergues_codigo_albergue`

No pueden existir dos albergues con el mismo código.

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

## 4.4 Trazabilidad

`registrado_por`

Debe corresponder a:

`usuarios._id`

`updated_by`

Cuando exista, también debe corresponder a:

`usuarios._id`

---

# 5. Colección `registros_diarios`

## 5.1 Propósito

`registros_diarios` almacena el consolidado operativo de un albergue para un día específico.

Existe un índice único compuesto:

`ux_registros_diarios_albergue_fecha`

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

`America/Bogota`

Una fecha funcional:

`2026-10-14`

representa:

`2026-10-14 00:00:00 America/Bogota`

MongoDB almacena el instante UTC equivalente:

`2026-10-14T05:00:00.000Z`

Por tanto:

```text
2026-10-14 00:00 Colombia
=
2026-10-14 05:00 UTC
```

La aplicación no debe normalizar días operativos utilizando `00:00 UTC`.

Para datos diarios se recomienda recibir:

`YYYY-MM-DD`

y normalizar utilizando `America/Bogota`.

---

# 7. Casos nuevos diarios: `casos_eda` y `casos_ira`

Los campos:

`registros_diarios.casos_eda`

y:

`registros_diarios.casos_ira`

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
```

`$jsonSchema` garantiza tipos BSON.

Ejemplo:

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

- `albergues`
- `registros_diarios`
- `condiciones_sanitarias`
- `casos_enfermedades`

permiten:

`updated_at`

y:

`updated_by`

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

- `updated_at`
- `updated_by`

---

# 10. Historial de modificaciones

La trazabilidad actual registra:

- creación original;
- última modificación.

No conserva automáticamente todas las versiones históricas de un documento.

Por tanto:

> La implementación actual no constituye un sistema completo de auditoría histórica de versiones.

La colección `auditoria_actividades` será incorporada posteriormente dentro del alcance DBA aprobado para cubrir auditoría funcional de acciones.

---

# 11. Índices vigentes

## 11.1 `usuarios`

Correo único:

`ux_usuarios_email`

Consulta por albergue:

`ix_usuarios_albergue_id`

## 11.2 `albergues`

Código único:

`ux_albergues_codigo_albergue`

## 11.3 `registros_diarios`

Registro consolidado único:

`ux_registros_diarios_albergue_fecha`

## 11.4 `condiciones_sanitarias`

Consulta por albergue y fecha:

`ix_condiciones_sanitarias_albergue_fecha`

No es único.

## 11.5 `casos_enfermedades`

Consulta temporal:

`ix_casos_enfermedades_albergue_fecha`

sobre:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

Consulta histórica por enfermedad:

`ix_casos_enfermedades_albergue_enfermedad_fecha`

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

`albergue + enfermedad + fecha`

## 11.6 `schema_migrations`

Versión única:

`ux_schema_migrations_version`

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
```

La migración `001` fue ejecutada antes de la creación de `schema_migrations`.

Por esa razón puede no aparecer registrada históricamente.

No debe inventarse una fecha de ejecución.

Las migraciones posteriores utilizan:

`schema_migrations`

y deben tener versiones únicas.

---

## 12.1 Migración 005

`005_create_condiciones_sanitarias.js`

incorporó:

- colección `condiciones_sanitarias`;
- `$jsonSchema`;
- índice `ix_condiciones_sanitarias_albergue_fecha`;
- trazabilidad;
- controles de referencias lógicas;
- registro en `schema_migrations`.

---

## 12.2 Migración 006

`006_create_casos_enfermedades.js`

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

`seed_semaforo_vital.js` es reejecutable.

Los datos semilla utilizan identificadores determinísticos cuando corresponde.

Para `registrado_por` se utiliza un usuario real:

`super_administrador`

con:

`active = true`

No deben utilizarse usuarios ficticios como referencia.

---

# 15. Inicialización reproducible

El archivo:

`database/mongodb/init/init_semaforo_vital.js`

representa el estado estructural vigente.

Actualmente administra:

```text
usuarios
albergues
registros_diarios
condiciones_sanitarias
casos_enfermedades
schema_migrations
```

Si una colección no existe:

`createCollection`

Si existe:

`collMod`

Los índices se crean o verifican de manera reejecutable.

La ejecución repetida no debe generar documentos ni índices duplicados.

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
- manejo de errores de validación e integridad.

---

# 17. Pruebas de integridad

Existen diferentes suites DBA.

## 17.1 Validaciones originales

Archivo:

`database/mongodb/tests/test_validaciones.js`

Resultado esperado:

```text
Pruebas exitosas: 8
Pruebas fallidas: 0
```

---

## 17.2 Integridad QA

Archivo:

`database/mongodb/tests/test_integridad_qa.js`

Resultado:

```text
12 pruebas exitosas
0 pruebas fallidas
```

---

## 17.3 Condiciones sanitarias

Archivo:

`database/mongodb/tests/test_condiciones_sanitarias.js`

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

`database/mongodb/tests/test_casos_enfermedades.js`

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
- ambos índices epidemiológicos;
- detección de referencias huérfanas.

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

Complementa `registros_diarios`.

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

Actualmente se validan como `String` no vacío.

No deben incorporarse valores `enum` unilateralmente desde la base de datos.

---

## 19.5 Índice

`ix_condiciones_sanitarias_albergue_fecha`

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

Esta diferencia es obligatoria para todas las capas consumidoras.

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

- aparecen 2 casos nuevos;
- algunos casos anteriores continúan activos;
- otros pueden haberse recuperado.

Por tanto, ambos valores cumplen propósitos diferentes y no deben intercambiarse.

---

## 20.6 Validaciones

`enfermedad`

Debe ser:

`String`

con longitud mínima de 1.

`cantidad_casos_activos`

Debe ser:

`Int32`

y:

```text
>= 0
```

`fuente_datos`

Debe ser:

`String`

no vacío.

---

## 20.7 Catálogo de enfermedades

El catálogo oficial de enfermedades se encuentra pendiente de definición funcional.

Por esta razón:

`enfermedad`

permanece como `String` abierto.

No existe todavía un `enum`.

No debe agregarse unilateralmente desde la capa DBA hasta contar con definición aprobada.

---

## 20.8 Fuente de datos

El catálogo de:

`fuente_datos`

también se encuentra pendiente.

Actualmente se valida únicamente como `String` no vacío.

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

MongoDB valida el tipo `ObjectId`.

La existencia efectiva debe comprobarse desde la aplicación.

Los controles DBA pueden detectar referencias huérfanas mediante `$lookup`.

---

## 20.10 Índices

Primer índice:

`ix_casos_enfermedades_albergue_fecha`

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

Permite consultar la situación epidemiológica histórica de un albergue.

Segundo índice:

`ix_casos_enfermedades_albergue_enfermedad_fecha`

```javascript
{
    albergue_id: 1,
    enfermedad: 1,
    fecha: -1
}
```

Permite consultar la evolución histórica de una enfermedad determinada dentro de un albergue.

Ninguno es único.

Actualmente no existe una regla funcional aprobada de:

> un único registro por albergue + enfermedad + fecha.

---

## 20.11 Migración

La colección fue incorporada mediante:

`006_create_casos_enfermedades.js`

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

`casos_enfermedades`

En una instalación nueva crea la colección.

En una instalación existente utiliza:

`collMod`

para garantizar que el validador sea el vigente.

También crea o verifica los índices correspondientes.

---

## 20.13 Pruebas DBA

Archivo:

`database/mongodb/tests/test_casos_enfermedades.js`

Resultado validado:

```text
Pruebas exitosas: 14
Pruebas fallidas: 0
```

Las pruebas fueron ejecutadas nuevamente después de actualizar `init_semaforo_vital.js`.

Esto confirma que la inicialización reproducible conserva correctamente el contrato de la colección.