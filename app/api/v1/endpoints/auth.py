from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field, SecretStr

from app.api.deps import get_auth_use_case
from app.api.errors import ERROR_RESPONSES
from app.application.auth import AuthenticateUserUseCase

router = APIRouter(prefix="/auth", tags=["authentication"], responses=ERROR_RESPONSES)


class LoginRequest(BaseModel):
    email: EmailStr
    password: SecretStr = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    use_case: Annotated[AuthenticateUserUseCase, Depends(get_auth_use_case)],
):
    token = use_case.execute(payload.email, payload.password.get_secret_value())
    return asdict(token)
