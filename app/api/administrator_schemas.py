from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, model_validator

from app.api.shelter_schemas import Text
from app.domain.users import AdministratorChanges, AdministratorDetails, UserRole

ObjectIdText = Annotated[str, Field(pattern=r"^[a-fA-F0-9]{24}$")]


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    role: UserRole
    active: bool
    nombre: str | None = None
    apellido: str | None = None
    albergue_id: str | None = None
    albergue_nombre: str | None = None
    codigo_albergue: str | None = None


class AdministratorCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: EmailStr
    password: SecretStr = Field(min_length=8, max_length=128)
    nombre: Text
    apellido: Text
    albergue_id: ObjectIdText | None = None

    def to_details(self) -> AdministratorDetails:
        return AdministratorDetails(email=str(self.email).lower(), nombre=self.nombre,
                                    apellido=self.apellido, albergue_id=self.albergue_id)


class AdministratorUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: EmailStr | None = None
    password: SecretStr | None = Field(default=None, min_length=8, max_length=128)
    nombre: Text | None = None
    apellido: Text | None = None
    active: Annotated[bool, Field(strict=True)] | None = None

    @model_validator(mode="after")
    def supplied_values(self):
        if not self.model_fields_set or any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Envíe al menos un campo autorizado, sin valores nulos")
        return self

    def to_changes(self) -> AdministratorChanges:
        return AdministratorChanges(email=str(self.email).lower() if self.email else None,
                                    nombre=self.nombre, apellido=self.apellido, active=self.active)


class AssignmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    albergue_id: ObjectIdText | None
