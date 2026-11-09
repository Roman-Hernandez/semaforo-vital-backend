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

Ejemplo:

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

    created_at: ISODate("2026-10-19T23:48:28.600Z"),

    updated_at: ISODate("2026-10-19T23:58:45.126Z"),

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

Ejemplo:

```javascript
{
    _id: ObjectId("..."),

    email: "admin.albergue@semaforovital.com",

    password_hash: "$argon2id$...",

    role: "administrador_albergue",

    active: true,

    nombre: "Administrador",

    apellido: "Albergue",

    albergue_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),

    created_at: ISODate("..."),

    updated_at: ISODate("..."),

    last_login_at: null
}
```

Para un usuario con:

`role = administrador_albergue`

el campo:

`albergue_id`

es obligatorio y debe ser de tipo `ObjectId`.

Además, la aplicación debe comprobar que dicho `_id` exista realmente en la colección `albergues`.

MongoDB `$jsonSchema` valida el tipo de dato, pero no aplica claves foráneas entre colecciones.

---

# 4. Colección `albergues`

Ejemplo válido:

```javascript
{
    _id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),

    codigo_albergue: "SIM-PER-001",

    nombre: "Albergue Simulado La Esperanza",

    ubicacion: {
        departamento: "Risaralda",
        municipio: "Pereira",
        direccion: "Ubicación simulada - Pereira",

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

    fecha: ISODate("2026-10-14T05:00:00.000Z"),

    created_at: ISODate("...")
}
```

## 4.1 `codigo_albergue`

`codigo_albergue` identifica funcionalmente cada albergue.

Existe un índice único:

`ux_albergues_codigo_albergue`

No pueden existir dos albergues con el mismo código.

---

## 4.2 `registrado_por`

`registrado_por` contiene el `_id` del usuario que creó originalmente el documento.

Debe corresponder a:

`usuarios._id`

MongoDB valida que sea un `ObjectId`, pero no garantiza que el usuario exista.

La aplicación debe validar la existencia del usuario antes de persistir el documento.

Los controles DBA también verifican la inexistencia de referencias huérfanas.

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

La regla de negocio es:

> Solo puede existir un registro consolidado por albergue y día.

Por lo tanto, no deben insertarse múltiples documentos para el mismo:

`albergue_id + fecha`

Las correcciones realizadas durante el mismo día deben actualizar el registro consolidado existente.

---

## 5.2 Documento válido

Ejemplo:

```javascript
{
    _id: ObjectId("..."),

    albergue_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),

    fecha: ISODate("2026-10-14T05:00:00.000Z"),

    poblacion: NumberInt(200),

    litros_agua: 800.0,

    letrinas: NumberInt(4),

    casos_eda: NumberInt(8),

    casos_ira: NumberInt(3),

    registrado_por: ObjectId("..."),

    created_at: ISODate("...")
}
```

---

# 6. Regla de fecha operativa

La zona horaria funcional del proyecto es:

`America/Bogota`

La API debe interpretar una fecha funcional como un día calendario de Colombia.

Ejemplo:

`2026-10-14`

representa:

`2026-10-14 00:00:00 America/Bogota`

MongoDB BSON Date almacena el instante UTC equivalente:

`2026-10-14T05:00:00.000Z`

Por lo tanto:

```text
2026-10-14 00:00 Colombia
=
2026-10-14 05:00 UTC
```

La aplicación no debe normalizar el día operativo utilizando `00:00 UTC`, debido a que eso correspondería a las `19:00` del día anterior en Colombia.

Para `registros_diarios`, se recomienda que el contrato de entrada utilice una fecha calendario:

`YYYY-MM-DD`

en lugar de recibir arbitrariamente timestamps con diferentes zonas horarias.

---

# 7. `casos_eda` y `casos_ira`

Los campos:

`casos_eda`

y:

`casos_ira`

representan **casos nuevos reportados durante el día correspondiente al registro**.

No representan cantidades acumuladas.

Ejemplo:

```text
14 octubre
EDA = 8

15 octubre
EDA = 3

16 octubre
EDA = 4
```

