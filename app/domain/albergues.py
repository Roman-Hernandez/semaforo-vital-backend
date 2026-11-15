"""Comandos de dominio para el CRUD administrativo de albergues (RF-41)."""
import re
from dataclasses import dataclass

from app.domain.errors import InvalidShelterData
from app.domain.shelters import Location

_CODE_RE = re.compile(r"^[A-Z0-9]+(-[A-Z0-9]+)*$")


@dataclass(frozen=True, kw_only=True)
class ShelterCreate:
    codigo_albergue: str
    nombre: str
    capacidad_instalada: int
    ubicacion: Location

    def __post_init__(self):
        if not 3 <= len(self.codigo_albergue) <= 30 or not _CODE_RE.fullmatch(self.codigo_albergue):
            raise InvalidShelterData()
        if not self.nombre.strip():
            raise InvalidShelterData()
        if type(self.capacidad_instalada) is not int or self.capacidad_instalada < 0:
            raise InvalidShelterData()
