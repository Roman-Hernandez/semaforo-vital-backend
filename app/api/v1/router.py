from fastapi import APIRouter

from app.api.v1.endpoints.administrators import router as administrators_router
from app.api.v1.endpoints.albergues import router as albergues_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.public_shelters import router as public_shelters_router
from app.api.v1.endpoints.records import router as records_router
from app.api.v1.endpoints.shelters import router as shelters_router

api_router_v1 = APIRouter()
api_router_v1.include_router(health_router)
api_router_v1.include_router(auth_router)
api_router_v1.include_router(albergues_router)

api_router_v1.include_router(shelters_router)

api_router_v1.include_router(records_router)

api_router_v1.include_router(administrators_router)

api_router_v1.include_router(public_shelters_router)

from app.api.v1.endpoints.sir import router as sir_router

api_router_v1.include_router(sir_router)
