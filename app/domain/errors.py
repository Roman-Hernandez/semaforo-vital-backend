"""Errores funcionales: no conocen HTTP, JWT ni MongoDB."""


class ApplicationError(Exception):
    pass


class InvalidCredentials(ApplicationError):
    pass


class NotAuthenticated(ApplicationError):
    pass


class InvalidTokenError(ApplicationError):
    pass


class TokenExpiredError(InvalidTokenError):
    pass


class InactiveUser(ApplicationError):
    pass


class InsufficientPermissions(ApplicationError):
    pass


class ShelterAccessDenied(ApplicationError):
    pass


class ShelterNotFound(ApplicationError):
    pass


class PopulationConflict(ApplicationError):
    pass


class PersistenceError(ApplicationError):
    pass


class InvalidShelterData(ApplicationError):
    pass


class InvalidPopulation(ApplicationError):
    pass
