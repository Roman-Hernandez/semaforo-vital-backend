"""Validación HTTP de la creación de albergues. Respuesta y modificación reutilizan shelter_schemas."""
import re
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.shelter_schemas import Location, NonNegativeInt, Text
from app.domain.albergues import ShelterCreate
from app.domain.shelters import GeoPoint as DomainGeoPoint
from app.domain.shelters import Location as DomainLocation

_CODE_RE = re.compile(r"^[A-Z0-9]+(-[A-Z0-9]+)*$")


class AlbergueCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    codigo_albergue: Annotated[str, Field(min_length=3, max_length=30)]
    nombre: Text
    capacidad_instalada: NonNegativeInt
    ubicacion: Location

    @field_validator("codigo_albergue")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        value = value.upper()
        if not _CODE_RE.fullmatch(value):
            raise ValueError("El código solo admite letras, números y guiones (ej. SIM-PER-001)")
        return value

    def to_command(self) -> ShelterCreate:
        place = self.ubicacion
        return ShelterCreate(
            codigo_albergue=self.codigo_albergue,
            nombre=self.nombre,
            capacidad_instalada=self.capacidad_instalada,
            ubicacion=DomainLocation(
                departamento=place.departamento, municipio=place.municipio,
                direccion=place.direccion,
                coordenadas=DomainGeoPoint(
                    type=place.coordenadas.type, coordinates=place.coordenadas.coordinates,
                ),
            ),
        )
