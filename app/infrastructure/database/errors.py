"""Traduce errores del almacenamiento sin exponer detalles del proveedor."""
from functools import wraps

from pymongo.errors import PyMongoError

from app.domain.errors import PersistenceError


def persistence_guard(operation):
    @wraps(operation)
    def guarded(*args, **kwargs):
        try:
            return operation(*args, **kwargs)
        except PyMongoError as exc:
            raise PersistenceError() from exc
    return guarded
