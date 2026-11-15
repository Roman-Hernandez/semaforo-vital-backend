"""Dominio de albergues (RF-41): modelos de entrada/salida, roles y errores."""
import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SUPER_ADMIN = "super_administrador"
ADMIN_ALBERGUE = "administrador_albergue"

_CODIGO_RE = re.compile(r"^[A-Z0-9]+(-[A-Z0-9]+)*$")


class AlbergueError(Exception):
    """Base de los errores de negocio de albergues."""


class AlbergueNoEncontrado(AlbergueError):
    pass


class AlbergueDuplicado(AlbergueError):
    pass


class AlbergueSinPermiso(AlbergueError):
    pass


class AlbergueInactivo(AlbergueError):
    pass


class AlbergueInvalido(AlbergueError):
    pass


class Coordenadas(BaseModel):
    """GeoJSON Point. El orden es [longitud, latitud]."""

    type: Literal["Point"] = "Point"
    coordinates: Annotated[list[float], Field(min_length=2, max_length=2)]

    @field_validator("coordinates")
    @classmethod
    def _validar_rango(cls, valor: list[float]) -> list[float]:
        longitud, latitud = valor
        if not -180 <= longitud <= 180:
            raise ValueError("La longitud debe estar entre -180 y 180")
        if not -90 <= latitud <= 90:
            raise ValueError("La latitud debe estar entre -90 y 90")
        return valor


class Ubicacion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    departamento: str = Field(min_length=1, max_length=80)
    municipio: str = Field(min_length=1, max_length=80)
    direccion: str | None = Field(default=None, max_length=200)
    coordenadas: Coordenadas


class AlbergueCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    codigo_albergue: str = Field(min_length=3, max_length=30)
    nombre: str = Field(min_length=3, max_length=120)
    capacidad_instalada: int = Field(strict=True, ge=1, le=100_000)
    ubicacion: Ubicacion

    @field_validator("codigo_albergue")
    @classmethod
    def _normalizar_codigo(cls, valor: str) -> str:
        valor = valor.upper()
        if not _CODIGO_RE.fullmatch(valor):
            raise ValueError("El código solo admite letras, números y guiones (ej. SIM-PER-001)")
        return valor


class AlbergueUpdate(BaseModel):
    """Modificación parcial. El código no se puede cambiar y `activo` solo cambia al desactivar."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombre: str | None = Field(default=None, min_length=3, max_length=120)
    capacidad_instalada: int | None = Field(default=None, strict=True, ge=1, le=100_000)
    ubicacion: Ubicacion | None = None

    @model_validator(mode="after")
    def _al_menos_un_campo(self) -> "AlbergueUpdate":
        if self.nombre is None and self.capacidad_instalada is None and self.ubicacion is None:
            raise ValueError("Debe enviarse al menos un campo para modificar")
        return self


class AlbergueOut(BaseModel):
    id: str
    codigo_albergue: str
    nombre: str
    capacidad_instalada: int
    ubicacion: Ubicacion
    activo: bool
    registrado_por: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    desactivado_en: datetime | None = None