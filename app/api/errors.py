"""Catálogo HTTP único: códigos estables, mensajes públicos y validación segura."""
import logging
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException

from app.domain.errors import (
    ApplicationError,
    InactiveUser,
    InsufficientPermissions,
    InvalidCredentials,
    InvalidPopulation,
    InvalidShelterData,
    InvalidTokenError,
    NotAuthenticated,
    PersistenceError,
    PopulationConflict,
    ShelterAccessDenied,
    ShelterNotFound,
    TokenExpiredError,
)


class ValidationIssue(BaseModel):
    location: list[str | int]
    message: str
    type: str


class ErrorResponse(BaseModel):
    code: str
    detail: str
    errors: list[ValidationIssue] | None = None


@dataclass(frozen=True)
class ErrorDefinition:
    status: int
    code: str
    message: str


ERROR_CATALOG = {
    InvalidCredentials: ErrorDefinition(401, "INVALID_CREDENTIALS", "Credenciales inválidas"),
    NotAuthenticated: ErrorDefinition(401, "NOT_AUTHENTICATED", "No autenticado"),
    InvalidTokenError: ErrorDefinition(401, "INVALID_TOKEN", "Token inválido"),
    TokenExpiredError: ErrorDefinition(401, "TOKEN_EXPIRED", "Token expirado"),
    InactiveUser: ErrorDefinition(401, "USER_UNAVAILABLE", "Usuario inactivo o no encontrado"),
    InsufficientPermissions: ErrorDefinition(403, "INSUFFICIENT_PERMISSIONS", "Permisos insuficientes"),
    ShelterAccessDenied: ErrorDefinition(403, "SHELTER_ACCESS_DENIED", "Se requiere un administrador con albergue asignado"),
    ShelterNotFound: ErrorDefinition(404, "SHELTER_NOT_FOUND", "Albergue no encontrado"),
    PopulationConflict: ErrorDefinition(409, "POPULATION_CONFLICT", "Conflicto al registrar población; vuelva a intentar"),
    InvalidShelterData: ErrorDefinition(422, "INVALID_SHELTER_DATA", "Datos del albergue inválidos"),
    InvalidPopulation: ErrorDefinition(422, "INVALID_POPULATION", "La población no es válida para esta operación"),
    PersistenceError: ErrorDefinition(503, "PERSISTENCE_UNAVAILABLE", "No fue posible acceder a los datos"),
}
HTTP_ERRORS = {
    400: ErrorDefinition(400, "BAD_REQUEST", "Solicitud inválida"),
    401: ERROR_CATALOG[NotAuthenticated],
    403: ERROR_CATALOG[InsufficientPermissions],
    404: ErrorDefinition(404, "ROUTE_NOT_FOUND", "Recurso no encontrado"),
    405: ErrorDefinition(405, "METHOD_NOT_ALLOWED", "Método no permitido"),
    422: ErrorDefinition(422, "VALIDATION_ERROR", "Datos de entrada inválidos"),
    429: ErrorDefinition(429, "RATE_LIMIT_EXCEEDED", "Demasiadas solicitudes"),
    500: ErrorDefinition(500, "INTERNAL_ERROR", "Error interno del servidor"),
    503: ERROR_CATALOG[PersistenceError],
}

# OpenAPI exposes every functional error variant, grouped by HTTP status.
ERROR_RESPONSES = {}
for definition in [*HTTP_ERRORS.values(), *ERROR_CATALOG.values()]:
    response = ERROR_RESPONSES.setdefault(definition.status, {
        "model": ErrorResponse, "content": {"application/json": {"examples": {}}},
    })
    response["content"]["application/json"]["examples"][definition.code] = {
        "value": {"code": definition.code, "detail": definition.message},
    }


def error_response(definition: ErrorDefinition, *, errors=None, headers=None) -> JSONResponse:
    body = ErrorResponse(code=definition.code, detail=definition.message, errors=errors)
    return JSONResponse(
        status_code=definition.status, content=body.model_dump(exclude_none=True),
        headers=headers or ({"WWW-Authenticate": "Bearer"} if definition.status == 401 else None),
    )


async def application_error_handler(request: Request, exc: ApplicationError):
    definition = next(
        (ERROR_CATALOG[cls] for cls in type(exc).__mro__ if cls in ERROR_CATALOG),
        HTTP_ERRORS[500],
    )
    return error_response(definition)


async def validation_error_handler(request: Request, exc: RequestValidationError):
    # Do not echo input or exception context: these can contain passwords or tokens.
    issues = [ValidationIssue(
        location=list(error["loc"]), message="Valor inválido", type=error["type"],
    ) for error in exc.errors()]
    return error_response(HTTP_ERRORS[422], errors=issues)


async def http_error_handler(request: Request, exc: HTTPException):
    definition = HTTP_ERRORS.get(exc.status_code)
    if definition is None:
        definition = ErrorDefinition(exc.status_code, "HTTP_ERROR", "No fue posible procesar la solicitud")
    return error_response(definition, headers=exc.headers)


async def internal_error_handler(request: Request, exc: Exception):
    logging.getLogger(__name__).error("Unhandled error on %s", request.url.path, exc_info=exc)
    return error_response(HTTP_ERRORS[500])


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApplicationError, application_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_error_handler)
    app.add_exception_handler(Exception, internal_error_handler)
