from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_shelter_service
from app.application.shelters import DashboardView, PopulationView, ShelterDetail, ShelterService
from app.api.errors import ERROR_RESPONSES
from app.domain.shelters import PopulationRecord, Shelter
from app.api.shelter_schemas import (
    DashboardResponse, PopulationRecordResponse, PopulationResponse, PopulationUpdate,
    ShelterDetailResponse, ShelterResponse, ShelterUpdate,
)
from app.core.timezone import now_colombia, start_of_day_colombia
from app.domain.users import User

router = APIRouter(
    prefix="/mi-albergue", tags=["albergue del administrador"], responses=ERROR_RESPONSES,
)
Service = Annotated[ShelterService, Depends(get_shelter_service)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=ShelterDetailResponse)
def detail(service: Service, user: CurrentUser) -> ShelterDetail:
    return service.detail(user)


@router.patch("", response_model=ShelterResponse)
def update(payload: ShelterUpdate, service: Service, user: CurrentUser) -> Shelter:
    return service.update(user, payload.to_command(), now_colombia())


@router.get("/poblacion", response_model=PopulationResponse)
def population(service: Service, user: CurrentUser) -> PopulationView:
    return service.population(user)


@router.put("/poblacion", response_model=PopulationRecordResponse)
def save_population(payload: PopulationUpdate, service: Service, user: CurrentUser) -> PopulationRecord:
    return service.save_population(user, start_of_day_colombia(payload.fecha), payload.poblacion, now_colombia())


@router.get("/poblacion/historial", response_model=list[PopulationRecordResponse])
def history(service: Service, user: CurrentUser,
            limite: Annotated[int, Query(ge=1, le=365)] = 30,
            offset: Annotated[int, Query(ge=0)] = 0):
    return service.history(user, limite, offset)


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(service: Service, user: CurrentUser,
              limite: Annotated[int, Query(ge=1, le=365)] = 30):
    return service.dashboard(user, limite)
