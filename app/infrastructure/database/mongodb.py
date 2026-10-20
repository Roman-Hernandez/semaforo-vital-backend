from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings


@asynccontextmanager
async def mongodb_lifespan(app: FastAPI):
    if not settings.mongodb_uri:
        raise RuntimeError("MONGODB_URI must be configured")
    if len(settings.jwt_secret_key) < 32:
        raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters")
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


def get_database_from_request(request: Request) -> Database:
    db = getattr(request.app.state, "mongodb", None)
    if db is None:
        raise RuntimeError("Database connection not initialized")
    return db
