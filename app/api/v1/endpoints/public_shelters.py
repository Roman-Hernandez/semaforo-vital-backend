"""Consultas sin sesión. No reutilizar respuestas administrativas en estas rutas."""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_public_shelter_service
from app.api.errors import ERROR_RESPONSES
from app.api.pagination import FilterParams, PageParams, PageResponse
from app.api.public_schemas import (
    PublicAlertResponse,
    PublicSanitaryResponse,
    PublicShelterResponse,
)
from app.application.public_shelters import PublicShelterService

router = APIRouter(prefix="/publico", tags=["consulta pública"], responses=ERROR_RESPONSES)
Service = Annotated[PublicShelterService, Depends(get_public_shelter_service)]


@router.get("/albergues", response_model=PageResponse[PublicShelterResponse])
def list_shelters(service: Service, paging: PageParams, filters: FilterParams):
    return service.page(paging, filters)


@router.get("/albergues/{albergue_id}", response_model=PublicShelterResponse)
def get_shelter(albergue_id: str, service: Service):
    return service.get(albergue_id)


@router.get("/albergues/{albergue_id}/condiciones-sanitarias", response_model=PublicSanitaryResponse | None)
def sanitary_conditions(albergue_id: str, service: Service):
    return service.get(albergue_id).condiciones_sanitarias


@router.get("/alertas", response_model=PageResponse[PublicAlertResponse])
def list_alerts(service: Service, paging: PageParams, filters: FilterParams, activa: bool | None = None):
    return service.alerts_page(paging, filters, active=activa)


@router.get("/albergues/{albergue_id}/alertas", response_model=PageResponse[PublicAlertResponse])
def shelter_alerts(albergue_id: str, service: Service, paging: PageParams, filters: FilterParams, activa: bool | None = None):
    return service.alerts_page(paging, filters, albergue_id, activa)
