from dataclasses import dataclass
from enum import StrEnum


class UserRole(StrEnum):
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
    albergue_nombre: str | None = None
    codigo_albergue: str | None = None


@dataclass(frozen=True)
class AdministratorDetails:
    email: str
    nombre: str
    apellido: str
    albergue_id: str | None = None


@dataclass(frozen=True)
class AdministratorChanges:
    email: str | None = None
    nombre: str | None = None
    apellido: str | None = None
    password_hash: str | None = None
    active: bool | None = None
