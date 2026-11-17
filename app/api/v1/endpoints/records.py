"""Registro, consulta y corrección de condiciones, casos e intervenciones."""

from fastapi import APIRouter

from app.api.errors import ERROR_RESPONSES
from app.api.pagination import FilterParams, PageParams, PageResponse
from app.api.record_schemas import DiseaseRequest, InterventionRequest, SanitaryRequest
from app.api.v1.endpoints.shelters import CurrentUser, Service
from app.core.timezone import now_colombia
from app.domain.shelters import (
    DiseaseRecord,
    Intervention,
    RecordKind,
    SanitaryConditions,
)

router = APIRouter(prefix="/mi-albergue", tags=["registros sanitarios"], responses=ERROR_RESPONSES)


@router.get("/condiciones-sanitarias", response_model=PageResponse[SanitaryConditions])
def list_sanitary(service: Service, user: CurrentUser, paging: PageParams, filters: FilterParams):
    return service.records_page(user, RecordKind.SANITARY, paging, filters)


@router.post("/condiciones-sanitarias", response_model=SanitaryConditions, status_code=201)
def create_sanitary(payload: SanitaryRequest, service: Service, user: CurrentUser):
    return service.save_record(user, RecordKind.SANITARY, payload.to_command(), now_colombia())


@router.put("/condiciones-sanitarias/{record_id}", response_model=SanitaryConditions)
def update_sanitary(record_id: str, payload: SanitaryRequest, service: Service, user: CurrentUser):
    return service.save_record(user, RecordKind.SANITARY, payload.to_command(), now_colombia(), record_id)


@router.get("/enfermedades", response_model=PageResponse[DiseaseRecord])
def list_disease(service: Service, user: CurrentUser, paging: PageParams, filters: FilterParams):
    return service.records_page(user, RecordKind.DISEASE, paging, filters)


@router.post("/enfermedades", response_model=DiseaseRecord, status_code=201)
def create_disease(payload: DiseaseRequest, service: Service, user: CurrentUser):
    return service.save_record(user, RecordKind.DISEASE, payload.to_command(), now_colombia())


@router.put("/enfermedades/{record_id}", response_model=DiseaseRecord)
def update_disease(record_id: str, payload: DiseaseRequest, service: Service, user: CurrentUser):
    return service.save_record(user, RecordKind.DISEASE, payload.to_command(), now_colombia(), record_id)


@router.get("/intervenciones", response_model=PageResponse[Intervention])
def list_intervention(service: Service, user: CurrentUser, paging: PageParams, filters: FilterParams):
    return service.records_page(user, RecordKind.INTERVENTION, paging, filters)


@router.post("/intervenciones", response_model=Intervention, status_code=201)
def create_intervention(payload: InterventionRequest, service: Service, user: CurrentUser):
    return service.save_record(user, RecordKind.INTERVENTION, payload.to_command(), now_colombia())


@router.put("/intervenciones/{record_id}", response_model=Intervention)
def update_intervention(record_id: str, payload: InterventionRequest, service: Service, user: CurrentUser):
    return service.save_record(user, RecordKind.INTERVENTION, payload.to_command(), now_colombia(), record_id)
