# AGENTS.md

Reglas obligatorias para agentes de IA en este repositorio:

- **Prohibido agregar documentación no solicitada:** NO crear carpeta `docs/`, archivos `.md` adicionales, reportes ni guías por historia de usuario. Solo modificar `README.md` cuando el usuario lo pida explícitamente.
- **Arquitectura hexagonal pragmática (YAGNI):** Mantener el flujo `api` -> `application` -> `domain` <- `infrastructure`. No agregar abstracciones, puertos ni interfaces con una sola implementación sin necesidad real.
- **Pruebas:** Ejecutar `pytest` antes de dar por completada cualquier tarea.

