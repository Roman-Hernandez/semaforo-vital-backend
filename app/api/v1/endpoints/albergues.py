"""Endpoints administrativos de albergues (RF-41). Son `def` porque pymongo es síncrono."""
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.albergue_schemas import AlbergueCreate
from app.api.deps import (
    get_albergue_repository,
    get_current_user,
    get_shelter_service,
    require_role,
)
from app.api.errors import ERROR_RESPONSES
from app.api.pagination import FilterParams, PageParams, PageResponse
from app.api.shelter_schemas import ShelterResponse, ShelterUpdate
from app.application.albergues import AlbergueService
from app.application.shelters import ShelterService
from app.core.timezone import now_colombia, start_of_day_colombia
from app.domain.albergues import ShelterSummary
from app.domain.ports.albergue_repository import AlbergueRepository
from app.domain.shelters import (
    DiseaseRecord,
    Intervention,
    RecordKind,
    SanitaryConditions,
    Shelter,
)
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


@router.get("", response_model=PageResponse[ShelterResponse])
def listar_albergues(actor: CurrentUser, service: Service, paging: PageParams, filters: FilterParams, activo: bool | None = None):
    return service.page(actor, paging, filters, activo)


@router.get("/resumen", response_model=ShelterSummary)
def resumen_albergues(actor: SuperAdmin, service: Service):
    return service.summary(actor)


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


ShelterData = Annotated[ShelterService, Depends(get_shelter_service)]


@router.get("/{albergue_id}/condiciones-sanitarias", response_model=PageResponse[SanitaryConditions])
def global_sanitary(albergue_id: str, actor: SuperAdmin, service: ShelterData, paging: PageParams, filters: FilterParams):
    return service.records_page(actor, RecordKind.SANITARY, paging, filters, albergue_id)


@router.get("/{albergue_id}/enfermedades", response_model=PageResponse[DiseaseRecord])
def global_disease(albergue_id: str, actor: SuperAdmin, service: ShelterData, paging: PageParams, filters: FilterParams):
    return service.records_page(actor, RecordKind.DISEASE, paging, filters, albergue_id)


@router.get("/{albergue_id}/intervenciones", response_model=PageResponse[Intervention])
def global_intervention(albergue_id: str, actor: SuperAdmin, service: ShelterData, paging: PageParams, filters: FilterParams):
    return service.records_page(actor, RecordKind.INTERVENTION, paging, filters, albergue_id)