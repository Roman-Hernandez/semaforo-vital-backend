"""Contrato de paginación independiente de HTTP y MongoDB."""
from dataclasses import dataclass
from datetime import datetime

from app.domain.errors import ApplicationError


class InvalidListQuery(ApplicationError):
    pass


@dataclass(frozen=True)
class Pagination:
    page: int = 1
    page_size: int = 20

    def __post_init__(self):
        if type(self.page) is not int or type(self.page_size) is not int or not 1 <= self.page <= 1_000_000 or not 1 <= self.page_size <= 100:
            raise InvalidListQuery()

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


@dataclass(frozen=True)
class ListFilters:
    q: str | None = None
    since: datetime | None = None
    until: datetime | None = None


@dataclass(frozen=True)
class PaginatedResult[T]:
    items: list[T]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool

    @classmethod
    def create(cls, items: list[T], pagination: Pagination, total: int) -> "PaginatedResult[T]":
        total_pages = (total + pagination.page_size - 1) // pagination.page_size
        return cls(items, pagination.page, pagination.page_size, total, total_pages,
                   pagination.page < total_pages, pagination.page > 1 and total > 0)
