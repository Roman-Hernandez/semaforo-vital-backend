from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_sir_service
from app.api.errors import ERROR_RESPONSES
from app.api.pagination import PageParams
from app.api.sir_schemas import SIRRequest
from app.application.sir import SIRResult, SIRService
from app.core.timezone import now_colombia
from app.domain.users import User

router = APIRouter(prefix="/mi-albergue/modelo-sir", tags=["modelo SIR automático"], responses=ERROR_RESPONSES)
Actor = Annotated[User, Depends(get_current_user)]
Service = Annotated[SIRService, Depends(get_sir_service)]
Disease = Annotated[str | None, Query(min_length=1, max_length=300)]


@router.get("/resultados", response_model=SIRResult)
def results(user: Actor, service: Service, paging: PageParams, enfermedad: Disease = None):
    return service.results(user, now_colombia(), enfermedad, paging)


@router.post("/simular", response_model=SIRResult)
def simulate(user: Actor, service: Service, paging: PageParams, payload: SIRRequest | None = None):
    return service.results(user, now_colombia(), payload.enfermedad if payload else None, paging)


@router.get("/configuracion", response_model=SIRResult)
def configuration(user: Actor, service: Service, paging: PageParams):
    return service.results(user, now_colombia(), paging=paging)
