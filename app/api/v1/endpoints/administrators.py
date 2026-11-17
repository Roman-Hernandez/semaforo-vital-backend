from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.administrator_schemas import (
    AdministratorCreate,
    AdministratorUpdate,
    AssignmentRequest,
    UserResponse,
)
from app.api.deps import get_administrator_service, require_role
from app.api.errors import ERROR_RESPONSES
from app.api.pagination import FilterParams, PageParams, PageResponse
from app.application.administrators import AdministratorService
from app.core.timezone import now_colombia
from app.domain.users import User, UserRole

router = APIRouter(prefix="/administradores", tags=["administradores"], responses=ERROR_RESPONSES)
SuperAdmin = Annotated[User, Depends(require_role(UserRole.SUPER_ADMIN))]


Service = Annotated[AdministratorService, Depends(get_administrator_service)]


@router.get("", response_model=PageResponse[UserResponse])
def list_administrators(actor: SuperAdmin, service: Service, paging: PageParams, filters: FilterParams,
                        activo: bool | None = None):
    return service.page(actor, paging, filters, activo)


@router.post("", response_model=UserResponse, status_code=201)
def create_administrator(payload: AdministratorCreate, actor: SuperAdmin, service: Service):
    return service.create(actor, payload.to_details(), payload.password.get_secret_value(), now_colombia())


@router.get("/{user_id}", response_model=UserResponse)
def get_administrator(user_id: str, actor: SuperAdmin, service: Service):
    return service.get(actor, user_id)


@router.patch("/{user_id}", response_model=UserResponse)
def update_administrator(user_id: str, payload: AdministratorUpdate, actor: SuperAdmin, service: Service):
    return service.update(actor, user_id, payload.to_changes(), now_colombia(),
                          payload.password.get_secret_value() if payload.password else None)


@router.put("/{user_id}/albergue", response_model=UserResponse)
def assign_shelter(user_id: str, payload: AssignmentRequest, actor: SuperAdmin, service: Service):
    return service.assign(actor, user_id, payload.albergue_id, now_colombia())
