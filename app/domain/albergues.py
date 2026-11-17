"""Comandos de dominio para el CRUD administrativo de albergues (RF-41)."""
from dataclasses import dataclass

from app.domain.errors import InvalidShelterData
from app.domain.shelters import Location


@dataclass(frozen=True, kw_only=True)
class ShelterCreate:
    nombre: str
    capacidad_instalada: int
    ubicacion: Location

    def __post_init__(self):
        if not self.nombre.strip():
            raise InvalidShelterData()
        if type(self.capacidad_instalada) is not int or self.capacidad_instalada < 0:
            raise InvalidShelterData()


@dataclass(frozen=True)
class ShelterSummary:
    total_registrados: int
    total_activos: int
    con_administrador: int
    criticos: int
    sin_clasificacion: int
    poblacion_actual: int | None
    albergues_sin_poblacion: int
    porcentaje_ocupacion: float | None
