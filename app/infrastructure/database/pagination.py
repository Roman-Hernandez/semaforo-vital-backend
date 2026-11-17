"""Operaciones compartidas: contar y paginar en MongoDB, nunca cortar una lista ya descargada."""
import re
from collections.abc import Callable, Sequence
from typing import TypeVar

from pymongo.collection import Collection

from app.domain.pagination import (
    InvalidListQuery,
    ListFilters,
    PaginatedResult,
    Pagination,
)

T = TypeVar("T")


def filtered_query(base: dict, filters: ListFilters, text_fields: Sequence[str], date_field: str) -> dict:
    query = dict(base)
    if filters.q:
        if not text_fields:
            raise InvalidListQuery()
        query["$or"] = [{field: {"$regex": re.escape(filters.q), "$options": "i"}} for field in text_fields]
    bounds = {}
    if filters.since:
        bounds["$gte"] = filters.since
    if filters.until:
        bounds["$lt"] = filters.until
    if bounds:
        query[date_field] = bounds
    return query


def paginate_find(collection: Collection, query: dict, paging: Pagination,
                  sort: list[tuple[str, int]], mapper: Callable[[dict], T]) -> PaginatedResult[T]:
    total = collection.count_documents(query)
    cursor = collection.find(query).sort(sort).skip(paging.offset).limit(paging.page_size)
    return PaginatedResult.create([mapper(row) for row in cursor], paging, total)


def paginate_aggregate(collection: Collection, pipeline: list[dict], paging: Pagination,
                       mapper: Callable[[dict], T], *, item_pipeline: list[dict] | None = None) -> PaginatedResult[T]:
    stages = [*pipeline, {"$facet": {
        "items": [{"$skip": paging.offset}, {"$limit": paging.page_size}, *(item_pipeline or [])],
        "total": [{"$count": "value"}],
    }}]
    result = next(iter(collection.aggregate(stages)), {"items": [], "total": []})
    total = result["total"][0]["value"] if result["total"] else 0
    return PaginatedResult.create([mapper(row) for row in result["items"]], paging, total)
