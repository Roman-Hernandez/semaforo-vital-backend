"""Casos de uso de albergues (RF-41, RF-14, RF-15). Sin dependencias de FastAPI ni de Mongo."""
from datetime import datetime, timezone
from typing import Optional

from app.domain.albergues import (
    ADMIN_ALBERGUE,
    SUPER_ADMIN,
    AlbergueCreate,
    AlbergueInactivo,
    AlbergueNoEncontrado,
    AlbergueSinPermiso,
    AlbergueUpdate,
)
from app.domain.ports.albergue_repository import AlbergueRepository


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _rol(actor) -> str | None:
    """El rol puede llegar como UserRole (Enum) o como str; se compara siempre por valor."""
    rol = getattr(actor, "role", None)
    return getattr(rol, "value", rol)


class AlbergueService:
    """`actor` es el usuario autenticado: debe exponer `.id`, `.role` y `.albergue_id`."""

    def __init__(self, repositorio: AlbergueRepository):
        self._repo = repositorio

    # --- permisos -----------------------------------------------------------
    @staticmethod
    def _es_super(actor) -> bool:
        return _rol(actor) == SUPER_ADMIN

    @staticmethod
    def _es_admin_de(actor, albergue_id: str) -> bool:
        propio = getattr(actor, "albergue_id", None)
        return (
            _rol(actor) == ADMIN_ALBERGUE
            and propio is not None
            and str(propio) == str(albergue_id)
        )

    def _exigir_super(self, actor) -> None:
        if not self._es_super(actor):
            raise AlbergueSinPermiso("Solo el súper administrador puede realizar esta operación")

    def _obtener_o_404(self, albergue_id: str) -> dict:
        doc = self._repo.obtener(albergue_id)
        if doc is None:
            raise AlbergueNoEncontrado("Albergue no encontrado")
        return doc

    # --- casos de uso -------------------------------------------------------
    def crear(self, actor, datos: AlbergueCreate) -> dict:
        self._exigir_super(actor)
        doc = datos.model_dump(exclude_none=True)
        ahora = _ahora()
        doc.update(
            activo=True,
            registrado_por=str(actor.id),
            created_at=ahora,
            updated_at=ahora,
        )
        return self._repo.crear(doc)

    def listar(self, actor, activo: Optional[bool] = None) -> list[dict]:
        if self._es_super(actor):
            return self._repo.listar(activo)
        propio = getattr(actor, "albergue_id", None)
        if _rol(actor) == ADMIN_ALBERGUE and propio is not None:
            doc = self._repo.obtener(str(propio))
            return [doc] if doc else []
        raise AlbergueSinPermiso("No tienes permiso para consultar albergues")

    def obtener(self, actor, albergue_id: str) -> dict:
        if not (self._es_super(actor) or self._es_admin_de(actor, albergue_id)):
            raise AlbergueSinPermiso("No tienes permiso para consultar este albergue")
        return self._obtener_o_404(albergue_id)

    def actualizar(self, actor, albergue_id: str, cambios: AlbergueUpdate) -> dict:
        es_super = self._es_super(actor)
        if not (es_super or self._es_admin_de(actor, albergue_id)):
            raise AlbergueSinPermiso("No tienes permiso para modificar este albergue")
        # RF-15: el administrador solo actualiza información básica (capacidad y ubicación).
        if not es_super and cambios.nombre is not None:
            raise AlbergueSinPermiso("Solo el súper administrador puede cambiar el nombre")

        doc = self._obtener_o_404(albergue_id)
        if not doc.get("activo", True):
            raise AlbergueInactivo("El albergue está desactivado y no puede modificarse")

        datos = cambios.model_dump(exclude_none=True)
        datos["updated_at"] = _ahora()
        actualizado = self._repo.actualizar(albergue_id, datos)
        if actualizado is None:
            raise AlbergueNoEncontrado("Albergue no encontrado")
        return actualizado

    def desactivar(self, actor, albergue_id: str) -> dict:
        """Desactivación lógica: no borra el albergue ni su historial (RNF-12)."""
        self._exigir_super(actor)
        doc = self._obtener_o_404(albergue_id)
        if not doc.get("activo", True):
            return doc  # idempotente
        ahora = _ahora()
        actualizado = self._repo.actualizar(
            albergue_id, {"activo": False, "desactivado_en": ahora, "updated_at": ahora}
        )
        if actualizado is None:
            raise AlbergueNoEncontrado("Albergue no encontrado")
        return actualizado