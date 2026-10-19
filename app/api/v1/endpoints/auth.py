from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from pymongo.database import Database

from app.application.auth import InvalidCredentials, authenticate
from app.infrastructure.database.mongodb import get_database_from_request
from app.infrastructure.repositories.mongo_user_repository import MongoUserRepository

router = APIRouter(prefix="/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, database: Database = Depends(get_database_from_request)):
    repository = MongoUserRepository(database)
    try:
        token = authenticate(repository, payload.email, payload.password)
    except InvalidCredentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    return asdict(token)