El total del período sería calculado mediante consulta:

```text
8 + 3 + 4 = 15
```

No debe persistirse el acumulado:

```text
8
11
15
```

como valor diario, ya que esto generaría riesgo de doble conteo durante análisis epidemiológicos.

Las cantidades deben ser enteros mayores o iguales a cero.

---

# 8. Integridad referencial

MongoDB no aplica claves foráneas automáticamente.

Las siguientes relaciones son referencias lógicas:

```text
albergues.registrado_por
    → usuarios._id

registros_diarios.registrado_por
    → usuarios._id

registros_diarios.albergue_id
    → albergues._id

usuarios.albergue_id
    → albergues._id

condiciones_sanitarias.albergue_id
    → albergues._id

condiciones_sanitarias.registrado_por
    → usuarios._id

condiciones_sanitarias.updated_by
    → usuarios._id
```

Los validadores `$jsonSchema` garantizan los tipos de datos.

Por ejemplo:

```text
albergue_id debe ser ObjectId
```

pero no pueden garantizar:

```text
el ObjectId debe existir en albergues
```

Por esta razón, la existencia de la referencia debe comprobarse desde la capa de aplicación antes de insertar o modificar documentos.

Adicionalmente, existen pruebas y controles DBA mediante `$lookup` para detectar referencias huérfanas.

---

# 9. Trazabilidad

## 9.1 Creación

`created_at`

Representa el instante original en el que fue creado el documento.

No debe modificarse posteriormente.

`registrado_por`

Representa el usuario que creó originalmente el documento.

No debe reutilizarse como identificador del último usuario modificador.

---

## 9.2 Modificación

Los esquemas de:

- `albergues`
- `registros_diarios`
- `condiciones_sanitarias`

permiten los campos opcionales:

`updated_at`

y:

`updated_by`

`updated_at`

representa el instante de la última modificación.

`updated_by`

representa el `_id` del usuario responsable de la última modificación.

Ejemplo:

```javascript
{
    registrado_por: ObjectId("usuario-creador"),

    created_at: ISODate("2026-10-14T15:00:00Z"),

    updated_by: ObjectId("usuario-modificador"),

    updated_at: ISODate("2026-10-14T18:00:00Z")
}
```

Un documento que nunca haya sido modificado no necesita contener:

- `updated_at`
- `updated_by`

No deben agregarse fechas artificiales a documentos históricos únicamente para completar estos campos.

---

# 10. Historial de modificaciones

Actualmente `registros_diarios` representa el consolidado vigente de un albergue para un día determinado.

Ejemplo:

```text
Albergue A
14 octubre
población = 200
EDA = 8
```

Si posteriormente se detecta un error y EDA debe corregirse a `9`, el documento puede actualizarse manteniendo:

- `created_at` original;
- `registrado_por` original;

y agregando o actualizando:

- `updated_at`;
- `updated_by`.

Este mecanismo permite trazabilidad básica, pero no conserva todas las versiones anteriores del documento.

Por lo tanto:

> La implementación actual NO constituye un sistema completo de auditoría histórica de versiones.

Si posteriormente el negocio requiere conocer:

```text
valor original
valor corregido
usuario modificador
fecha de cada modificación
motivo del cambio
```

deberá implementarse una colección específica de auditoría o versionamiento mediante una nueva historia de usuario.

No se incorpora dicha funcionalidad dentro de la US-08 para evitar ampliar el alcance sin requerimiento funcional explícito.

---

# 11. Índices vigentes

## 11.1 `usuarios`

Correo único:

`ux_usuarios_email`

Referencia de albergue:

`ix_usuarios_albergue_id`

## 11.2 `albergues`

Código funcional único:

`ux_albergues_codigo_albergue`

## 11.3 `registros_diarios`

Registro consolidado único por albergue y día:

`ux_registros_diarios_albergue_fecha`

## 11.4 `condiciones_sanitarias`

Consulta temporal por albergue:

`ix_condiciones_sanitarias_albergue_fecha`

Estructura:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

El índice no es único.

Actualmente no existe una regla funcional aprobada que limite la colección a un único registro de condiciones sanitarias por albergue y día.

