# Evidencias US-08

## Implementación de esquemas de validación, índices y datos semilla en MongoDB

**Proyecto:** Semáforo Vital  
**Historia de Usuario:** US-08  
**Rol:** Gestor de Base de Datos  
**Base de datos:** `semaforo_vital`  
**Cluster de desarrollo:** `semaforo-vital-dev`  
**Motor:** MongoDB Atlas  
**Fecha de validación:** 14 de octubre de 2026

---

## 1. Objetivo de la US-08

Implementar el script de inicialización de MongoDB con colecciones, validadores nativos `$jsonSchema`, índices temporales y datos semilla de albergues simulados de Pereira, garantizando validaciones de integridad y rangos desde el motor documental y dejando un entorno persistente para pruebas del backend.

**Trazabilidad funcional:** RF-16, RF-17, RF-18, RF-57, RF-58, RF-61, RNF-01 y RNF-12.

**Dependencia:** HU-01 - Modelado conceptual de colecciones.

---

## 2. Evidencia de infraestructura en MongoDB Atlas

Se configuró el proyecto de MongoDB Atlas para Semáforo Vital con el cluster de desarrollo:

```text
semaforo-vital-dev
```

Se verificó la conexión desde el equipo de desarrollo utilizando `mongosh 2.13.0`.

Pruebas de conectividad realizadas:

```javascript
db.getName()
```

Resultado:

```text
semaforo_vital
```

Prueba:

```javascript
db.runCommand({ ping: 1 })
```

Resultado:

```javascript
{ ok: 1 }
```

Antes de ejecutar los scripts de la US, la base se encontraba sin colecciones:

```javascript
db.getCollectionNames()
```

Resultado inicial:

```javascript
[]
```

### Seguridad configurada

Se creó un usuario específico para administración de la base de datos de esta US:

```text
semaforo_vital_dba
```

Roles asignados exclusivamente sobre `semaforo_vital`:

```text
dbAdmin@semaforo_vital
readWrite@semaforo_vital
```

El acceso del usuario fue restringido al cluster de desarrollo `semaforo-vital-dev`.

La lista de acceso de red se configuró para permitir la conexión desde la dirección autorizada del entorno de desarrollo, evitando una apertura general `0.0.0.0/0`.

---

## 3. Estructura implementada en el repositorio

La solución MongoDB quedó organizada dentro del repositorio backend de la siguiente forma:

```text
database/
└── mongodb/
    ├── init/
    │   └── init_semaforo_vital.js
    ├── seeds/
    │   └── seed_semaforo_vital.js
    ├── tests/
    │   └── test_validaciones.js
    ├── docs/
    │   └── evidencias_US-08.md
    └── README.md
```

La conexión del backend se prepara mediante variables de entorno:

```env
MONGODB_URI=
MONGODB_DB=semaforo_vital
```

El archivo `.env` se encuentra excluido mediante `.gitignore` y no se versionan credenciales ni cadenas de conexión privadas.

---

# 4. CA-01 - Validadores nativos `$jsonSchema`

## Colección `albergues`

Se implementó validación nativa para los campos:

```text
codigo_albergue
nombre
ubicacion
capacidad_instalada
activo
registrado_por
fecha
created_at
```

La ubicación utiliza una estructura GeoJSON:

```javascript
{
    type: "Point",
    coordinates: [longitud, latitud]
}
```

`capacidad_instalada` se valida como entero mayor o igual a cero.

## Colección `registros_diarios`

Campos obligatorios:

```text
albergue_id
fecha
poblacion
litros_agua
letrinas
casos_eda
casos_ira
registrado_por
created_at
```

Restricciones implementadas:

```text
poblacion   >= 0
litros_agua >= 0
letrinas    >= 0
casos_eda   >= 0
casos_ira   >= 0
```

Las colecciones utilizan:

```text
validationLevel: strict
validationAction: error
```

De esta forma, MongoDB rechaza directamente los documentos que incumplen el esquema.

### Resultado CA-01

```text
CUMPLE
```

---

# 5. CA-02 - Índice compuesto único

Se creó el índice:

```javascript
{
    albergue_id: 1,
    fecha: -1
}
```

Configuración:

```javascript
{
    name: "ux_registros_diarios_albergue_fecha",
    unique: true
}
```

Este índice cumple dos objetivos:

1. Impedir dos registros para el mismo albergue y la misma fecha.
2. Acelerar consultas temporales ordenadas por fecha dentro de un albergue.

### Prueba realizada

Primer registro con una combinación `albergue_id + fecha`:

```text
ACEPTADO
```

Segundo registro con la misma combinación:

```text
RECHAZADO
```

Código obtenido:

```text
11000
```

Correspondiente a error de clave duplicada.

Se verificó adicionalmente que el mismo albergue puede registrar una fecha diferente.

### Normalización de fecha

`fecha` representa el día operativo y se normaliza a las `00:00:00` de la zona horaria funcional `America/Bogota`.

MongoDB almacena BSON Date como un instante UTC, por lo que:

- Fecha funcional: `2026-10-14 00:00:00 UTC-05:00`
- Instante BSON equivalente: `ISODate("2026-10-14T05:00:00.000Z")`

`created_at` conserva el instante real de creación.

### Resultado CA-02

```text
CUMPLE
```

