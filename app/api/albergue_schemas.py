"""Validación HTTP de la creación de albergues. Respuesta y modificación reutilizan shelter_schemas."""
from pydantic import BaseModel, ConfigDict

from app.api.shelter_schemas import Location, NonNegativeInt, Text
from app.domain.albergues import ShelterCreate
from app.domain.shelters import GeoPoint as DomainGeoPoint
from app.domain.shelters import Location as DomainLocation


class AlbergueCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombre: Text
    capacidad_instalada: NonNegativeInt
    ubicacion: Location

    def to_command(self) -> ShelterCreate:
        place = self.ubicacion
        return ShelterCreate(
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
