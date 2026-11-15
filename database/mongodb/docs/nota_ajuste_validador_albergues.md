# Nota: ajuste temporal del validador de `albergues` y reversión

**Base de datos:** `semaforo_vital` (MongoDB Atlas)
**Colección:** `albergues`
**Fecha:** 15/11/2026
**Responsable:** Tatiana Miranda
**Autorizado por:** DBA del proyecto (reversión)

## Qué ocurrió

1. Al probar `POST /api/v1/albergues`, la API respondía "El albergue no cumple el esquema de la base de datos". La API no enviaba `fecha` ni `ubicacion.direccion`, que el contrato de datos exige como obligatorias.
2. Se aplicó un `collMod` sobre `albergues` (migraciones locales `003_unique_codigo_albergue` y `004_albergues_validator`) que volvió esos campos opcionales, permitió un campo `desactivado_en` y cambió `capacidad_instalada` a mínimo 1. **Ese cambio no estaba aprobado por el DBA.**
3. El DBA indicó que `fecha` y `direccion` deben seguir siendo obligatorias. Se corrigió la API (no la base) y se revirtió el validador.

## Estado final del validador (verificado en Atlas)

| Elemento | Valor |
|---|---|
| `validationLevel` / `validationAction` | `strict` / `error` |
| `required` | `codigo_albergue`, `nombre`, `ubicacion`, `capacidad_instalada`, `activo`, `registrado_por`, `fecha`, `created_at` |
| `ubicacion.required` | `departamento`, `municipio`, `direccion`, `coordenadas` |
| `direccion` | `string`, `minLength: 1` |
| `capacidad_instalada` | `int`, `minimum: 0` |
| Campos de trazabilidad | `updated_at` (date) y `updated_by` (objectId) |
| `desactivado_en` | No existe |

Es el esquema definido en `contrato_datos_backend.md` y en las migraciones `003_harden_data_integrity` y `004_add_update_traceability`.

## Cambios en la API para cumplir el contrato

- `ubicacion.direccion` es obligatoria (mínimo 1 carácter).
- `fecha` la fija el servicio al crear: medianoche del día actual en `America/Bogota`.
- Al modificar o desactivar, el servicio escribe `updated_at` y `updated_by`. No se usa `desactivado_en`.

## Registros en `schema_migrations`

Existen dos registros que **ya no tienen archivo en el repositorio**:
`003_unique_codigo_albergue` y `004_albergues_validator` (ejecutados el 14 y 15/11/2026).
Se conservan como historial. Sus efectos son:

- `003_unique_codigo_albergue`: índice único `ux_albergues_codigo_albergue`. Ya lo crea `003_harden_data_integrity` con el mismo nombre, así que no hay cambio neto.
- `004_albergues_validator`: revertido en esta nota.

## Verificación posterior a la reversión

Con el validador estricto, contra Atlas: crear (201), código repetido (409), sin `direccion` (422), modificar (200), desactivar (200, `activo: false`) y consultar (200). El documento de prueba se eliminó al terminar.

## Pendiente de confirmar con el DBA

La API exige `capacidad_instalada` ≥ 1 y el validador permite 0.
