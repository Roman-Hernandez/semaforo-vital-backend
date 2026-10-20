from dataclasses import dataclass
from enum import Enum


class UserRole(str, Enum):
    SHELTER_ADMIN = "administrador_albergue"
    SUPER_ADMIN = "super_administrador"


@dataclass(frozen=True)
class User:
    id: str
    email: str
    password_hash: str
    role: UserRole
    active: bool
    nombre: str | None = None
    apellido: str | None = None
    albergue_id: str | None = None
