"""Endpoints administrativos de albergues (RF-41). Son `def` porque pymongo es síncrono."""
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.albergue_schemas import AlbergueCreate
from app.api.deps import get_albergue_repository, get_current_user, require_role
from app.api.errors import ERROR_RESPONSES
from app.api.shelter_schemas import ShelterResponse, ShelterUpdate
from app.application.albergues import AlbergueService
from app.core.timezone import now_colombia, start_of_day_colombia
from app.domain.ports.albergue_repository import AlbergueRepository
from app.domain.shelters import Shelter
from app.domain.users import User, UserRole

router = APIRouter(prefix="/albergues", tags=["albergues"], responses=ERROR_RESPONSES)


def get_albergue_service(
    repository: Annotated[AlbergueRepository, Depends(get_albergue_repository)],
) -> AlbergueService:
    return AlbergueService(repository)


Service = Annotated[AlbergueService, Depends(get_albergue_service)]
SuperAdmin = Annotated[User, Depends(require_role(UserRole.SUPER_ADMIN))]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.post("", response_model=ShelterResponse, status_code=status.HTTP_201_CREATED)
def crear_albergue(data: AlbergueCreate, actor: SuperAdmin, service: Service) -> Shelter:
    now = now_colombia()
    return service.create(actor, data.to_command(), now, start_of_day_colombia(now))


@router.get("", response_model=list[ShelterResponse])
def listar_albergues(actor: CurrentUser, service: Service, activo: bool | None = None) -> list[Shelter]:
    return service.list(actor, activo)


@router.get("/{albergue_id}", response_model=ShelterResponse)
def consultar_albergue(albergue_id: str, actor: CurrentUser, service: Service) -> Shelter:
    return service.get(actor, albergue_id)


@router.patch("/{albergue_id}", response_model=ShelterResponse)
def modificar_albergue(
    albergue_id: str, changes: ShelterUpdate, actor: CurrentUser, service: Service,
) -> Shelter:
    return service.update(actor, albergue_id, changes.to_command(), now_colombia())


@router.patch("/{albergue_id}/desactivar", response_model=ShelterResponse)
def desactivar_albergue(albergue_id: str, actor: SuperAdmin, service: Service) -> Shelter:
    return service.deactivate(actor, albergue_id, now_colombia())
