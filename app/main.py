from fastapi import FastAPI

from app.api.v1.router import api_router_v1
from app.infrastructure.database.mongodb import mongodb_lifespan

app = FastAPI(title="Semaforo Vital Backend", lifespan=mongodb_lifespan)
app.include_router(api_router_v1, prefix="/api/v1")
