"""Paginación en memoria únicamente para repositorios de prueba."""
from dataclasses import asdict

from app.domain.pagination import ListFilters, PaginatedResult


def memory_page(rows, paging, filters=None, date_field="fecha"):
    filters = filters or ListFilters()
    if filters.q:
        rows = [row for row in rows if filters.q.casefold() in str(asdict(row)).casefold()]
    if filters.since:
        rows = [row for row in rows if getattr(row, date_field) >= filters.since]
    if filters.until:
        rows = [row for row in rows if getattr(row, date_field) < filters.until]
    return PaginatedResult.create(rows[paging.offset:paging.offset + paging.page_size], paging, len(rows))