## 11.5 `schema_migrations`

Versión de migración única:

`ux_schema_migrations_version`

---

# 12. Migraciones

Las migraciones aplicadas no deben editarse retroactivamente una vez utilizadas en un ambiente compartido.

Actualmente existen:

```text
001_fix_colombia_timezone.js
002_create_usuarios.js
003_harden_data_integrity.js
004_add_update_traceability.js
005_create_condiciones_sanitarias.js
```

La migración `001` fue ejecutada antes de la creación del mecanismo `schema_migrations`.

Por esta razón, puede no aparecer registrada históricamente en dicha colección.

No debe inventarse una fecha de ejecución para corregir retrospectivamente este hecho.

Las migraciones posteriores deben registrarse mediante:

`schema_migrations`

y utilizar versiones únicas.

La migración:

`005_create_condiciones_sanitarias.js`

incorpora la colección `condiciones_sanitarias`, su validador `$jsonSchema`, el índice `ix_condiciones_sanitarias_albergue_fecha` y controles DBA para detectar referencias huérfanas.

---

# 13. Evolución de los esquemas

Para agregar nuevos campos sin romper compatibilidad se debe seguir, cuando corresponda, el siguiente procedimiento.

### Paso 1

Crear una nueva migración.

Nunca modificar una migración ya aplicada para representar un cambio nuevo.

### Paso 2

Agregar inicialmente el nuevo campo como opcional cuando existan documentos históricos que no lo contienen.

### Paso 3

Actualizar los datos existentes mediante una migración controlada únicamente si existe un valor válido que pueda determinarse sin inventar información.

### Paso 4

Actualizar productores y consumidores del dato.

### Paso 5

Solo después de garantizar que todos los documentos contienen el campo, evaluar convertirlo en obligatorio mediante una nueva migración.

Este enfoque mantiene compatibilidad entre documentos históricos y nuevas versiones del sistema.

---

# 14. Datos semilla

`seed_semaforo_vital.js` es reejecutable.

Los albergues utilizan identificadores determinísticos.

Los registros diarios se identifican funcionalmente mediante:

`albergue_id + fecha`

El seed no utiliza identificadores ficticios para `registrado_por`.

Antes de insertar datos, busca un:

`super_administrador`

con:

`active = true`

y utiliza su `_id` real.

Si no existe un superadministrador activo, el proceso debe detenerse.

---

# 15. Inicialización reproducible

La preparación de una base de datos debe respetar el orden definido por el proyecto.

De forma conceptual:

```text
Inicialización base
        ↓
Migraciones versionadas
        ↓
Usuario administrativo inicial
        ↓
Datos semilla
        ↓
Pruebas
```

Las migraciones deben poder ejecutarse repetidamente sin generar registros duplicados ni alterar incorrectamente datos ya migrados.

Los seeds también deben ser reejecutables.

`init_semaforo_vital.js` representa el estado estructural vigente de la base de datos.

Actualmente administra:

```text
usuarios
albergues
registros_diarios
condiciones_sanitarias
schema_migrations
```

Cuando una colección no existe, el script puede crearla.

Cuando ya existe, utiliza `collMod` para actualizar el validador correspondiente.

Los índices se crean o verifican de forma reejecutable.

---

# 16. Responsabilidades por capa

## 16.1 Base de datos / DBA

MongoDB y los componentes DBA garantizan:

- tipos BSON;
- campos obligatorios;
- rangos numéricos;
- roles permitidos;
- formato de email;
- formato esperado de `password_hash`;
- índices únicos cuando existe una regla funcional de unicidad;
- índices de consulta;
- estructura de documentos;
- compatibilidad mediante migraciones;
- seeds reproducibles;
- controles de referencias huérfanas;
- pruebas de integridad del modelo;
- inicialización reproducible.

## 16.2 Aplicación / Backend

La aplicación debe garantizar:

