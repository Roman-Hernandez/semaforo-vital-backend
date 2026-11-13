from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.shelters import router as shelters_router

api_router_v1 = APIRouter()
api_router_v1.include_router(health_router)
api_router_v1.include_router(auth_router)

api_router_v1.include_router(shelters_router)
