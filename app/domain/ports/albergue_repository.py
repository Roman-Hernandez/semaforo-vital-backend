"""Puerto del repositorio de albergues. Los dicts devueltos usan `id` (str), no `_id`."""
from typing import Protocol


class AlbergueRepository(Protocol):
    def crear(self, datos: dict) -> dict:
        """Inserta el albergue. Lanza AlbergueDuplicado si el código ya existe."""
        ...

    def obtener(self, albergue_id: str) -> dict | None:
        """Devuelve el albergue o None (también si el id no es válido)."""
        ...

    def listar(self, activo: bool | None = None) -> list[dict]:
        """Lista albergues ordenados por código; `activo` filtra si se indica."""
        ...

    def actualizar(self, albergue_id: str, cambios: dict) -> dict | None:
        """Aplica `$set` con los cambios y devuelve el documento actualizado (o None)."""
        ...