- existencia de usuarios referenciados;
- existencia de albergues referenciados;
- autorización según rol;
- generación segura del hash de contraseña;
- normalización del email antes de persistir;
- normalización de la fecha operativa;
- asignación correcta de `updated_at`;
- asignación correcta de `updated_by`;
- protección funcional de `created_at`;
- protección funcional de `registrado_por`;
- manejo de errores por duplicidad e integridad.

---

# 17. Pruebas de integridad

El modelo dispone de pruebas automatizadas para comprobar:

- documento de usuario válido;
- email duplicado;
- email no normalizado;
- hash inválido;
- rol inválido;
- administrador de albergue sin `albergue_id`;
- superadministrador asociado incorrectamente a un albergue;
- `codigo_albergue` duplicado;
- registro diario duplicado por `albergue_id + fecha`;
- tipo incorrecto de `updated_by`;
- referencias inexistentes a usuarios;
- referencias inexistentes a albergues;
- limpieza posterior de los documentos temporales.

Las pruebas de referencias inexistentes tienen un propósito particular.

MongoDB puede aceptar un `ObjectId` estructuralmente válido aunque el documento referenciado no exista.

Por esta razón, las pruebas demuestran que el control DBA mediante `$lookup` detecta la inconsistencia.

Para la colección `condiciones_sanitarias` existe adicionalmente:

`database/mongodb/tests/test_condiciones_sanitarias.js`

La suite valida:

- inserción de un documento válido;
- obligatoriedad de `albergue_id`;
- obligatoriedad de `fecha`;
- rechazo de `banos_disponibles` negativos;
- tipo Boolean de `agua_potable_disponible`;
- rechazo de `estado_higiene` vacío;
- obligatoriedad de `estado_saneamiento`;
- obligatoriedad de `fuente_datos`;
- rechazo de cantidades negativas en recursos sanitarios;
- rechazo de propiedades no definidas;
- tipo `ObjectId` de `registrado_por`;
- trazabilidad mediante `updated_at` y `updated_by`;
- existencia del índice `ix_condiciones_sanitarias_albergue_fecha`;
- detección DBA de referencias huérfanas.

Resultado validado:

```text
Pruebas exitosas: 14
Pruebas fallidas: 0
```

Los documentos temporales utilizados durante las pruebas son eliminados al finalizar.

---

# 18. Regla general

El contrato de persistencia vigente debe considerarse parte de la interfaz entre backend y base de datos.

Cualquier modificación de:

- nombres;
- tipos;
- roles;
- referencias;
- índices;
- reglas temporales;
- semántica de campos;

debe realizarse mediante:

1. análisis de impacto;
2. migración versionada cuando corresponda;
3. pruebas;
4. documentación;
5. coordinación entre DBA y backend.

---

# 19. Colección `condiciones_sanitarias`

## 19.1 Propósito

`condiciones_sanitarias` almacena información sobre las condiciones sanitarias observadas en un albergue para una fecha determinada.

La colección complementa la información existente en `registros_diarios`.

No reemplaza `registros_diarios` ni debe utilizarse para duplicar los datos consolidados almacenados en dicha colección.

---

## 19.2 Documento válido

Ejemplo:

```javascript
{
    _id: ObjectId("..."),

    albergue_id: ObjectId("..."),

    fecha: ISODate("..."),

    agua_potable_disponible: true,

    banos_disponibles: NumberInt(6),

    estado_higiene: "adecuado",

    estado_saneamiento: "operativo",

    otros_recursos_sanitarios: [
        {
            nombre: "lavamanos",
            cantidad: NumberInt(4),
            observacion: "Disponibles"
        }
    ],

    observaciones: "Sin novedades",

    fuente_datos: "registro_manual",

    registrado_por: ObjectId("..."),

    created_at: ISODate("..."),

    updated_at: ISODate("..."),

    updated_by: ObjectId("...")
}
```

---

## 19.3 Campos obligatorios

Son obligatorios:

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

Son opcionales:

```text
otros_recursos_sanitarios
observaciones
updated_at
updated_by
```

---

## 19.4 Reglas de validación

`albergue_id`

Debe ser de tipo `ObjectId`.

`fecha`

Debe ser de tipo `Date`.

`agua_potable_disponible`

Debe ser de tipo Boolean.

