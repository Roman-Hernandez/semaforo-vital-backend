from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class SIRRequest(BaseModel):
    """Solo un filtro opcional; los datos y parámetros se resuelven en el servidor."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    enfermedad: Annotated[str, Field(min_length=1, max_length=300)] | None = None