---

# 6. CA-03 - Campos obligatorios de trazabilidad

Los siguientes campos se configuraron como obligatorios:

```text
registrado_por
fecha
created_at
```

Se verificó mediante una inserción sin `registrado_por`.

MongoDB rechazó el documento con:

```text
Código: 121
Document failed validation
```

### Resultado CA-03

```text
CUMPLE
```

---

# 7. CA-04 - Datos semilla

Se implementó el archivo:

```text
database/mongodb/seeds/seed_semaforo_vital.js
```

El script carga dos albergues simulados de Pereira y sus respectivos registros diarios.

## Escenario crítico

```text
Población: 200 personas
Agua disponible: 800 litros
Letrinas: 4
Casos EDA: 8
Casos IRA: 3
```

Cálculo:

```text
800 / 200 = 4 L/persona/día
```

Criterio:

```text
4 < 5 L/persona/día
```

Resultado:

```text
ESCENARIO CRÍTICO CUMPLIDO
```

## Escenario óptimo

```text
Población: 100 personas
Agua disponible: 1800 litros
Letrinas: 8
Casos EDA: 0
Casos IRA: 1
```

Cálculo:

```text
1800 / 100 = 18 L/persona/día
```

Criterio:

```text
18 >= 15 L/persona/día
```

Resultado:

```text
ESCENARIO ÓPTIMO CUMPLIDO
```

El indicador litros/persona/día se calcula a partir de `litros_agua / poblacion` y no se persiste como campo adicional.

### Reejecución

Los datos utilizan identificadores determinísticos y operaciones `updateOne(..., { upsert: true })`.

Después de ejecutar nuevamente el script se conservaron:

```text
albergues: 2
registros_diarios: 2
```

No se generaron duplicados.

### Resultado CA-04

```text
CUMPLE
```

---

# 8. CA-05 - Evidencia de rechazo de valores negativos

Se implementó una batería automatizada en:

```text
database/mongodb/tests/test_validaciones.js
```

Pruebas ejecutadas:

| # | Prueba | Resultado esperado | Resultado |
|---:|---|---|---|
| 1 | `poblacion = -1` | Error 121 | Cumple |
| 2 | `litros_agua = -1` | Error 121 | Cumple |
| 3 | `letrinas = -1` | Error 121 | Cumple |
| 4 | `casos_eda = -1` | Error 121 | Cumple |
| 5 | `casos_ira = -1` | Error 121 | Cumple |
| 6 | Sin `registrado_por` | Error 121 | Cumple |
| 7 | Documento válido | Aceptado | Cumple |
| 8 | Duplicado `albergue_id + fecha` | Error 11000 | Cumple |

Resultado final de la batería:

```text
Pruebas exitosas: 8
Pruebas fallidas: 0
```

Después de las pruebas, los registros temporales fueron eliminados y permanecieron únicamente los dos registros semilla.

### Resultado CA-05

```text
CUMPLE
```

---

# 9. Integridad referencial

`registros_diarios.albergue_id` se valida como BSON `ObjectId`.

MongoDB `$jsonSchema` no implementa claves foráneas tradicionales entre colecciones; por ello el motor puede validar el tipo de `albergue_id`, pero no comprobar por sí mismo que dicho identificador exista en la colección `albergues`.

La existencia del albergue deberá verificarse desde la capa de aplicación antes de crear un registro diario.

Los datos semilla implementados sí mantienen referencias válidas entre `registros_diarios` y `albergues`.

---

# 10. Reejecución de scripts

Los scripts fueron diseñados para ser reejecutables.

## Inicialización

```javascript
load("database/mongodb/init/init_semaforo_vital.js")
```

Si las colecciones no existen, se crean. Si ya existen, sus validadores se actualizan mediante `collMod`.

## Semillas

```javascript
load("database/mongodb/seeds/seed_semaforo_vital.js")
```

Las semillas utilizan `upsert`, evitando duplicados.

## Pruebas

```javascript
load("database/mongodb/tests/test_validaciones.js")
```

Las pruebas utilizan datos temporales y realizan limpieza al finalizar.

---

# 11. Evidencia Git

Rama utilizada según los estándares del proyecto:

```text
feature/US-08-mongodb-validacion-seeds
```

Commits confirmados durante el desarrollo:

```text
b12baf7 chore: add mongodb project structure -US-08
7ba2a06 chore: add mongodb environment configuration -US-08
2791a74 feat: add mongodb validators and indexes -US-08
```

Los cambios se desarrollan fuera de `main` y serán integrados mediante Pull Request, de acuerdo con los estándares Git del proyecto.

---

# 12. Resultado general

| Criterio | Estado |
|---|---|
| CA-01 - `$jsonSchema` | CUMPLE |
| CA-02 - Índice compuesto único | CUMPLE |
| CA-03 - Trazabilidad | CUMPLE |
| CA-04 - Datos semilla | CUMPLE |
| CA-05 - Rechazo de negativos | CUMPLE |

## Conclusión

La US-08 quedó implementada técnicamente en MongoDB Atlas con colecciones, validadores nativos, índice único, datos semilla reproducibles y pruebas automatizadas. El entorno `semaforo_vital` está disponible para que el backend inicie integración y pruebas sin depender de creación manual de estructuras en Atlas.