`banos_disponibles`

Debe ser un entero mayor o igual a cero.

`estado_higiene`

Debe ser una cadena no vacía.

`estado_saneamiento`

Debe ser una cadena no vacía.

`fuente_datos`

Debe ser una cadena no vacía.

Los catálogos funcionales definitivos para:

```text
estado_higiene
estado_saneamiento
fuente_datos
```

se encuentran pendientes de definición funcional.

Por esta razón, el `$jsonSchema` vigente valida que los valores sean cadenas no vacías, pero no utiliza todavía restricciones `enum`.

Estos catálogos no deben establecerse unilateralmente desde la capa de base de datos.

---

## 19.5 Otros recursos sanitarios

`otros_recursos_sanitarios` es opcional.

Cuando exista, debe ser un arreglo de documentos con la estructura:

```javascript
{
    nombre: String,
    cantidad: Int32,
    observacion: String
}
```

Son obligatorios dentro de cada elemento:

```text
nombre
cantidad
```

`nombre` debe ser una cadena no vacía.

`cantidad` debe ser un entero mayor o igual a cero.

`observacion` es opcional.

No se permiten propiedades adicionales dentro de cada recurso sanitario.

---

## 19.6 Referencias lógicas

Las relaciones vigentes son:

```text
condiciones_sanitarias.albergue_id
    → albergues._id

condiciones_sanitarias.registrado_por
    → usuarios._id

condiciones_sanitarias.updated_by
    → usuarios._id
```

MongoDB `$jsonSchema` garantiza que estas referencias tengan tipo `ObjectId`, pero no puede garantizar por sí mismo que el documento relacionado exista.

La aplicación debe validar la existencia de las referencias antes de persistir información.

Los controles DBA utilizan `$lookup` para detectar referencias huérfanas.

---

## 19.7 Trazabilidad

`registrado_por`

Identifica al usuario responsable de la creación original del documento.

`created_at`

Representa la fecha y hora técnica original de creación y no debe modificarse posteriormente.

Cuando el documento sea actualizado pueden utilizarse:

```text
updated_at
updated_by
```

`updated_at` representa el instante de la última modificación.

`updated_by` debe corresponder al `_id` del usuario responsable de dicha modificación.

---

## 19.8 Índice

La colección utiliza:

`ix_condiciones_sanitarias_albergue_fecha`

sobre:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

El índice acelera las consultas históricas y temporales de condiciones sanitarias por albergue.

No es un índice único.

Actualmente no existe una regla funcional aprobada que limite la colección a un único documento por albergue y día.

---

## 19.9 Migración

La colección fue incorporada mediante:

`005_create_condiciones_sanitarias.js`

La migración:

- crea la colección cuando no existe;
- actualiza el validador cuando la colección ya existe;
- crea o verifica el índice requerido;
- comprueba referencias lógicas existentes;
- registra su ejecución en `schema_migrations`;
- verifica que la migración quede registrada una sola vez.

La migración aplicada no debe modificarse retroactivamente.

---

## 19.10 Inicialización reproducible

`init_semaforo_vital.js` representa actualmente el estado estructural vigente de esta colección.

En una instalación nueva puede crear `condiciones_sanitarias`.

En una instalación existente utiliza `collMod` para garantizar que el validador vigente corresponda al contrato actual.

La ejecución repetida del `init` no debe duplicar documentos ni índices.

---

## 19.11 Pruebas DBA

El archivo:

`database/mongodb/tests/test_condiciones_sanitarias.js`

contiene la suite específica de validación de esta colección.

Resultado obtenido:

```text
Pruebas exitosas: 14
Pruebas fallidas: 0
```

Las pruebas comprueban:

- documento válido;
- campos obligatorios;
- tipos BSON;
- valores negativos;
- propiedades adicionales;
- estructura de recursos sanitarios;
- trazabilidad de actualización;
- existencia del índice;
- detección de referencias huérfanas.

Las pruebas fueron ejecutadas nuevamente después de actualizar `init_semaforo_vital.js`, confirmando que la inicialización reproducible conserva correctamente las restricciones definidas para la colección.