from contextlib import asynccontextmanager

from fastapi import FastAPI
from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings


@asynccontextmanager
async def mongodb_lifespan(app: FastAPI):
    if not settings.mongodb_uri:
        raise RuntimeError("MONGODB_URI must be configured")
    client: MongoClient = MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=5000,
        tz_aware=True,
    )
    try:
        client.admin.command("ping")
        app.state.mongodb = client[settings.mongodb_db]
        yield
    finally:
        client.close()


def get_database() -> Database:
    from fastapi import Request
    raise RuntimeError("Use get_database_from_request as a FastAPI dependency")


def get_database_from_request(request):
    return request.app.state.mongodb
