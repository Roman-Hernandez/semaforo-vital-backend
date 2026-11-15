"""Registros diarios del albergue del administrador (RF-16 a RF-19). Solo crear y consultar."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.daily_record_schemas import DailyRecordRequest, DailyRecordResponse
from app.api.deps import get_current_user, get_daily_record_service
from app.api.errors import ERROR_RESPONSES
from app.application.daily_records import DailyRecordService
from app.core.timezone import now_colombia, start_of_day_colombia
from app.domain.daily_records import DailyRecord
from app.domain.users import User

router = APIRouter(
    prefix="/mi-albergue/registros-diarios", tags=["registros diarios"],
    responses=ERROR_RESPONSES,
)
Service = Annotated[DailyRecordService, Depends(get_daily_record_service)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.post("", response_model=DailyRecordResponse, status_code=status.HTTP_201_CREATED)
def create_daily_record(payload: DailyRecordRequest, service: Service, user: CurrentUser) -> DailyRecord:
    return service.create(user, payload.to_command(start_of_day_colombia(payload.fecha)), now_colombia())


@router.get("", response_model=list[DailyRecordResponse])
def list_daily_records(
    service: Service, user: CurrentUser,
    limite: Annotated[int, Query(ge=1, le=365)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[DailyRecord]:
    return service.history(user, limite, offset)


@router.get("/{fecha}", response_model=DailyRecordResponse)
def get_daily_record(fecha: date, service: Service, user: CurrentUser) -> DailyRecord:
    return service.get(user, start_of_day_colombia(fecha))
