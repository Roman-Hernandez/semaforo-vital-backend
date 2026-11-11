"""Endpoints de albergues (RF-41). Los endpoints son `def` (no async) porque pymongo es síncrono."""
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_albergue_repository, get_current_user, require_role
from app.application.albergues import AlbergueService
from app.domain.albergues import (
    AlbergueCreate,
    AlbergueDuplicado,
    AlbergueInactivo,
    AlbergueInvalido,
    AlbergueNoEncontrado,
    AlbergueOut,
    AlbergueSinPermiso,
    AlbergueUpdate,
)
from app.domain.ports.albergue_repository import AlbergueRepository
from app.domain.users import User, UserRole

router = APIRouter(prefix="/albergues", tags=["albergues"])


def get_albergue_service(
    repositorio: Annotated[AlbergueRepository, Depends(get_albergue_repository)],
) -> AlbergueService:
    return AlbergueService(repositorio)


@contextmanager
def _traducir_errores():
    try:
        yield
    except AlbergueNoEncontrado as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except AlbergueSinPermiso as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except (AlbergueDuplicado, AlbergueInactivo) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except AlbergueInvalido as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


ServicioDep = Annotated[AlbergueService, Depends(get_albergue_service)]
SuperAdminDep = Annotated[User, Depends(require_role(UserRole.SUPER_ADMIN))]
UsuarioDep = Annotated[User, Depends(get_current_user)]


@router.post("", response_model=AlbergueOut, status_code=status.HTTP_201_CREATED)
def crear_albergue(datos: AlbergueCreate, actor: SuperAdminDep, servicio: ServicioDep):
    with _traducir_errores():
        return servicio.crear(actor, datos)


@router.get("", response_model=list[AlbergueOut])
def listar_albergues(actor: UsuarioDep, servicio: ServicioDep, activo: bool | None = None):
    with _traducir_errores():
        return servicio.listar(actor, activo)


@router.get("/{albergue_id}", response_model=AlbergueOut)
def consultar_albergue(albergue_id: str, actor: UsuarioDep, servicio: ServicioDep):
    with _traducir_errores():
        return servicio.obtener(actor, albergue_id)


@router.patch("/{albergue_id}", response_model=AlbergueOut)
def modificar_albergue(
    albergue_id: str, cambios: AlbergueUpdate, actor: UsuarioDep, servicio: ServicioDep
):
    with _traducir_errores():
        return servicio.actualizar(actor, albergue_id, cambios)


@router.patch("/{albergue_id}/desactivar", response_model=AlbergueOut)
def desactivar_albergue(albergue_id: str, actor: SuperAdminDep, servicio: ServicioDep):
    with _traducir_errores():
        return servicio.desactivar(actor, albergue_id)