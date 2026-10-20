from collections import defaultdict, deque
from time import monotonic

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router_v1
from app.core.config import settings
from app.infrastructure.database.mongodb import mongodb_lifespan

app = FastAPI(title="Semaforo Vital Backend", lifespan=mongodb_lifespan)

# ponytail: in-memory per-IP sliding window; move to Redis/gateway if multi-worker
_request_hits: dict[str, deque[float]] = defaultdict(deque)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    limit = settings.rate_limit_requests
    window = settings.rate_limit_window_seconds
    if limit > 0 and window > 0:
        client_ip = request.client.host if request.client else "unknown"
        now = monotonic()
        hits = _request_hits[client_ip]
        while hits and now - hits[0] >= window:
            hits.popleft()
        if len(hits) >= limit:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Demasiadas solicitudes"},
            )
        hits.append(now)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router_v1, prefix="/api/v1")
