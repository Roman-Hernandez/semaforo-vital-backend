from fastapi import FastAPI

from app.api.v1.router import api_router_v1

app = FastAPI(title="Semaforo Vital Backend")
app.include_router(api_router_v1, prefix="/api/v1")
