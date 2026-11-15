# Evidencias: registros diarios del albergue (RF-16, RF-17, RF-18, RF-19, RF-58, RF-61, RNF-12)

**Proyecto:** Semáforo Vital
**Historia de usuario:** Como administrador de albergue, quiero registrar y consultar la población, el agua disponible, las letrinas y los casos de enfermedades de mi albergue.
**Fecha de validación:** _(completar)_
**Responsable:** _(completar)_

---

## 1. Trazabilidad de criterios de aceptación

| Criterio | Implementación | Pruebas |
|---|---|---|
| Crear y consultar registros diarios | `POST`, `GET` y `GET /{fecha}` en `/api/v1/mi-albergue/registros-diarios` | `test_crea_registro_diario_valido`, `test_consulta_por_fecha`, `test_historial_del_mas_reciente_al_mas_antiguo_y_paginado` |
| Campos: albergue, fecha, población, litros de agua, letrinas, EDA, IRA y responsable | `DailyRecordRequest` y `DailyRecord`; `albergue_id` y `registrado_por` salen del usuario autenticado | `test_albergue_y_responsable_salen_del_usuario_autenticado` |
| Rangos y obligatorios | Pydantic (`NonNegativeInt`, `Liters`) + dominio (`DailyRecordCreate`) + `$jsonSchema` | `test_datos_invalidos_dan_422`, `test_campos_obligatorios`, `test_dominio_rechaza_valores_fuera_de_rango` |
| Albergue y usuario existen y están autorizados | `assigned_shelter` + búsqueda del albergue + `get_current_user` | `test_albergue_inexistente_da_404`, `test_albergue_desactivado_no_recibe_registros`, `test_super_admin_no_registra_por_un_albergue`, `test_administrador_sin_albergue_asignado_da_403`, `test_usuario_inactivo_da_403`, `test_sin_credenciales_da_401` |
| Un registro por albergue y día | Índice único `ux_registros_diarios_albergue_fecha` → 409 | `test_un_registro_por_albergue_y_dia`, `test_mongo_traduce_indice_unico_a_duplicado` |
| Se conservan los históricos | Solo se insertan y consultan; no hay modificación ni borrado | `test_se_conservan_los_registros_historicos`, `test_no_hay_modificacion_ni_borrado`, `test_el_repositorio_nunca_borra_ni_modifica` |
| Pruebas de persistencia, validación, referencias inexistentes y duplicados | `tests/test_daily_records.py` | Ver sección 2 |

### Reglas definidas en esta implementación (confirmar con el DBA / producto)

- Un segundo `POST` para el mismo albergue y día responde 409; no actualiza.
- Mínimo 0 en todas las cantidades; máximo 2 147 483 647 en enteros; `litros_agua` ≤ 1 000 000 000 (**límite provisional**: el contrato no define máximo).
- No se aceptan fechas futuras (día posterior a hoy en America/Bogota).
- La fecha es funcional: 00:00 en America/Bogota.
- No se registra en albergues desactivados (409).
- `poblacion` del registro diario no modifica `historial_poblacion`.

---

## 2. Evidencia: pruebas automatizadas

```bash
python -m pytest tests/test_daily_records.py -v
```

Resultado: _(pegar salida o captura)_

---

## 3. Evidencia: documentos persistidos

Flujo contra MongoDB Atlas con el validador estricto:

| Paso | Petición | Esperado | Captura |
|---|---|---|---|
| 1 | `POST /api/v1/mi-albergue/registros-diarios` | 201 | _(pegar)_ |
| 2 | Mismo `POST` repetido | 409 `DAILY_RECORD_DUPLICATE` | _(pegar)_ |
| 3 | `GET /api/v1/mi-albergue/registros-diarios/{fecha}` | 200 | _(pegar)_ |
| 4 | `GET /api/v1/mi-albergue/registros-diarios` | 200, historial | _(pegar)_ |
| 5 | `POST` con una cantidad negativa | 422 | _(pegar)_ |
| 6 | `POST` con token de súper administrador | 403 | _(pegar)_ |

Documento en Mongo:

```javascript
db.registros_diarios.find({ albergue_id: ObjectId("<ID_ALBERGUE>") }).sort({ fecha: -1 })
db.registros_diarios.getIndexes()
```

_(captura: campos del contrato y el índice `ux_registros_diarios_albergue_fecha` con `unique: true`)_

> Los registros de prueba no se pueden borrar desde la API. Usar una fecha de prueba clara y coordinar su limpieza con el DBA.

---

## 4. Evidencia: revisión de código

- Pull request: _(enlace)_
- Revisor: _(nombre)_
- Archivos revisados:
  - `app/domain/daily_records.py`
  - `app/application/daily_records.py`
  - `app/api/daily_record_schemas.py`
  - `app/api/v1/endpoints/daily_records.py`
  - `app/infrastructure/repositories/mongo_daily_record_repository.py`
  - `tests/test_daily_records.py`
